import Phaser from 'phaser';
import './style.css';
import splashUrl from '../assets/splash/bird-squad-canal-run-splash-v11-menu-pop.webp';
import titleBirdUrl from '../assets/ui/bird-squad-title-bird-textured-v2.png';
import titleSquadUrl from '../assets/ui/bird-squad-title-squad-textured-v2.png';
import combatFxAtlasUrl from '../assets/runtime/fx/combat-fx-atlas.png';
import combatAtmosphereUrl from '../assets/runtime/fx/combat-atmosphere-strip.png';
import {
  alphaBasinSet,
  alphaCacheSet,
  alphaCardArtManifest,
  alphaCardSet,
  alphaEncounterLibrary,
  alphaEnemyArtManifest,
  alphaEnemyLibrary,
  alphaMaps,
  alphaMapProfileLibrary,
  alphaMarketSet,
  alphaNestSet,
  alphaRewardProfileLibrary,
  alphaRouteMarkSet,
  alphaRouteMarkLibrary,
  alphaSignalLibrary,
  alphaStatusSet,
  alphaSupplyLibrary,
  routeBlueprints,
} from './game/runtime-data';
import { generateRouteMap, hashSeed } from './game/route-gen';
import type {
  CardRarity,
  EnemyRole,
  EnemyMove,
  MarketPriceBand,
  RewardProfile,
  RouteMarkRarity,
  RouteNode,
  RuntimeCard,
  RuntimeEnemy,
  RuntimeRouteMap,
  RuntimeRouteMark,
  RuntimeSupply
} from './game/types';
import type { ReserveEnemyContract } from './game/runtime-data';
import { banner, burst, fadeRect, floatingText, impactRing, shakeCamera, strike } from './game/fx';
import { drawPanel } from './game/theme';
import { defaultLeaderId, flockLeaders, getLeader } from './game/leaders';
import { getLeaderLore } from './game/leader-lore';
import { difficultyAdds, difficultyLabel, difficultyMods, MAX_DIFFICULTY } from './game/difficulty';
import { achievements, discoverCards, isLeaderUnlocked, leaderUnlockHints, loadAccount, recordRun, type PlayerAccount } from './game/meta';
import { queuePreloadImageAssets, queueRuntimeImageAssets, uniqueImageAssets, type RuntimeImageAsset } from './game/runtime-images';
import { getMapBalanceProfile } from './game/balance';

type GameMode = 'menu' | 'routeSelection' | 'battle' | 'waymarkReward' | 'cardReward' | 'upgradeReward' | 'runComplete' | 'defeat';
type CodexDataModule = typeof import('./game/codex-data');
type InspectOverlay = 'deck' | 'draw' | 'discard' | 'flock';
type CardType = 'major' | 'minor' | 'molt' | 'aviary';
type CardRole = 'attack' | 'skill' | 'utility';
type TargetType = 'enemy' | 'allEnemies' | 'self' | 'none' | 'choice';
type NodeChoiceOption = { key: string; text: string; effects: string[]; locked: boolean; lockedText?: string };
type CardPickerMode = 'preen' | 'release';
type RouteCardPickerPlan = { mode: CardPickerMode; count: number };
type PendingRouteReward = {
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
};
type PendingRouteRewardItem = { kind: 'supply' | 'waymark'; id: string };

interface Flock {
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
  // Formation "Flow": rises as the flock presses the attack, shatters when an
  // unblocked hit lands. Drives the Scatter / Hold / Surge state (see flockState).
  flow: number;
  flowMax: number;
}

// The flock is always in one of three formation states, derived from Cohesion
// and Flow. SURGING (Flow full) hits and guards harder; SCATTERED (Cohesion
// low) fights weaker; HOLDING is the stable middle.
type FlockState = 'scattered' | 'holding' | 'surging';
const SCATTER_HP_RATIO = 0.34;
function flockStateOf(flock: Flock): FlockState {
  if (flock.flow >= flock.flowMax) return 'surging';
  if (flock.hp < flock.maxHp * SCATTER_HP_RATIO) return 'scattered';
  return 'holding';
}

interface Enemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  weak: number;
  intentIndex: number;
  hitThisTurn: boolean;
  nextAttackBonus: number;
  damageBonus: number;
  roles: EnemyRole[];
  solo: boolean;
  runtime: RuntimeEnemy;
}

interface Card {
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

interface ActiveCardContract {
  effects: string[];
  text: string;
  target: TargetType;
  baseTarget: TargetType;
  role: CardRole;
  usesMolt: boolean;
  label: 'Normal' | 'Molt';
}

interface TextureVisibleBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface SavedCard {
  id: string;
  upgraded?: boolean;
}

interface NextCombatMods {
  openSkyGuard?: number;
  reduceNextOpenSky?: number;
  enemyCover?: number;
  startOpenSky?: boolean;
  bossDamageShield?: number;
}

interface RunState {
  deck: SavedCard[];
  leaderId?: string;
  difficulty?: number;
  seed?: string;
  currentHp: number;
  scrap: number;
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
  suppliesUsed?: string[];
  combatResults?: CombatResultSummary[];
  freePreenNextDistrict?: number;
}

interface CombatDecisionStats {
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
  bossEntryCohesion?: number;
  bossEntryScrap?: number;
}

interface SignalChoiceEvent {
  signalId: string;
  choiceKey: string;
}

interface CardRewardEvent {
  offered: string[];
  picked?: string;
  skipped: boolean;
  fallback?: 'scrap' | 'preen';
}

interface WaymarkFeedback {
  id: string;
  name: string;
  summary: string;
  turn: number;
}

interface SupplyFeedback {
  id: string;
  name: string;
  summary: string;
  timing: RuntimeSupply['timing'];
  turn?: number;
}

interface CombatResultSummary {
  encounterId: string;
  nodeId: string;
  nodeType: RouteNode['type'];
  enemyIds: string[];
  turnsTaken: number;
  damageDealt: number;
  cohesionLost: number;
  killedByMove?: string;
  decisionStats?: CombatDecisionStats;
}

interface RouteMark {
  id: string;
  name: string;
  text: string;
  price: number;
}

interface MarketCardListing {
  id: string;
  price: number;
  sold?: boolean;
}

interface MarketWaymarkListing {
  id: string;
  price: number;
  sold?: boolean;
}

const MARKET_BOSS_GUARD = 'boss_guard';
const MARKET_ROUTE_SCOUT = 'route_scout';

interface MarketUtilityListing {
  id: 'preen' | 'release' | 'supply' | typeof MARKET_BOSS_GUARD | typeof MARKET_ROUTE_SCOUT;
  price: number;
  supplyId?: string;
  sold?: boolean;
}

interface EffectResolutionState {
  previousDiscarded: number;
  previousDamageDefeated: boolean;
  spentResonance: boolean;
  returnSelfToDraw: boolean;
  exhaustSelf: boolean;
  builtFlow: boolean;
  flockDamageBonusUsed: boolean;
}

type EnemyMotionCue = 'attack' | 'hit';

interface RenderPayload {
  mode: GameMode;
  scene: string;
  encounter: number;
  turn: number;
  energy: number;
  resonance: number;
  overextension: {
    cardsPlayedThisTurn: number;
    threshold: number;
    safeCardsRemaining: number;
    currentlyExposed: boolean;
  };
  selectedCard?: string;
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
  selectedEnemy?: string;
  deckIds: string[];
  drawPile: number;
  discardPile: number;
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
  hand: Array<{ id: string; name: string; bird: string; cost: number; type: CardType; role: CardRole; target: TargetType; activeTarget?: TargetType; activeRole?: CardRole; activeText?: string; usesMolt?: boolean }>;
  waymarkChoices?: Array<{ id: string; name: string; family: string; rarity: RouteMarkRarity; source: string; description: string }>;
  rewardChoices?: Array<{ id: string; name: string; bird: string; cost: number; type: CardType; target: TargetType }>;
  upgradeChoices?: Array<{ id: string; name: string; bird: string; cost: number; type: CardType; target: TargetType }>;
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
  waymarkDrawerOpen?: boolean;
  supplyDrawerOpen?: boolean;
  waymarkFeedback?: WaymarkFeedback[];
  supplyFeedback?: SupplyFeedback[];
  piles: {
    deck: number;
    hand: number;
    discard: number;
  };
  flockStats: Array<{
    label: string;
    base: number;
    flock: number;
    current: number;
  }>;
  log: string[];
}

interface RouteSceneData {
  runState?: RunState;
}

interface BattleSceneData {
  routeNodeId?: string;
  runState?: RunState;
}

// Run summary emitted on win/loss for local playtest stats
// (next-level-implementation-spec Phase 5 / next-level-data-contracts §10).
interface RunSummary {
  id: string;
  seed: string;
  result: 'win' | 'loss';
  leaderId?: string;
  difficulty?: number;
  mapId: string;
  finalNodeId: string;
  killedBy?: string;
  turnsTaken: number;
  currentCohesion: number;
  maxCohesion: number;
  scrapEarned: number;
  scrapSpent: number;
  path: string[];
  deck: SavedCard[];
  routeMarks: string[];
  suppliesUsed: string[];
  signals: SignalChoiceEvent[];
  cardRewards: CardRewardEvent[];
  combatResults: CombatResultSummary[];
  decisionStats?: {
    cardsPlayed: number;
    overextensions: number;
    lowCardTurns: number;
    noOverextensionTurns: number;
    cardsHeldAtRoost: number;
    unspentWingbeatAtRoost: number;
    maxCardsPlayedTurn: number;
    finalWaymarks: number;
    bossEntryCohesion?: number;
    bossEntryScrap?: number;
  };
}

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    __birdSquadState?: () => RenderPayload;
    __birdSquadGame?: Phaser.Game;
    __birdSquadLastRun?: RunSummary;
    __birdSquadExportRuns?: () => string;
    __birdSquadCurrentMap?: () => RuntimeRouteMap;
  }
}

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const UI_FONT = 'Arial';
const UI_BOLD = 'bold';
const UI_GOLD = '#ffe1a3';
const UI_BODY = '#cdd9e6';
const UI_MUTED = '#8fa3b6';
const UI_SOFT = '#b9c7d6';
const UI_CYAN = '#8df4ff';
const HUD_MENU_PANEL = {
  w: 1060,
  h: 570,
  cx: GAME_WIDTH / 2,
  cy: GAME_HEIGHT / 2,
  headerIconX: 392,
  headerIconY: 58,
  closeX: 76,
  closeY: 56
};
const DECK_DETAIL_LAYOUT = {
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
  statsHeaderY: 534,
  statsY: 558
};
const MENU_BORDER_WIDTH = 1.5;
const MENU_BORDER_COLOR = 0x7ab8d6;
const HAND_Y = 590;
const CARD_W = 164;
const CARD_H = 246; // true 2:3 card aspect (art is 1024x1536)
const ROUTE_NODE_RADIUS = 42;
const ROUTE_BOSS_NODE_RADIUS = 60;
const ROUTE_NODE_ICON_SIZE = 90;
const ROUTE_BOSS_NODE_ICON_SIZE = 138;
const ROUTE_NODE_FOCUS_PAD = 9;
const ROUTE_NODE_LAYOUT_PAD = 4;
// Anchor points for combat FX (floating numbers / bursts), matching the
// enemy body (renderEnemyRow) and flock panel (renderFlock) positions.
const ENEMY_FX_X = 920;
const ENEMY_FX_Y = 250;
const FLOCK_FX_X = 230;
const FLOCK_FX_Y = 332;
const FLOCK_ART_X = 230;
const FLOCK_ART_Y = 340;
// HP-bar geometry, shared by the render (renderEnemyRow / top status bar) and the
// drain animation (fadeRect in damageEnemy / damageFlock / healFlock) so they line up.
const ENEMY_HP_BAR = { x: 920, y: 318, w: 210, h: 24 };
const FLOCK_HP_BAR = { x: 159, y: 44, w: 190, h: 24 };
// A suit's keystone aura activates once the flock holds this many of that suit.
// (A suit-biased Leader's starter deck already crosses it, so each Leader opens
// with their keystone live; the balanced Fledgling opens with none.)
const KEYSTONE_AT = 5;
const NESTS_COVER_CARRY_CAP = 8;
const SURGE_STAT_BONUS = 1;
const SOLO_ENCOUNTER_HEALTH_MULT = 1.35;
const SOLO_ENCOUNTER_DAMAGE_BONUS = 2;
const MULTI_ENCOUNTER_HEALTH_MULT = 1.2;
const MULTI_ENCOUNTER_DAMAGE_BONUS = 2;
const CARD_REVIEW_VISIBLE_ROWS = 11;
const CARD_REVIEW_ROW_H = 38;
const BASE_COHESION = 36;
const BASE_WINGBEATS = 3;
const BASE_HAND_TARGET = 4;
const BASE_RESONANCE_CAP = 5;
const BASE_SUPPLY_SLOTS = 2;
const POST_COMBAT_RECOVERY = 1;
const OVEREXTENSION_CARD_THRESHOLD = 4;
const WAYMARK_ACTIVE_CAP = 6;
const STARTING_SCRAP = 40;
// Market pricing is data-driven from alpha-market.json (next-level-implementation
// -spec "Market prices and services are data-driven").
const alphaMarketConfig = alphaMarketSet.markets[0];
const MARKET_CARD_PRICE = alphaMarketConfig.cardSlots.find((slot) => slot.rarity === 'common')?.price.base ?? 55;
const MARKET_PREEN_PRICE = alphaMarketConfig.services.find((service) => service.id === 'preen')?.basePrice ?? 100;
const MARKET_ROUTE_MARK_PRICE = alphaMarketConfig.routeMarkSlots[0]?.price.base ?? 110;
const MARKET_REFRESH_BASE_PRICE = 30;
const CACHE_SCRAP_REWARD = 30;
const DEFAULT_REWARD_SKIP_SCRAP = 12;
const COMBAT_FX_TEXTURE = 'combat-fx-atlas';
const COMBAT_FX_PARTICLE_TEXTURE = 'combat-fx-pixel';
const COMBAT_ATMOSPHERE_TEXTURE = 'combat-atmosphere-strip';
const MENU_SOFT_MOTE_TEXTURE = 'menu-soft-mote';
const SUIT_FX_ANIM: Record<string, string> = {
  plumes: 'fx-plumes',
  quills: 'fx-quills',
  basins: 'fx-basins',
  nests: 'fx-nests',
};
// Every playable card lives in one shared reward pool; weight post-combat offers
// by rarity so uncommon cards show up often while rares/legendaries still feel special.
const REWARD_RARITY_WEIGHT: Record<string, number> = { common: 80, uncommon: 75, rare: 32, legendary: 10 };
const battlefieldRuntimeArtUrls = import.meta.glob('../assets/runtime/backdrops/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const battlefieldVariantRuntimeArtUrls = import.meta.glob('../assets/runtime/backdrops/variants/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const marketKitRuntimeArtUrls = import.meta.glob('../assets/runtime/market-kit/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const routeEventRuntimeArtUrls = import.meta.glob('../assets/runtime/route-events/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const routeEventPropRuntimeArtUrls = import.meta.glob('../assets/runtime/route-events/props/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function battlefieldVariantAsset(filename: string, key: string): RuntimeImageAsset {
  return {
    key,
    url: battlefieldVariantRuntimeArtUrls[`../assets/runtime/backdrops/variants/${filename}`]
      ?? `/assets/runtime/backdrops/variants/${filename}`
  };
}

function marketKitAsset(filename: string, key: string): RuntimeImageAsset {
  return {
    key,
    url: marketKitRuntimeArtUrls[`../assets/runtime/market-kit/${filename}`]
      ?? `/assets/runtime/market-kit/${filename}`
  };
}

function routeEventAsset(filename: string, key: string): RuntimeImageAsset {
  return {
    key,
    url: routeEventRuntimeArtUrls[`../assets/runtime/route-events/${filename}`]
      ?? `/assets/runtime/route-events/${filename}`
  };
}

function routeEventPropAsset(filename: string, key: string): RuntimeImageAsset {
  return {
    key,
    url: routeEventPropRuntimeArtUrls[`../assets/runtime/route-events/props/${filename}`]
      ?? `/assets/runtime/route-events/props/${filename}`
  };
}

const MARKET_KIT_ASSETS = {
  background: marketKitAsset('bird-market-background-v1.webp', 'market-kit-background'),
  shopkeeper: marketKitAsset('starling-shopkeeper-v1.webp', 'market-kit-shopkeeper-starling'),
  sign: marketKitAsset('bird-market-sign-v1.webp', 'market-kit-sign'),
  counter: marketKitAsset('market-counter-wares-v1.webp', 'market-kit-counter-wares')
};

const BATTLEFIELD_ASSETS: Record<string, RuntimeImageAsset> = {
  map_01_rooftop_blocks: {
    key: 'battlefield-rooftop-blocks',
    url: battlefieldRuntimeArtUrls['../assets/runtime/backdrops/rooftop-blocks.webp'] ?? '/assets/runtime/backdrops/rooftop-blocks.webp'
  },
  map_02_canal_markets: {
    key: 'battlefield-canal-markets',
    url: battlefieldRuntimeArtUrls['../assets/runtime/backdrops/canal-markets.webp'] ?? '/assets/runtime/backdrops/canal-markets.webp'
  },
  map_03_signal_spires: {
    key: 'battlefield-signal-spires',
    url: battlefieldRuntimeArtUrls['../assets/runtime/backdrops/signal-spires.webp'] ?? '/assets/runtime/backdrops/signal-spires.webp'
  },
  map_04_high_roost: {
    key: 'battlefield-high-roost',
    url: battlefieldRuntimeArtUrls['../assets/runtime/backdrops/high-roost.webp'] ?? '/assets/runtime/backdrops/high-roost.webp'
  }
};
const DEFAULT_BATTLEFIELD_ASSET = BATTLEFIELD_ASSETS.map_01_rooftop_blocks;
const BATTLEFIELD_BOSS_VARIANTS: Partial<Record<string, RuntimeImageAsset>> = {
  map_01_rooftop_blocks: battlefieldVariantAsset('rooftop-blocks-boss-tar-crow-v1.webp', 'battlefield-rooftop-blocks-boss-tar-crow'),
  map_02_canal_markets: battlefieldVariantAsset('canal-markets-boss-gatekeeper-v1.webp', 'battlefield-canal-markets-boss-gatekeeper'),
  map_03_signal_spires: battlefieldVariantAsset('signal-spires-boss-beacon-breaker-v1.webp', 'battlefield-signal-spires-boss-beacon-breaker'),
  map_04_high_roost: battlefieldVariantAsset('high-roost-boss-warden-v1.webp', 'battlefield-high-roost-boss-warden')
};
const ROUTE_EVENT_BACKDROP_ASSETS: Partial<Record<RouteNode['type'], RuntimeImageAsset>> = {
  basin: routeEventAsset('lantern-roost-shelter-v3.webp', 'route-event-lantern-roost-shelter'),
  cache: routeEventAsset('rooftop-cache-office-v2.webp', 'route-event-rooftop-cache-office'),
  market: MARKET_KIT_ASSETS.background,
  signal: routeEventAsset('signal-switchboard-v2.webp', 'route-event-signal-switchboard'),
  nest: routeEventAsset('featherwright-studio-v2.webp', 'route-event-featherwright-studio'),
  rival: routeEventAsset('rival-wager-board-v2.webp', 'route-event-rival-wager-board')
};
const ROUTE_EVENT_PROP_ASSETS = {
  basinHearthCart: routeEventPropAsset('basin-hearth-cart-v1.webp', 'route-event-prop-basin-hearth-cart'),
  signalSwitchboard: routeEventPropAsset('signal-route-switchboard-v1.webp', 'route-event-prop-signal-route-switchboard'),
  nestFeatherwrightBench: routeEventPropAsset('nest-featherwright-bench-v1.webp', 'route-event-prop-nest-featherwright-bench'),
  marnLockboxCabinet: routeEventPropAsset('marn-lockbox-cabinet-v1.webp', 'route-event-prop-marn-lockbox-cabinet')
};
const ROUTE_MAP_BACKDROP_ASSET = {
  key: 'route-map-backdrop-rooftop-blocks',
  url: battlefieldRuntimeArtUrls['../assets/runtime/backdrops/rooftop-blocks-route-map-v1.webp']
    ?? '/assets/runtime/backdrops/rooftop-blocks-route-map-v1.webp'
};
const ROUTE_MAP_BACKING_ASSET = {
  key: 'route-board-laminated-plan',
  url: battlefieldRuntimeArtUrls['../assets/runtime/backdrops/route-board-laminated-plan-v1.webp']
    ?? '/assets/runtime/backdrops/route-board-laminated-plan-v1.webp'
};

const cardRuntimeArtUrls = import.meta.glob('../assets/runtime/cards/portrait/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const cardThumbRuntimeArtUrls = import.meta.glob('../assets/runtime/cards/thumb/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const cardIconRuntimeArtUrls = import.meta.glob('../assets/runtime/cards/icon/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const cardBorderRuntimeArtUrls = import.meta.glob('../assets/runtime/cards/borders/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const enemyRuntimeArtUrls = import.meta.glob('../assets/runtime/enemies/full/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const reserveEnemyArtUrls = import.meta.glob('../assets/runtime/enemies/reserve/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const flockLeaderRuntimeArtUrls = import.meta.glob('../assets/runtime/flock/leaders/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const waymarkRuntimeArtUrls = import.meta.glob('../assets/runtime/waymarks/icons/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const supplyRuntimeArtUrls = import.meta.glob('../assets/runtime/supplies/icons/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const routeNodeIconRuntimeArtUrls = import.meta.glob('../assets/runtime/map-icons/icons/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const uiIconRuntimeArtUrls = import.meta.glob('../assets/runtime/ui/icons/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function bundledAssetUrl(manifestPath: string, urls: Record<string, string>) {
  return urls[`../${manifestPath}`] ?? `/${manifestPath}`;
}

// Waymarks are the player-facing relic/artifact item pool. Internally the
// save/runtime field remains `routeMarks` for compatibility with existing runs.
const MARKET_ROUTE_MARK_IDS = [...alphaRouteMarkSet.routeMarks]
  .filter((mark) => mark.rarity !== 'boss')
  .map((mark) => mark.id);
const routeMarks: RouteMark[] = MARKET_ROUTE_MARK_IDS.map((id) => {
  const mark = alphaRouteMarkLibrary.get(id);
  return { id, name: mark?.name ?? id, text: mark?.description ?? '', price: MARKET_ROUTE_MARK_PRICE };
});
const HIGH_TIER_ROUTE_MARK_IDS = [...alphaRouteMarkSet.routeMarks]
  .filter((mark) => mark.rarity === 'rare' || mark.rarity === 'boss' || mark.source === 'boss')
  .map((mark) => mark.id);
const ALL_ROUTE_MARK_IDS = [...alphaRouteMarkSet.routeMarks].map((mark) => mark.id);
const WAYMARK_REWARD_CHOICE_COUNT = 3;

const cardArtAssets: Record<string, RuntimeImageAsset> = Object.fromEntries(
  alphaCardArtManifest.cards
    .filter((entry) => entry.status === 'approved')
    .map((entry) => [entry.cardId, {
      key: `card-${entry.cardId}`,
      url: bundledAssetUrl(entry.portrait, cardRuntimeArtUrls)
    }])
);
const cardThumbArtAssets: Record<string, RuntimeImageAsset> = Object.fromEntries(
  alphaCardArtManifest.cards
    .filter((entry) => entry.status === 'approved')
    .map((entry) => [entry.cardId, {
      key: `card-thumb-${entry.cardId}`,
      url: bundledAssetUrl(entry.thumbnail, cardThumbRuntimeArtUrls)
    }])
);
const snagCardBorderAsset: RuntimeImageAsset = {
  key: 'card-border-snag',
  url: bundledAssetUrl('assets/runtime/cards/borders/snag-border.webp', cardBorderRuntimeArtUrls)
};
const enemyArtAssets: Record<string, RuntimeImageAsset> = Object.fromEntries(
  alphaEnemyArtManifest.enemies
    .filter((entry) => entry.status === 'approved')
    .map((entry) => [entry.enemyId, {
      key: `enemy-${entry.enemyId}`,
      url: bundledAssetUrl(entry.full, enemyRuntimeArtUrls)
    }])
);
const reserveEnemyArtAssets: Record<string, RuntimeImageAsset> = Object.fromEntries(
  Object.entries(reserveEnemyArtUrls).map(([path, url]) => {
    const id = path.split('/').pop()?.replace(/\.webp$/, '') ?? path;
    return [id, { key: `reserve-enemy-${id}`, url }];
  })
);
const flockLeaderArtAssets: Record<string, RuntimeImageAsset> = {
  fledgling: {
    key: 'flock-leader-fledgling',
    url: flockLeaderRuntimeArtUrls['../assets/runtime/flock/leaders/fledgling-flock-combat-back-ne.webp']
      ?? '/assets/runtime/flock/leaders/fledgling-flock-combat-back-ne.webp',
  },
  spark_caller: {
    key: 'flock-leader-spark-caller',
    url: flockLeaderRuntimeArtUrls['../assets/runtime/flock/leaders/spark-caller-combat-back-ne.webp']
      ?? '/assets/runtime/flock/leaders/spark-caller-combat-back-ne.webp',
  },
  talon: {
    key: 'flock-leader-talon',
    url: flockLeaderRuntimeArtUrls['../assets/runtime/flock/leaders/talon-combat-back-ne.webp']
      ?? '/assets/runtime/flock/leaders/talon-combat-back-ne.webp',
  },
  tidewarden: {
    key: 'flock-leader-tidewarden',
    url: flockLeaderRuntimeArtUrls['../assets/runtime/flock/leaders/tidewarden-combat-back-ne.webp']
      ?? '/assets/runtime/flock/leaders/tidewarden-combat-back-ne.webp',
  },
  roostkeeper: {
    key: 'flock-leader-roostkeeper',
    url: flockLeaderRuntimeArtUrls['../assets/runtime/flock/leaders/roostkeeper-combat-back-ne.webp']
      ?? '/assets/runtime/flock/leaders/roostkeeper-combat-back-ne.webp',
  },
};
const codexLeaderArtAssets: Record<string, RuntimeImageAsset> = {
  ...flockLeaderArtAssets,
  fledgling: {
    key: 'codex-flock-leader-fledgling-front-3q',
    url: flockLeaderRuntimeArtUrls['../assets/runtime/flock/leaders/fledgling-flock-combat-front-3q.webp']
      ?? '/assets/runtime/flock/leaders/fledgling-flock-combat-front-3q.webp',
  },
  roostkeeper: {
    key: 'codex-flock-leader-roostkeeper-front-3q',
    url: flockLeaderRuntimeArtUrls['../assets/runtime/flock/leaders/roostkeeper-combat-front-3q.webp']
      ?? '/assets/runtime/flock/leaders/roostkeeper-combat-front-3q.webp',
  },
  spark_caller: {
    key: 'codex-flock-leader-spark-caller-front-3q',
    url: flockLeaderRuntimeArtUrls['../assets/runtime/flock/leaders/spark-caller-combat-front-3q.webp']
      ?? '/assets/runtime/flock/leaders/spark-caller-combat-front-3q.webp',
  },
  talon: {
    key: 'codex-flock-leader-talon-front-3q',
    url: flockLeaderRuntimeArtUrls['../assets/runtime/flock/leaders/talon-combat-front-3q.webp']
      ?? '/assets/runtime/flock/leaders/talon-combat-front-3q.webp',
  },
  tidewarden: {
    key: 'codex-flock-leader-tidewarden-front-3q',
    url: flockLeaderRuntimeArtUrls['../assets/runtime/flock/leaders/tidewarden-combat-front-3q.webp']
      ?? '/assets/runtime/flock/leaders/tidewarden-combat-front-3q.webp',
  },
};
const ROUTE_EVENT_RESIDENT_ASSETS: Partial<Record<RouteNode['type'], RuntimeImageAsset>> = {
  basin: routeEventAsset('sella-warmwick-v2.webp', 'route-event-resident-sella-warmwick'),
  cache: routeEventAsset('marn-valeclip-v2.webp', 'route-event-resident-marn-valeclip'),
  signal: routeEventAsset('ivo-tallymast-v2.webp', 'route-event-resident-ivo-tallymast'),
  nest: routeEventAsset('oren-shearbright-v2.webp', 'route-event-resident-oren-shearbright'),
  rival: routeEventAsset('caldra-pinion-v2.webp', 'route-event-resident-caldra-pinion')
};
const ROUTE_SET_PIECE_PROFILES: Partial<Record<RouteNode['type'], {
  residentName: string;
  residentRole: string;
  species: string;
  fashion: string;
  centerpiece: string;
  visitLine: string;
}>> = {
  basin: {
    residentName: 'Sella Warmwick',
    residentRole: 'Lantern Roost Keeper',
    species: 'golden weaver finch',
    fashion: 'insulated roost-host layers, plaid scarf, brass charms, practical winter workwear',
    centerpiece: 'heated brass roost hearth',
    visitLine: 'A warm roost landmark where recovery is treated like careful maintenance.'
  },
  cache: {
    residentName: 'Marn Valeclip',
    residentRole: 'Lockbox Archivist',
    species: 'hooded crow',
    fashion: 'numbered archive coat, wax-tag straps, quiet salvage-office tailoring',
    centerpiece: 'sealed pulley cache cabinet',
    visitLine: 'A hidden stash office where every useful thing has a record.'
  },
  signal: {
    residentName: 'Ivo Tallymast',
    residentRole: 'Wire Cartographer',
    species: 'kestrel',
    fashion: 'signal-runner sash, lens cords, chalk tabs, lean rooftop technician gear',
    centerpiece: 'illuminated switchboard route map',
    visitLine: 'A skyline control post where route information becomes leverage.'
  },
  nest: {
    residentName: 'Oren Shearbright',
    residentRole: 'Featherwright Tailor',
    species: 'pileated woodpecker',
    fashion: 'tailored work smock, measuring cords, lacquered tool pockets, boutique repairwear',
    centerpiece: 'lit grooming chair and feather press',
    visitLine: 'A precise studio where the deck is fitted, repaired, and refined.'
  },
  rival: {
    residentName: 'Caldra Pinion',
    residentRole: 'Velvet Wager Broker',
    species: 'peafowl',
    fashion: 'glossy statement capelet, jewel pins, wager-table evening streetwear',
    centerpiece: 'contract case and prize board',
    visitLine: 'A stylish confrontation where confidence is turned into a bet.'
  }
};
const waymarkArtAssets: Record<string, RuntimeImageAsset> = Object.fromEntries(
  alphaRouteMarkSet.routeMarks.map((mark) => [mark.id, {
    key: `waymark-${mark.id}`,
    url: waymarkRuntimeArtUrls[`../assets/runtime/waymarks/icons/${mark.id}.webp`]
      ?? `/assets/runtime/waymarks/icons/${mark.id}.webp`
  }])
);
const supplyArtAssets: Record<string, RuntimeImageAsset> = Object.fromEntries(
  Object.entries(supplyRuntimeArtUrls).map(([path, url]) => {
    const id = path.split('/').pop()?.replace(/\.webp$/, '') ?? path;
    return [id, { key: `supply-${id}`, url }];
  })
);
const scrapArtAsset: RuntimeImageAsset = {
  key: 'resource-scrap',
  url: supplyRuntimeArtUrls['../assets/runtime/supplies/icons/scrap.webp']
    ?? '/assets/runtime/supplies/icons/scrap.webp'
};
const rewardBadgeArtAssets: Record<string, RuntimeImageAsset> = {
  card: {
    key: 'reward-badge-card',
    url: cardIconRuntimeArtUrls['../assets/runtime/cards/icon/major_00.webp']
      ?? '/assets/runtime/cards/icon/major_00.webp'
  },
  waymark: {
    key: 'reward-badge-waymark',
    url: waymarkRuntimeArtUrls['../assets/runtime/waymarks/icons/roofline_compass.webp']
      ?? '/assets/runtime/waymarks/icons/roofline_compass.webp'
  },
  supply: {
    key: 'reward-badge-supply',
    url: supplyRuntimeArtUrls['../assets/runtime/supplies/icons/spare_pocket.webp']
      ?? '/assets/runtime/supplies/icons/spare_pocket.webp'
  },
  preen: {
    key: 'reward-badge-preen',
    url: waymarkRuntimeArtUrls['../assets/runtime/waymarks/icons/fresh_pinfeather.webp']
      ?? '/assets/runtime/waymarks/icons/fresh_pinfeather.webp'
  },
  heal: {
    key: 'reward-badge-heal',
    url: waymarkRuntimeArtUrls['../assets/runtime/waymarks/icons/basin_charm.webp']
      ?? '/assets/runtime/waymarks/icons/basin_charm.webp'
  },
  scrap: scrapArtAsset
};
function setSupplyArtPixelFilter(scene: Phaser.Scene, key: string) {
  if (!scene.textures.exists(key)) return;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function addSupplyArtImage(scene: Phaser.Scene, x: number, y: number, key: string) {
  setSupplyArtPixelFilter(scene, key);
  return scene.add.image(x, y, key);
}

function addScrapIconImage(scene: Phaser.Scene, x: number, y: number, size: number) {
  if (scene.textures.exists(scrapArtAsset.key)) {
    setSupplyArtPixelFilter(scene, scrapArtAsset.key);
    return scene.add.image(x, y, scrapArtAsset.key)
      .setDisplaySize(size, size);
  }
  return scene.add.circle(x, y, Math.max(4, Math.round(size * 0.24)), 0xd8a840, 0.95);
}

function addRewardBadgeArtImage(scene: Phaser.Scene, badgeId: string, x: number, y: number, size: number) {
  const asset = rewardBadgeArtAssets[badgeId];
  if (!asset || !scene.textures.exists(asset.key)) return undefined;
  scene.textures.get(asset.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return scene.add.image(x, y, asset.key).setDisplaySize(size, size);
}

function setWaymarkArtPixelFilter(scene: Phaser.Scene, key: string) {
  if (!scene.textures.exists(key)) return;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function addWaymarkArtImage(scene: Phaser.Scene, x: number, y: number, key: string) {
  setWaymarkArtPixelFilter(scene, key);
  return scene.add.image(x, y, key);
}

const routeNodeIconAssets: Record<RouteNode['type'], RuntimeImageAsset> = Object.fromEntries(
  (['street', 'rival', 'boss', 'basin', 'nest', 'market', 'signal', 'cache'] as RouteNode['type'][]).map((type) => [type, {
    key: `route-node-${type}`,
    url: routeNodeIconRuntimeArtUrls[`../assets/runtime/map-icons/icons/${type}.webp`]
      ?? `/assets/runtime/map-icons/icons/${type}.webp`
  }])
) as Record<RouteNode['type'], RuntimeImageAsset>;

const uiIconIds = [
  'flock-heart',
  'cover-shield',
  'resonance-battery',
  'wingbeats',
  'scrap-gear',
  'deck-stack',
  'waymark-compass',
  'supply-pouch',
  'market-stock-bin',
  'draw-stack',
  'discard-basket',
  'roost-nest',
  'back-chevron',
  'close-medallion',
  'scroll-up-chevron',
  'scroll-down-chevron',
  'route-pin',
  'market-basket',
  'refresh-ring',
  'preen-kit',
  'release-card',
  'locked-padlock'
] as const;
type UiIconId = typeof uiIconIds[number];
const uiIconAssets: Record<UiIconId, RuntimeImageAsset> = Object.fromEntries(
  uiIconIds.map((id) => [id, {
    key: `ui-icon-${id}`,
    url: uiIconRuntimeArtUrls[`../assets/runtime/ui/icons/${id}.png`]
      ?? `/assets/runtime/ui/icons/${id}.png`
  }])
) as Record<UiIconId, RuntimeImageAsset>;
const UI_ICON_PREVIEW_SCALE = 2.2;

function addUiIconImage(scene: Phaser.Scene, iconId: UiIconId, x: number, y: number, size: number) {
  const asset = uiIconAssets[iconId];
  if (!asset || !scene.textures.exists(asset.key)) return undefined;
  scene.textures.get(asset.key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return scene.add.image(x, y, asset.key).setDisplaySize(size * UI_ICON_PREVIEW_SCALE, size * UI_ICON_PREVIEW_SCALE);
}

type CacheDrawerProfile = {
  drawer: string;
  title: string;
  seal: string;
  note: string;
  tell: string;
  icon: UiIconId;
  accent: number;
};

const CACHE_DRAWER_PROFILES: Record<string, CacheDrawerProfile> = {
  cache_scrap: {
    drawer: '12',
    title: 'Dry Scrap Bundle',
    seal: 'Clean seal',
    note: 'Marn: Counted twice. Dry enough to spend.',
    tell: 'No catch',
    icon: 'scrap-gear',
    accent: 0xd8a840
  },
  cache_supply: {
    drawer: '03',
    title: 'Snack Tin With Warm Latch',
    seal: 'Warm latch',
    note: 'Marn: Useful, but it opens loud.',
    tell: 'Supply + Scrap',
    icon: 'supply-pouch',
    accent: 0xffb86b
  },
  cache_mark: {
    drawer: '19',
    title: 'Rare Chalk Route Tag',
    seal: 'Bad handwriting',
    note: 'Marn: The mark is real. The note bites.',
    tell: 'Rare Waymark + Snag',
    icon: 'waymark-compass',
    accent: 0xc9a6ff
  },
  cache_card: {
    drawer: '27',
    title: 'Rare Nest Note Packet',
    seal: 'Thin paper seal',
    note: 'Marn: Leads to a card. Mind the staple.',
    tell: 'Rare card choice',
    icon: 'deck-stack',
    accent: 0x7ab8d6
  },
  cache_heal: {
    drawer: '08',
    title: 'Billboard Shelter Key',
    seal: 'Quiet seal',
    note: 'Marn: No prize. Just a safe ledge.',
    tell: 'Recover + Sky safety',
    icon: 'flock-heart',
    accent: 0x8fd6a0
  },
  cache_boss_line: {
    drawer: '44',
    title: 'Boss-Safe Pulley Line',
    seal: 'Fresh wire',
    note: 'Marn: Archive says it holds under pressure.',
    tell: '+16 Boss Cover',
    icon: 'cover-shield',
    accent: 0x7ab8d6
  },
  decline: {
    drawer: '00',
    title: 'Leave the Ledger Closed',
    seal: 'No claim filed',
    note: 'Marn: Untouched drawers stay honest.',
    tell: 'Move on',
    icon: 'route-pin',
    accent: 0x49606d
  }
};

function cacheDrawerProfile(choice: NodeChoiceOption, index = 0): CacheDrawerProfile {
  return CACHE_DRAWER_PROFILES[choice.key] ?? {
    drawer: `${index + 1}`.padStart(2, '0'),
    title: choice.text,
    seal: 'Unfiled seal',
    note: 'Marn: Useful things still need a record.',
    tell: routeEffectSummary(choice.effects),
    icon: 'route-pin',
    accent: 0xd8a840
  };
}

function hudIconForLabel(label: string): UiIconId | undefined {
  switch (label) {
    case 'Cohesion': return 'flock-heart';
    case 'Cover': return 'cover-shield';
    case 'Resonance': return 'resonance-battery';
    case 'Wingbeat':
    case 'Wingbeats': return 'wingbeats';
    case 'Scrap': return 'scrap-gear';
    case 'Deck': return 'deck-stack';
    case 'Waymarks': return 'waymark-compass';
    case 'Supplies': return 'supply-pouch';
    default: return undefined;
  }
}

function buttonIconForLabel(label: string): UiIconId | undefined {
  const normalized = label.toLowerCase();
  if (normalized === 'up') return 'scroll-up-chevron';
  if (normalized === 'down') return 'scroll-down-chevron';
  if (normalized.includes('back')) return 'back-chevron';
  if (normalized.includes('take this route')) return 'route-pin';
  if (normalized.includes('refresh') || normalized.includes('new stock')) return 'refresh-ring';
  if (normalized.includes('preen')) return 'preen-kit';
  if (normalized.includes('remove') || normalized.includes('release')) return 'release-card';
  if (normalized.includes('buy') || normalized.includes('market')) return 'market-basket';
  return undefined;
}

function zoneIconForLabel(zone: string): UiIconId {
  if (zone === 'Discard') return 'discard-basket';
  if (zone === 'Hand') return 'deck-stack';
  return 'draw-stack';
}

function roleIconForCard(card: Card | ActiveCardContract): UiIconId {
  if (card.role === 'attack') return 'release-card';
  if (card.role === 'skill') return 'cover-shield';
  return 'deck-stack';
}

function targetIconForTarget(target: TargetType): UiIconId {
  if (target === 'self') return 'flock-heart';
  if (target === 'none') return 'deck-stack';
  if (target === 'allEnemies') return 'release-card';
  if (target === 'choice') return 'route-pin';
  return 'release-card';
}

function statIconForKey(key: string): UiIconId | undefined {
  if (key === 'cohesion' || key === 'regen' || key === 'openSkyGuard') return 'flock-heart';
  if (key === 'cover') return 'cover-shield';
  if (key === 'resonance') return 'resonance-battery';
  if (key === 'wingbeat' || key === 'wingbeats' || key === 'energy') return 'wingbeats';
  if (key === 'draw') return 'deck-stack';
  if (key === 'damage') return 'release-card';
  if (key === 'moltPower') return 'preen-kit';
  return undefined;
}

function marketIconForKicker(kicker: string): UiIconId | undefined {
  const normalized = kicker.toLowerCase();
  if (normalized.includes('waymark')) return 'waymark-compass';
  if (normalized.includes('supply')) return 'supply-pouch';
  if (normalized.includes('preen')) return 'preen-kit';
  if (normalized.includes('remove') || normalized.includes('release')) return 'release-card';
  if (normalized.includes('refresh')) return 'refresh-ring';
  return undefined;
}

function codexIconForLabel(label: string): UiIconId | undefined {
  switch (label) {
    case 'Cards':
    case 'Major':
    case 'Aviary':
      return 'deck-stack';
    case 'Items':
      return 'waymark-compass';
    case 'Glossary':
      return 'deck-stack';
    case 'Leaders':
      return 'flock-heart';
    case 'Enemies':
      return 'release-card';
    case 'Waymarks':
      return 'waymark-compass';
    case 'Supplies':
      return 'supply-pouch';
    case 'Combat':
    case 'Pressure':
      return 'release-card';
    case 'Route':
    case 'Intel':
      return 'route-pin';
    case 'Defense':
      return 'cover-shield';
    case 'Recovery':
      return 'flock-heart';
    case 'Momentum':
      return 'resonance-battery';
    case 'Molt':
      return 'preen-kit';
    case 'Boss':
      return 'locked-padlock';
    default:
      return undefined;
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function stableMotionSeed(id: string): number {
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

// Which district the run is currently in + the run's seed. Scenes set these from
// RunState in init(); all map-relative reads go through currentMap(). The route
// graph is generated procedurally (deterministic per seed), so each run differs.
let activeMapIndex = 0;
let activeSeed = 'alpha';
const generatedMapCache = new Map<string, RuntimeRouteMap>();

function currentMap(): RuntimeRouteMap {
  const blueprint = routeBlueprints[activeMapIndex] ?? routeBlueprints[0];
  const key = `${activeSeed}:${activeMapIndex}`;
  let map = generatedMapCache.get(key);
  if (!map) {
    map = generateRouteMap(blueprint, hashSeed(activeSeed, activeMapIndex));
    generatedMapCache.set(key, map);
  }
  return map;
}

function deterministicChance(key: string, chance: number): boolean {
  if (chance <= 0) return false;
  if (chance >= 1) return true;
  return (hashSeed(key, 0x9e3779b9) / 0xffffffff) < chance;
}

function seededRng(key: string) {
  let state = hashSeed(key, 0x85ebca6b) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function deterministicRankedIds(ids: string[], key: string) {
  return [...new Set(ids)].sort((a, b) => {
    const scoreA = hashSeed(`${key}:${a}`, 0x27d4eb2d);
    const scoreB = hashSeed(`${key}:${b}`, 0x27d4eb2d);
    return scoreA - scoreB || a.localeCompare(b);
  });
}

function priceInBand(band: MarketPriceBand, rarityStep = 0, districtStep = activeMapIndex) {
  const scaled = band.base + rarityStep * 18 + districtStep * 8;
  return Math.round(clamp(scaled, band.min, band.max));
}

function runSupplyCapacity(runState: Pick<RunState, 'supplySlots'>) {
  return Math.max(BASE_SUPPLY_SLOTS, runState.supplySlots ?? BASE_SUPPLY_SLOTS);
}

function cardRarityStep(rarity: CardRarity) {
  if (rarity === 'legendary') return 3;
  if (rarity === 'rare') return 2;
  if (rarity === 'uncommon') return 1;
  return 0;
}

function routeMarkRarityStep(rarity: RouteMarkRarity) {
  if (rarity === 'boss') return 3;
  if (rarity === 'rare') return 2;
  if (rarity === 'uncommon') return 1;
  return 0;
}

function supplyRarityStep(rarity: RuntimeSupply['rarity']) {
  if (rarity === 'rare') return 2;
  if (rarity === 'uncommon') return 1;
  return 0;
}

const MARKET_SUPPLY_PROXY_MARKS: Record<string, string> = {
  seed_packet: 'basin_charm',
  signal_flare: 'bright_bottlecap',
  zip_tie_roll: 'scaffold_knot',
  bottlecap_popper: 'bright_bottlecap',
  tar_solvent: 'blue_cup_token',
  feather_splint: 'feather_tape',
  mirror_shard: 'parade_mirror',
  emergency_call: 'signal_whistle',
  shade_cloth: 'tin_roof_shade',
  rooftop_decoy: 'stage_pin',
  molt_pin: 'sunbreak_lens',
  wire_snips: 'wire_map',
  spare_harness: 'sky_safe_harness',
  signal_kite: 'razor_kite_tail',
  storm_lantern: 'rooftop_relay_bell',
  cache_key: 'cache_hook',
  rain_cape: 'borrowed_raincoat'
};

function battlefieldVariantForRouteNode(routeNode?: RouteNode): RuntimeImageAsset | undefined {
  if (routeNode?.type === 'boss') return BATTLEFIELD_BOSS_VARIANTS[currentMap().id];
  return undefined;
}

function currentBattlefieldAsset(routeNode?: RouteNode): RuntimeImageAsset {
  return battlefieldVariantForRouteNode(routeNode) ?? BATTLEFIELD_ASSETS[currentMap().id] ?? DEFAULT_BATTLEFIELD_ASSET;
}

function currentCombatNodes(): RouteNode[] {
  return currentMap().nodes.filter((node) => ['street', 'rival', 'boss'].includes(node.type));
}

function currentCombatNodeIds(): Set<string> {
  return new Set(currentCombatNodes().map((node) => node.id));
}

const cardLibrary: Record<string, Card> = Object.fromEntries(
  alphaCardSet.cards.map((card) => [card.id, createCardTemplate(card)])
);

const arcanaRewardPool = alphaCardSet.rewardPool;

class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.image('splash', splashUrl);
    this.load.image(ROUTE_MAP_BACKDROP_ASSET.key, ROUTE_MAP_BACKDROP_ASSET.url);
    this.load.image(ROUTE_MAP_BACKING_ASSET.key, ROUTE_MAP_BACKING_ASSET.url);
    this.load.image('title-bird', titleBirdUrl);
    this.load.image('title-squad', titleSquadUrl);
    this.load.spritesheet(COMBAT_FX_TEXTURE, combatFxAtlasUrl, { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet(COMBAT_ATMOSPHERE_TEXTURE, combatAtmosphereUrl, { frameWidth: 256, frameHeight: 96 });
    Object.values(uiIconAssets).forEach((asset) => {
      if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.url);
    });
  }

  create() {
    document.getElementById('boot-shell')?.remove();
    this.scene.start('MenuScene');
  }
}

class MenuScene extends Phaser.Scene {
  private selectedLeaderId = defaultLeaderId;
  private leaderPanels: Array<{ id: string; rect: Phaser.GameObjects.Rectangle; unlocked: boolean }> = [];
  private leaderTooltip?: Phaser.GameObjects.Container;
  private menuAccount: PlayerAccount = loadAccount();
  private selectedDifficulty = 0;
  private difficultyLabelText?: Phaser.GameObjects.Text;
  private difficultyDescText?: Phaser.GameObjects.Text;

  constructor() {
    super('MenuScene');
  }

  create() {
    window.render_game_to_text = () => JSON.stringify({
      mode: 'menu',
      scene: 'MenuScene',
      prompt: 'Click Start Run to select a route.'
    });

    this.cameras.main.fadeIn(220);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(1);

    this.createHomeParticles();
    this.createAnimatedTitle();

    // Keep difficulty near the run action without adding a full-width dock, so
    // the splash art stays visible behind the compact controls.
    this.selectedDifficulty = Math.min(this.selectedDifficulty, getMaxUnlockedTier());
    this.add.rectangle(228, 642, 314, 102, 0x05070c, 0.68)
      .setStrokeStyle(MENU_BORDER_WIDTH, MENU_BORDER_COLOR, 0.64);
    this.add.text(122, 600, 'ASCENSION', {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: '#dce8f2',
      stroke: '#05070c',
      strokeThickness: 2,
    }).setResolution(2).setOrigin(0.5);
    const dec = this.add.rectangle(100, 632, 26, 28, 0x0d1420, 0.9)
      .setStrokeStyle(MENU_BORDER_WIDTH, MENU_BORDER_COLOR, 0.86).setInteractive({ useHandCursor: true });
    dec.on('pointerdown', () => this.stepDifficulty(-1));
    this.add.text(100, 631, '<', { fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: '#eef7ff', stroke: '#05070c', strokeThickness: 1 }).setResolution(2).setOrigin(0.5);
    const inc = this.add.rectangle(356, 632, 26, 28, 0x0d1420, 0.9)
      .setStrokeStyle(MENU_BORDER_WIDTH, MENU_BORDER_COLOR, 0.86).setInteractive({ useHandCursor: true });
    inc.on('pointerdown', () => this.stepDifficulty(1));
    this.add.text(356, 631, '>', { fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: '#eef7ff', stroke: '#05070c', strokeThickness: 1 }).setResolution(2).setOrigin(0.5);
    this.difficultyLabelText = this.add.text(228, 630, '', {
      fontFamily: UI_FONT, fontSize: '18px', fontStyle: UI_BOLD, color: '#ffd76a', stroke: '#05070c', strokeThickness: 2
    }).setResolution(2).setOrigin(0.5);
    this.difficultyDescText = this.add.text(228, 663, '', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      color: '#dce7f2',
      align: 'center',
      stroke: '#05070c',
      strokeThickness: 2,
      wordWrap: { width: 304 }
    }).setResolution(2).setOrigin(0.5);
    this.difficultyDescText.setLineSpacing(2);
    this.updateDifficultyText();

    this.menuAccount = loadAccount();
    if (!isLeaderUnlocked(this.menuAccount, this.selectedLeaderId)) this.selectedLeaderId = defaultLeaderId;
    this.add.text(GAME_WIDTH / 2, 470, 'Choose your Flock Leader', {
      fontFamily: UI_FONT,
      fontSize: '14px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      stroke: '#05070c',
      strokeThickness: 2,
    }).setResolution(2).setOrigin(0.5);
    this.leaderPanels = [];
    flockLeaders.forEach((leader, index) => {
      const px = 178 + index * 231;
      const py = 516;
      const unlocked = isLeaderUnlocked(this.menuAccount, leader.id);
      const rect = this.add.rectangle(px, py, 196, 60, unlocked ? 0x0d1420 : 0x0a0e15, unlocked ? 0.93 : 0.86)
        .setStrokeStyle(MENU_BORDER_WIDTH, unlocked ? 0x2a4555 : 0x222a33, 0.9)
        .setInteractive({ useHandCursor: unlocked });
      rect.on('pointerover', () => this.showLeaderTooltip(leader.id, px));
      rect.on('pointerout', () => this.hideLeaderTooltip());
      if (unlocked) {
        rect.on('pointerdown', () => {
          this.selectLeader(leader.id);
          this.showLeaderTooltip(leader.id, px);
        });
      }
      this.add.text(px, py - 17, leader.name, {
        fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: unlocked ? '#ffe1a3' : '#5a6675', align: 'center', stroke: '#05070c', strokeThickness: 1, wordWrap: { width: 184 }
      }).setResolution(2).setOrigin(0.5);
      const detail = unlocked
        ? `${leader.suit} - ${leader.bird}\n${leader.signatureName}`
        : `Locked\n${leaderUnlockHints[leader.id] ?? 'Locked'}`;
      const detailText = this.add.text(px, py + 15, detail, {
        fontFamily: UI_FONT,
        fontSize: '10px',
        color: unlocked ? '#dce7f2' : '#8895a5',
        align: 'center',
        stroke: '#05070c',
        strokeThickness: 1,
        wordWrap: { width: 184 }
      }).setResolution(2).setOrigin(0.5);
      detailText.setLineSpacing(2);
      this.leaderPanels.push({ id: leader.id, rect, unlocked });
    });
    this.selectLeader(this.selectedLeaderId);

    const savedRun = hasActiveRun();
    if (savedRun) {
      this.makeMenuButton(676, 642, 252, 42, 'Continue Run', 0xe8b830, '20px', () => this.continueRun());
      this.makeMenuButton(962, 642, 204, 36, 'Start New Run', 0x7ab8d6, '15px', () => this.startRun());
    } else {
      this.makeMenuButton(780, 642, 286, 46, 'Start Run', 0xd8a840, '24px', () => this.startRun());
    }
    this.input.keyboard?.on('keydown-ENTER', () => (savedRun ? this.continueRun() : this.startRun()));

    const profile = this.add.rectangle(GAME_WIDTH - 92, 38, 136, 38, 0x0d1420, 0.9)
      .setStrokeStyle(MENU_BORDER_WIDTH, MENU_BORDER_COLOR, 0.9).setInteractive({ useHandCursor: true });
    profile.on('pointerover', () => profile.setFillStyle(0x1b2535, 0.96));
    profile.on('pointerout', () => profile.setFillStyle(0x0d1420, 0.92));
    profile.on('pointerdown', () => this.scene.start('ProfileScene'));
    this.add.text(GAME_WIDTH - 92, 38, 'Flock Record', {
      fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: '#dce8f2'
    }).setResolution(2).setOrigin(0.5);

    const codex = this.add.rectangle(GAME_WIDTH - 240, 38, 136, 38, 0x0d1420, 0.9)
      .setStrokeStyle(MENU_BORDER_WIDTH, MENU_BORDER_COLOR, 0.9).setInteractive({ useHandCursor: true });
    codex.on('pointerover', () => codex.setFillStyle(0x1b2535, 0.96));
    codex.on('pointerout', () => codex.setFillStyle(0x0d1420, 0.92));
    codex.on('pointerdown', () => this.scene.start('CodexScene'));
    this.add.text(GAME_WIDTH - 240, 38, 'Codex', {
      fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: '#dce8f2'
    }).setResolution(2).setOrigin(0.5);
  }

  private stepDifficulty(delta: number) {
    this.selectedDifficulty = Math.max(0, Math.min(getMaxUnlockedTier(), this.selectedDifficulty + delta));
    this.updateDifficultyText();
  }

  private updateDifficultyText() {
    this.difficultyLabelText?.setText(difficultyLabel(this.selectedDifficulty));
    const locked = this.selectedDifficulty >= getMaxUnlockedTier() && this.selectedDifficulty < MAX_DIFFICULTY;
    this.difficultyDescText?.setText(
      `${difficultyAdds(this.selectedDifficulty)}\n${this.difficultyStatLine()}${locked ? '\nWin this tier to unlock the next.' : ''}`,
    );
  }

  private difficultyStatLine() {
    const mods = difficultyMods(this.selectedDifficulty);
    return `Mods: Cohesion x${mods.enemyHpMult.toFixed(2)} | Rewards ${mods.rewardChoices} | Hit +${mods.enemyDamageBonus} | Open Sky +${mods.openSkyBonus}`;
  }

  private makeMenuButton(x: number, y: number, w: number, h: number, text: string, color: number, fontSize: string, onClick: () => void) {
    const panel = this.add.rectangle(x, y, w, h, 0x0d1420, 0.92)
      .setStrokeStyle(MENU_BORDER_WIDTH, color, 0.95)
      .setInteractive({ useHandCursor: true });
    const label = this.add.text(x, y, text, {
      fontFamily: UI_FONT, fontSize, fontStyle: UI_BOLD, color: UI_GOLD, stroke: '#111111', strokeThickness: 2
    }).setResolution(2).setOrigin(0.5);
    panel.on('pointerover', () => { panel.setFillStyle(0x1b2535, 0.96); label.setColor('#ffffff'); });
    panel.on('pointerout', () => { panel.setFillStyle(0x0d1420, 0.92); label.setColor('#ffe1a3'); });
    panel.on('pointerdown', onClick);
  }

  private ensureHomeParticleTexture() {
    if (this.textures.exists(MENU_SOFT_MOTE_TEXTURE)) return;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.08);
    g.fillCircle(32, 32, 30);
    g.fillStyle(0xffffff, 0.12);
    g.fillCircle(32, 32, 22);
    g.fillStyle(0xffffff, 0.22);
    g.fillCircle(32, 32, 13);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(32, 32, 5);
    g.generateTexture(MENU_SOFT_MOTE_TEXTURE, 64, 64);
    g.destroy();
  }

  private createHomeParticles() {
    if (prefersReducedMotion()) return;
    this.ensureHomeParticleTexture();
    const source = {
      getRandomPoint: (point: Phaser.Types.Math.Vector2Like) => {
        point.x = Phaser.Math.Between(44, GAME_WIDTH - 44);
        point.y = Phaser.Math.Between(GAME_HEIGHT - 82, GAME_HEIGHT + 30);
      },
    };
    const emitter = this.add.particles(0, 0, MENU_SOFT_MOTE_TEXTURE, {
      emitZone: {
        type: 'random',
        source,
      },
      frequency: 320,
      quantity: 1,
      lifespan: { min: 10500, max: 16000 },
      radial: false,
      speedX: { min: -11, max: 11 },
      speedY: { min: -40, max: -16 },
      accelerationY: { min: -1.6, max: -0.3 },
      scale: { start: 0.19, end: 0.58, ease: 'Sine.easeOut' },
      alpha: { start: 0.36, end: 0, ease: 'Sine.easeIn' },
      rotate: { min: -14, max: 14 },
      tint: [0x8df4ff, 0xf1c24c, 0xdce8f2],
      blendMode: Phaser.BlendModes.ADD,
      maxAliveParticles: 36,
      reserve: 36,
      advance: 10000,
    });
  }

  private continueRun() {
    const saved = loadActiveRun();
    if (!saved) { this.startRun(); return; }
    this.scene.start('RouteScene', { runState: saved });
  }

  private selectLeader(id: string) {
    const target = this.leaderPanels.find((entry) => entry.id === id);
    if (target && !target.unlocked) return; // can't pick a locked Leader
    this.selectedLeaderId = id;
    this.leaderPanels.forEach((entry) => {
      if (!entry.unlocked) return; // locked panels keep their dimmed style
      const selected = entry.id === id;
      entry.rect.setStrokeStyle(MENU_BORDER_WIDTH, selected ? 0xe8b830 : 0x2a4555, selected ? 1 : 0.9);
      entry.rect.setFillStyle(selected ? 0x1b2535 : 0x0d1420, selected ? 0.96 : 0.92);
    });
    const leader = getLeader(id);
  }

  private showLeaderTooltip(id: string, anchorX: number) {
    this.hideLeaderTooltip();
    const leader = getLeader(id);
    const unlocked = isLeaderUnlocked(this.menuAccount, leader.id);
    const tooltipX = Phaser.Math.Clamp(anchorX, 328, GAME_WIDTH - 328);
    const tooltipY = 404;
    const tooltip = this.add.container(tooltipX, tooltipY).setDepth(100);
    const bg = this.add.rectangle(0, 0, 640, unlocked ? 88 : 72, 0x05070c, 0.86)
      .setStrokeStyle(2, unlocked ? 0xe8b830 : 0x7ab8d6, unlocked ? 0.9 : 0.68);
    const title = this.add.text(0, unlocked ? -30 : -20, unlocked
      ? `${leader.name} - ${leader.suit} / ${leader.bird}`
      : `${leader.name} - Locked`, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: unlocked ? '#ffe1a3' : '#9fb1c4',
      align: 'center',
      wordWrap: { width: 600 },
    }).setOrigin(0.5);
    const body = this.add.text(0, unlocked ? 6 : 14, unlocked
      ? `${leader.blurb}\nSignature: ${leader.signatureName} - ${leader.signatureText}`
      : leaderUnlockHints[leader.id] ?? 'Locked', {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      fontStyle: unlocked ? 'italic' : '',
      color: unlocked ? '#dce7f2' : '#9fb1c4',
      align: 'center',
      stroke: '#05070c',
      strokeThickness: 2,
      wordWrap: { width: 584 },
    }).setOrigin(0.5);
    body.setLineSpacing(2);
    tooltip.add([bg, title, body]);
    this.leaderTooltip = tooltip;
  }

  private hideLeaderTooltip() {
    this.leaderTooltip?.destroy(true);
    this.leaderTooltip = undefined;
  }

  private startRun() {
    this.scene.start('RouteScene', { runState: createInitialRunState(this.selectedLeaderId, this.selectedDifficulty) });
  }

  private createAnimatedTitle() {
    const logo = this.add.container(GAME_WIDTH / 2, -224)
      .setAlpha(0)
      .setAngle(-2.5);

    const bird = this.add.image(-10, -54, 'title-bird')
      .setDisplaySize(284, 136)
      .setOrigin(0.5)
      .setAlpha(0);
    const squad = this.add.image(6, 43, 'title-squad')
      .setDisplaySize(315, 125)
      .setOrigin(0.5)
      .setAlpha(0);
    logo.add([bird, squad]);

    this.tweens.add({
      targets: logo,
      y: 136,
      alpha: 1,
      angle: 0,
      scaleX: { from: 0.86, to: 1 },
      scaleY: { from: 1.05, to: 1 },
      duration: 760,
      ease: 'Cubic.easeIn',
      onComplete: () => this.playTitleImpact(logo)
    });

    this.tweens.add({
      targets: bird,
      alpha: 1,
      y: -51,
      duration: 260,
      delay: 180,
      ease: 'Sine.easeOut'
    });

    this.tweens.add({
      targets: squad,
      alpha: 1,
      y: 38,
      duration: 260,
      delay: 250,
      ease: 'Sine.easeOut'
    });
  }

  private playTitleImpact(logo: Phaser.GameObjects.Container) {
    const finalX = logo.x;

    this.tweens.add({
      targets: logo,
      x: { from: finalX - 7, to: finalX },
      scaleX: { from: 1.1, to: 1 },
      scaleY: { from: 0.88, to: 1 },
      duration: 180,
      ease: 'Back.easeOut'
    });

    this.time.delayedCall(70, () => this.burstGoldFlecks(logo));
  }

  private burstGoldFlecks(logo: Phaser.GameObjects.Container) {
    for (let i = 0; i < 42; i += 1) {
      const angle = Phaser.Math.DegToRad(-172 + i * 8.4 + Phaser.Math.Between(-8, 8));
      const distance = Phaser.Math.Between(120, 360);
      const startX = Phaser.Math.Between(-90, 120);
      const startY = Phaser.Math.Between(-44, 58);
      const fleck = this.add.rectangle(startX, startY, Phaser.Math.Between(5, 18), Phaser.Math.Between(2, 5), 0xf1c24c, 1)
        .setAngle(Phaser.Math.Between(-28, 28))
        .setAlpha(0.95);
      logo.add(fleck);

      this.tweens.add({
        targets: fleck,
        x: startX + Math.cos(angle) * distance,
        y: startY + Math.sin(angle) * distance * 0.48,
        alpha: 0,
        scaleX: 0.15,
        scaleY: 0.15,
        angle: fleck.angle + Phaser.Math.Between(-110, 110),
        duration: Phaser.Math.Between(520, 860),
        ease: 'Cubic.easeOut',
        onComplete: () => fleck.destroy()
      });
    }
  }
}

// Meta-progression profile: lifetime stats, Leader unlocks, and achievements.
class ProfileScene extends Phaser.Scene {
  constructor() {
    super('ProfileScene');
  }

  create() {
    this.cameras.main.fadeIn(200);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.5);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.66);

    const account = loadAccount();
    this.add.text(GAME_WIDTH / 2, 48, 'Flock Record', {
      fontFamily: 'Georgia, serif', fontSize: '40px', fontStyle: UI_BOLD, color: UI_GOLD, stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5);

    const winRate = account.runs > 0 ? Math.round((account.wins / account.runs) * 100) : 0;
    const chips: Array<[string, string]> = [
      ['Runs', `${account.runs}`],
      ['Wins', `${account.wins}`],
      ['Win Rate', `${winRate}%`],
      ['Best Ascension', account.bestWinTier >= 0 ? difficultyLabel(account.bestWinTier) : 'None yet'],
      ['Fastest Win', account.fastestWinTurns === null ? '—' : `${account.fastestWinTurns} beats`],
    ];
    chips.forEach((chip, index) => {
      const cx = 152 + index * 244;
      this.add.rectangle(cx, 116, 226, 64, 0x0d1420, 0.94).setStrokeStyle(2, 0x2a4555, 0.9);
      this.add.text(cx, 100, chip[0], { fontFamily: UI_FONT, fontSize: '13px', color: UI_MUTED }).setOrigin(0.5);
      this.add.text(cx, 126, chip[1], { fontFamily: UI_FONT, fontSize: '19px', fontStyle: UI_BOLD, color: UI_GOLD }).setOrigin(0.5);
    });

    this.add.text(120, 184, 'Flock Leaders', { fontFamily: UI_FONT, fontSize: '20px', fontStyle: UI_BOLD, color: UI_GOLD });
    flockLeaders.forEach((leader, index) => {
      const y = 226 + index * 46;
      const unlocked = isLeaderUnlocked(account, leader.id);
      this.add.rectangle(330, y + 12, 460, 40, index % 2 === 0 ? 0x121c2b : 0x0e1623, 0.9).setStrokeStyle(1, 0x223247, 0.8);
      this.add.text(118, y, leader.name, { fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: unlocked ? '#ffe1a3' : '#5a6675' });
      const wins = account.winsByLeader[leader.id] ?? 0;
      this.add.text(540, y, unlocked ? `${wins} ${wins === 1 ? 'win' : 'wins'}` : 'Locked', {
        fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: unlocked ? '#8df4ff' : '#6f7d8c'
      }).setOrigin(1, 0);
    });

    const earned = account.achievements;
    this.add.text(640, 184, `Achievements  (${earned.length}/${achievements.length})`, { fontFamily: UI_FONT, fontSize: '20px', fontStyle: UI_BOLD, color: UI_GOLD });
    achievements.forEach((ach, index) => {
      const y = 226 + index * 46;
      const got = earned.includes(ach.id);
      this.add.rectangle(940, y + 14, 600, 42, index % 2 === 0 ? 0x121c2b : 0x0e1623, 0.9).setStrokeStyle(1, 0x223247, 0.8);
      this.add.text(648, y, `${got ? '★' : '○'} ${ach.name}`, { fontFamily: UI_FONT, fontSize: '15px', fontStyle: UI_BOLD, color: got ? '#ffe07a' : '#6f7d8c' });
      this.add.text(648, y + 19, ach.desc, { fontFamily: UI_FONT, fontSize: '12px', color: got ? '#cdd9e6' : '#5a6675' });
    });

    const back = this.add.rectangle(GAME_WIDTH / 2, 680, 240, 48, 0x122235, 0.98).setStrokeStyle(2, 0xd8a840, 1).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('MenuScene'));
    this.add.text(GAME_WIDTH / 2, 680, 'Back', { fontFamily: UI_FONT, fontSize: '20px', fontStyle: UI_BOLD, color: UI_GOLD }).setOrigin(0.5);
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MenuScene'));
  }
}

type CodexSection = 'cards' | 'items' | 'glossary' | 'leaders' | 'enemies';
type CodexEnemySource = 'encounter' | 'reserve';
type CodexItemEntry =
  | { kind: 'waymark'; id: string; mark: RuntimeRouteMark }
  | { kind: 'supply'; id: string; supply: RuntimeSupply };
type CodexItemTab = { label: string; match: (item: CodexItemEntry) => boolean };
type CodexGlossaryTerm = CodexDataModule['codexGlossaryTerms'][number];

interface CodexEnemyEntry {
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
  moveKit: string[];
  source: CodexEnemySource;
  health?: number;
}

// Codex: a collection screen reachable from the menu. Cards stay discovery
// gated; reserve enemy concepts are browsable as a design/bestiary section.
class CodexScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private activeSection: CodexSection = 'cards';
  private activeTab = 0;
  private activeEnemyTab = 0;
  private activeItemTypeTab = 0;
  private activeItemFilterTab = 0;
  private discovered = new Set<string>();
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
  private codexDataLoad?: Promise<void>;
  private codexDataFailed = false;
  private textureBoundsCache = new Map<string, TextureVisibleBounds>();
  private static readonly GRID_TOP = 158;
  private static readonly ITEM_GRID_TOP = 190;
  private static readonly GRID_BOTTOM = 690;
  private readonly tabs: Array<{ label: string; match: (c: Card) => boolean }> = [
    { label: 'Major', match: (c) => c.id.startsWith('major_') },
    { label: 'Aviary', match: (c) => c.id.startsWith('aviary_') },
    { label: 'Plumes', match: (c) => c.runtime.suit === 'plumes' },
    { label: 'Quills', match: (c) => c.runtime.suit === 'quills' },
    { label: 'Basins', match: (c) => c.runtime.suit === 'basins' },
    { label: 'Nests', match: (c) => c.runtime.suit === 'nests' },
    { label: 'Snags', match: (c) => c.runtime.kind === 'snag' },
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
    { label: 'Intel', match: (item) => item.kind === 'supply' && item.supply.answerType === 'tellControl' },
  ];
  private get glossaryTerms(): CodexGlossaryTerm[] {
    return this.codexData?.codexGlossaryTerms ?? [];
  }

  constructor() {
    super('CodexScene');
  }

  private get activeItemTab() {
    if (this.activeItemTypeTab === 2) return 1;
    if (this.activeItemTypeTab === 1) return 2;
    return 0;
  }

  private set activeItemTab(value: number) {
    // Legacy smoke/debug hook: old tab indexes were 1 = Supplies, 2 = Waymarks.
    this.activeItemTypeTab = value === 1 ? 2 : value === 2 ? 1 : 0;
    this.activeItemFilterTab = 0;
  }

  create() {
    this.cameras.main.fadeIn(180);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.32);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.82);
    this.root = this.add.container(0, 0);
    this.discovered = new Set(loadAccount().discoveredCards);
    void this.ensureCodexData();
    queueRuntimeImageAssets(this, Object.values(uiIconAssets), 'Codex UI icon failed to load', () => this.renderAll());
    this.queueArt();
    this.renderAll();
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.detailId) this.closeCodexDetail();
      else this.scene.start('MenuScene');
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

  private openCodexDetail(id: string) {
    this.detailId = id;
    this.detailScroll = 0;
    this.detailScrollTarget = 0;
    this.renderAll();
  }

  private closeCodexDetail() {
    this.detailId = undefined;
    this.detailScroll = 0;
    this.detailScrollTarget = 0;
    this.renderAll();
  }

  private allCards(): Card[] {
    return Object.values(cardLibrary);
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
      moveKit: enemy.moves.map((move) => `${move.label}: ${move.effects.join(', ')}`),
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
    return this.activeSection === 'items' ? CodexScene.ITEM_GRID_TOP : CodexScene.GRID_TOP;
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

  private ensureCodexData() {
    if (this.codexData) return Promise.resolve();
    this.codexDataFailed = false;
    this.codexDataLoad ??= import('./game/codex-data')
      .then((data) => {
        this.codexData = data;
        this.codexDataFailed = false;
        this.renderAll();
      })
      .catch((error) => {
        this.codexDataFailed = true;
        console.warn('Codex data failed to load', error);
        this.renderAll();
      });
    return this.codexDataLoad;
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
    const cards = this.allCards().filter(this.tabs[this.activeTab].match).sort((a, b) => a.id.localeCompare(b.id));
    const items = this.currentCodexItems();
    const leaders = this.allLeaders();
    const enemies = this.currentCodexEnemies();
    const source = this.activeSection === 'items'
      ? this.visibleGridEntries(items, 4, 176).map((item) => item.kind === 'waymark' ? waymarkArtAssets[item.id] : supplyArtAssets[item.id])
      : this.activeSection === 'leaders'
        ? this.visibleGridEntries(leaders, 3, 238).map((leader) => codexLeaderArtAssets[leader.id])
        : this.activeSection === 'enemies'
          ? this.visibleGridEntries(enemies, 4, 228).map((enemy) => this.enemyArtAsset(enemy))
          : this.activeSection === 'glossary'
            ? []
            : this.visibleGridEntries(cards, 5, 286)
            .filter((c) => this.discovered.has(c.id))
            .map((c) => cardCompactArtAsset(c));
    queueRuntimeImageAssets(this, [...source, this.currentDetailArtAsset()], 'Codex art failed to load', () => this.renderAll());
  }

  private renderAll() {
    hideKwTooltip();
    killTweensForTree(this, this.root);
    this.root.removeAll(true);
    this.gridLayer = undefined;
    this.queueArt();
    const all = this.allCards();
    const found = all.filter((c) => this.discovered.has(c.id)).length;
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
    window.render_game_to_text = () => JSON.stringify({
      mode: 'codex',
      section: this.activeSection,
      cardsDiscovered: found,
      cardsTotal: all.length,
      itemCount: itemAll.length,
      leaderCount: leaders.length,
      enemyCount: enemyAll.length,
      glossaryTerms: this.activeSection === 'glossary'
        ? glossaryTerms.map((term) => term.term)
        : undefined,
    });

    // 1) Scrollable grid. Drawn FIRST so the
    //    header/footer curtains below can hide anything scrolled out of view
    //    (WebGL doesn't support geometry masks, so we clip with opaque strips).
    const cardMode = this.activeSection === 'cards';
    const itemMode = this.activeSection === 'items';
    const leaderMode = this.activeSection === 'leaders';
    const cards = cardMode
      ? this.allCards().filter(this.tabs[this.activeTab].match).sort((a, b) => a.id.localeCompare(b.id))
      : [];
    const glossaryMode = this.activeSection === 'glossary';
    const cols = cardMode ? 5 : leaderMode ? 3 : glossaryMode ? 2 : 4;
    const cellW = cardMode ? 202 : leaderMode ? 360 : glossaryMode ? 580 : 274;
    const cellH = cardMode ? 286 : itemMode ? 176 : leaderMode ? 238 : glossaryMode ? 94 : 228;
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

    // 2) Curtains hide grid overflow above/below the viewport.
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, top / 2, GAME_WIDTH, top, 0x070a11, 1));
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, (bottom + GAME_HEIGHT) / 2, GAME_WIDTH, GAME_HEIGHT - bottom, 0x070a11, 1));

    // 3) Header (title / counter / Back / tabs) on top of the curtain.
    const headerH = itemMode ? 188 : 156;
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, headerH / 2, GAME_WIDTH, headerH, 0x08111e, 0.96));
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, headerH - 6, GAME_WIDTH - 80, 2, 0x1b2c3e, 0.82));
    this.root.add(this.add.rectangle(838, 42, 486, 54, 0x05080e, 0.64).setStrokeStyle(1, 0x22364d, 0.72));
    this.root.add(this.add.text(40, 24, 'Codex', { fontFamily: 'Georgia, serif', fontSize: '34px', fontStyle: UI_BOLD, color: UI_GOLD, stroke: '#000000', strokeThickness: 4 }));
    const subtitle = cardMode
      ? `${found} / ${all.length} cards discovered`
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

    const back = this.add.rectangle(GAME_WIDTH - 86, 42, 140, 44, 0x122235, 0.96).setStrokeStyle(2, 0xd8a840, 1).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('MenuScene'));
    this.root.add(back);
    this.root.add(this.add.text(GAME_WIDTH - 86, 42, 'Back', { fontFamily: UI_FONT, fontSize: '18px', fontStyle: UI_BOLD, color: UI_GOLD }).setOrigin(0.5));

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
    ([
      ['cards', 'Cards'],
      ['items', 'Items'],
      ['leaders', 'Leaders'],
      ['enemies', 'Enemies'],
      ['glossary', 'Glossary'],
    ] as Array<[CodexSection, string]>).forEach(([section, label], i) => {
      const tx = 568 + i * 110;
      const active = section === this.activeSection;
      this.renderCodexTab(tx, 42, 104, 42, label, sectionMeta[section], active, sectionAccent[section], () => {
        this.activeSection = section;
        this.detailId = undefined;
        this.resetCodexScroll();
        this.renderAll();
      }, 14);
    });

    if (cardMode) {
      this.tabs.forEach((tab, i) => {
        const tx = 64 + i * 124;
        const active = i === this.activeTab;
        const tabCards = this.allCards().filter(tab.match);
        const got = tabCards.filter((c) => this.discovered.has(c.id)).length;
        const sampleCard = tabCards[0];
        const accent = sampleCard ? this.cardAccent(sampleCard) : 0x7ab8d6;
        this.renderCodexTab(tx, 116, 116, 40, tab.label, `${got}/${tabCards.length}`, active, accent, () => {
          this.activeTab = i; this.detailId = undefined; this.resetCodexScroll(); this.renderAll();
        }, 13);
      });
    } else if (itemMode) {
      this.itemTypeTabs.forEach((tab, i) => {
        const tx = 72 + i * 132;
        const active = i === this.activeItemTypeTab;
        const tabItems = this.allCodexItems().filter(tab.match);
        const accent = tab.label === 'Supplies' ? 0xffb86b : tab.label === 'Waymarks' ? 0xc9a6ff : 0xd8a840;
        this.renderCodexTab(tx, 102, 120, 32, tab.label, `${tabItems.length}`, active, accent, () => {
          this.activeItemTypeTab = i; this.activeItemFilterTab = 0; this.detailId = undefined; this.resetCodexScroll(); this.renderAll();
        }, 11);
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
        this.renderCodexTab(tx, 144, 100, 30, tab.label, `${tabItems.length}`, active, accent, () => {
          this.activeItemFilterTab = i; this.detailId = undefined; this.resetCodexScroll(); this.renderAll();
        }, 10);
      });
    } else if (!leaderMode && !glossaryMode) {
      this.enemyTabs.forEach((tab, i) => {
        const tx = 72 + i * 150;
        const active = i === this.activeEnemyTab;
        const tabEnemies = this.allCodexEnemies().filter(tab.match);
        const accent = tabEnemies[0] ? this.enemyAccent(tabEnemies[0]) : 0x7ab8d6;
        this.renderCodexTab(tx, 116, 140, 40, tab.label, `${tabEnemies.length}`, active, accent, () => {
          this.activeEnemyTab = i; this.detailId = undefined; this.resetCodexScroll(); this.renderAll();
        }, 13);
      });
    }

    if (this.gridMaxScroll > 0) {
      this.root.add(this.add.text(GAME_WIDTH - 30, bottom + 6, this.gridScroll < this.gridMaxScroll ? 'scroll v' : '^ scroll', {
        fontFamily: UI_FONT, fontSize: '12px', fontStyle: UI_BOLD, color: '#7f93a8'
      }).setOrigin(1, 0));
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
  ) {
    const fill = active ? 0x1d3047 : 0x0d1420;
    const rect = this.add.rectangle(x, y, w, h, fill, active ? 1 : 0.9)
      .setStrokeStyle(active ? 2 : 1, active ? accent : 0x2a3a4d, active ? 1 : 0.82)
      .setInteractive({ useHandCursor: true });
    rect.on('pointerover', () => rect.setFillStyle(active ? 0x243954 : 0x121d2b, 0.98));
    rect.on('pointerout', () => rect.setFillStyle(fill, active ? 1 : 0.9));
    rect.on('pointerdown', onClick);
    this.root.add(rect);
    const iconId = codexIconForLabel(label);
    const icon = iconId ? addUiIconImage(this, iconId, x - w / 2 + 18, y - 2, Math.min(26, h - 10)) : undefined;
    if (icon) {
      icon.setAlpha(active ? 0.96 : 0.56);
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
    layer.add(this.add.text(cx, cy - 6, '?', {
      fontFamily: 'Georgia, serif',
      fontSize: '68px',
      fontStyle: UI_BOLD,
      color: '#344558',
      stroke: '#05070c',
      strokeThickness: 2,
    }).setResolution(2).setOrigin(0.5));
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
    // The art is a complete 2:3 card illustration — show it whole, undistorted.
    const aw = 184;
    const ah = Math.round(aw * 1.5); // exact 2:3, no smashing
    const w = aw + 8;
    const h = ah + 8;
    const found = this.discovered.has(card.id);
    const accent = this.cardAccent(card);
    const bg = this.add.rectangle(cx, cy, w, h, found ? 0x0e131d : 0x0a0d13, found ? 1 : 0.9)
      .setStrokeStyle(found ? 3 : 2, found ? accent : 0x232b35, found ? 1 : 0.7)
      .setInteractive({ useHandCursor: found });
    bg.on('pointerover', () => bg.setFillStyle(found ? 0x162235 : 0x0d1420, found ? 1 : 0.94));
    bg.on('pointerout', () => bg.setFillStyle(found ? 0x0e131d : 0x0a0d13, found ? 1 : 0.9));
    if (found) bg.on('pointerdown', () => this.openCodexDetail(card.id));
    layer.add(bg);

    const key = compactCardArtKey(card);
    if (found && key && this.textures.exists(key)) {
      layer.add(this.add.image(cx, cy, key).setDisplaySize(aw, ah).setAlpha(0.99));
      // Cost badge (gameplay info not shown in the illustration).
      layer.add(this.add.circle(cx - aw / 2 + 18, cy - ah / 2 + 18, 15, card.cost === 0 ? 0x24d0d6 : 0xe8b830, 1).setStrokeStyle(2, 0x05080e, 0.95));
      layer.add(this.add.text(cx - aw / 2 + 18, cy - ah / 2 + 18, `${card.cost}`, { fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: '#06101c' }).setOrigin(0.5));
    } else if (found && renderSnagCardBorder(this, (obj) => layer.add(obj), card, cx, cy, aw, ah, 0.99)) {
      // Snag cards use their own border template even before full illustration art exists.
    } else if (found) {
      layer.add(this.add.text(cx, cy, displayName(card), { fontFamily: UI_FONT, fontSize: '15px', fontStyle: UI_BOLD, color: UI_BODY, align: 'center', wordWrap: { width: aw - 16 } }).setOrigin(0.5));
      this.addCodexChip(layer, cx, cy + 72, 118, this.cardFamilyLabel(card), accent, true);
    } else {
      this.drawLockedCardBack(layer, card, cx, cy, aw, ah, accent);
    }
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
      case 'tellControl': return 'Intel';
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
    const w = 252;
    const h = 154;
    const accent = this.supplyAccent(supply);
    const bg = this.add.rectangle(cx, cy, w, h, 0x0d1720, 0.96)
      .setStrokeStyle(2, accent, 0.9)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x142334, 0.98));
    bg.on('pointerout', () => bg.setFillStyle(0x0d1720, 0.96));
    bg.on('pointerdown', () => this.openCodexDetail(supply.id));
    layer.add(bg);
    layer.add(this.add.rectangle(cx, cy - h / 2 + 7, w - 16, 4, accent, 0.82));
    const artAsset = supplyArtAssets[supply.id];
    if (artAsset && this.textures.exists(artAsset.key)) {
      layer.add(addSupplyArtImage(this, cx - 92, cy - 34, artAsset.key).setDisplaySize(70, 70));
    } else {
      layer.add(this.add.text(cx - 92, cy - 35, this.supplyGlyph(supply), {
        fontFamily: UI_FONT, fontSize: '22px', fontStyle: UI_BOLD, color: '#e7eef7'
      }).setOrigin(0.5));
    }
    layer.add(this.add.text(cx - 48, cy - 58, supply.name, {
      fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: 168 }
    }).setOrigin(0, 0));
    layer.add(this.add.text(cx - 48, cy - 20, `${this.supplyCategoryLabel(supply)} / ${supply.rarity}`, {
      fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: UI_CYAN,
      wordWrap: { width: 168 }
    }).setOrigin(0, 0));
    this.addCodexChip(layer, cx - 58, cy + 11, 98, this.supplyTimingLabel(supply), accent);
    this.addCodexChip(layer, cx + 52, cy + 11, 106, this.supplyAnswerLabel(supply), accent);
    layer.add(this.add.text(cx - 112, cy + 38, compactEffectSummary(supply.effects, 94), {
      fontFamily: UI_FONT, fontSize: '12px', color: UI_BODY,
      align: 'center', wordWrap: { width: w - 28 },
      maxLines: 2
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
    const close = this.add.rectangle(left + MW - 30, top + 30, 36, 36, 0x3d2a2d, 0.97)
      .setStrokeStyle(2, 0xff6b57, 1).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.closeCodexDetail());
    this.root.add(close);
    this.root.add(this.add.text(left + MW - 30, top + 30, 'x', {
      fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: '#ffd5cc'
    }).setOrigin(0.5));
  }

  private renderWaymarkThumb(layer: Phaser.GameObjects.Container, mark: RuntimeRouteMark, cx: number, cy: number) {
    const w = 252;
    const h = 154;
    const accent = this.waymarkAccent(mark);
    const bg = this.add.rectangle(cx, cy, w, h, 0x0d1420, 0.96)
      .setStrokeStyle(2, accent, 0.9)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x142033, 0.98));
    bg.on('pointerout', () => bg.setFillStyle(0x0d1420, 0.96));
    bg.on('pointerdown', () => this.openCodexDetail(mark.id));
    layer.add(bg);
    layer.add(this.add.rectangle(cx, cy - h / 2 + 7, w - 16, 4, accent, 0.82));

    const artAsset = waymarkArtAssets[mark.id];
    if (artAsset && this.textures.exists(artAsset.key)) {
      layer.add(addWaymarkArtImage(this, cx - 92, cy - 34, artAsset.key).setDisplaySize(70, 70));
    } else {
      layer.add(this.add.text(cx - 92, cy - 35, waymarkGlyph(mark), {
        fontFamily: UI_FONT, fontSize: '22px', fontStyle: UI_BOLD, color: '#e7eef7'
      }).setOrigin(0.5));
    }
    layer.add(this.add.text(cx - 48, cy - 58, mark.name, {
      fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: 168 }
    }).setOrigin(0, 0));
    layer.add(this.add.text(cx - 48, cy - 20, `${this.waymarkFamilyLabel(mark)} / ${mark.rarity}`, {
      fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: UI_CYAN,
      wordWrap: { width: 168 }
    }).setOrigin(0, 0));
    this.addCodexChip(layer, cx - 58, cy + 11, 98, this.waymarkFamilyLabel(mark), accent);
    this.addCodexChip(layer, cx + 52, cy + 11, 106, mark.source, accent);
    layer.add(this.add.text(cx - 112, cy + 38, compactEffectSummary(routeMarkEffectText(mark), 94), {
      fontFamily: UI_FONT, fontSize: '12px', color: UI_BODY,
      align: 'center', wordWrap: { width: w - 28 },
      maxLines: 2
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

    const close = this.add.rectangle(left + MW - 30, top + 30, 36, 36, 0x3d2a2d, 0.97)
      .setStrokeStyle(2, 0xff6b57, 1).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.closeCodexDetail());
    this.root.add(close);
    this.root.add(this.add.text(left + MW - 30, top + 30, 'x', {
      fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: '#ffd5cc'
    }).setOrigin(0.5));
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
    const lore = getLeaderLore(leader.id);
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
    const lore = getLeaderLore(leader.id);
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

    const art = codexLeaderArtAssets[leader.id];
    const artBoxX = left + 205;
    const artBoxY = py + 24;
    this.root.add(this.add.rectangle(artBoxX, artBoxY, 348, 516, 0x05080e, 0.58).setStrokeStyle(1, accent, 0.52));
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
    if (!unlocked) {
      this.root.add(this.add.rectangle(artBoxX, artBoxY + 224, 260, 36, 0x05070c, 0.8).setStrokeStyle(1, 0x2a3a4d, 0.85));
      this.root.add(this.add.text(artBoxX, artBoxY + 224, leaderUnlockHints[leader.id] ?? 'Locked', {
        fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_GOLD,
        align: 'center', wordWrap: { width: 238 }
      }).setOrigin(0.5));
    }

    const tx = left + 410;
    const wrap = right - tx - 30;
    const viewTop = mTop + 86;
    const viewBottom = mBottom - 42;
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
      this.root.add(this.add.text(right - 22, mBottom - 10, this.detailScroll < this.detailMaxScroll ? 'v scroll' : '^ top', {
        fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: UI_MUTED
      }).setOrigin(1, 1));
    }

    const close = this.add.rectangle(right - 26, mTop + 26, 36, 36, 0x3d2a2d, 0.97)
      .setStrokeStyle(2, 0xff6b57, 1)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', closeDetail);
    this.root.add(close);
    this.root.add(this.add.text(right - 26, mTop + 26, 'X', {
      fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: '#ffd5cc'
    }).setOrigin(0.5));
  }

  private fittedTextureSize(key: string, maxW: number, maxH: number) {
    const src = this.textures.get(key).getSourceImage() as { width?: number; height?: number };
    const iw = Math.max(1, src.width ?? maxW);
    const ih = Math.max(1, src.height ?? maxH);
    const scale = Math.min(maxW / iw, maxH / ih);
    return { w: iw * scale, h: ih * scale };
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
    return enemy.source === 'reserve' ? reserveEnemyArtAssets[enemy.id] : enemyArtAssets[enemy.id];
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
    layer.add(this.add.text(cx, cy + 76, enemy.varietyContribution, {
      fontFamily: UI_FONT, fontSize: '11px', color: UI_SOFT,
      align: 'center', wordWrap: { width: w - 24 }
    }).setOrigin(0.5, 0.5));
  }

  private enemyAccent(enemy: CodexEnemyEntry) {
    if (enemy.district === 'Canal Markets') return 0x2fc6c9;
    if (enemy.district === 'Signal Spires') return 0xc9a6ff;
    if (enemy.district === 'High Roost') return 0xe8c24a;
    return 0x7ab8d6;
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

    // Large card art on the left, at the art's true 2:3 aspect (no distortion).
    const key = loadedCardArtKey(this, card);
    const artW = 320;
    const artH = artW * 1.5;
    const artX = left + 24 + artW / 2;
    this.root.add(this.add.rectangle(artX, py, artW + 14, artH + 14, 0x05080e, 0.88).setStrokeStyle(2, accentColor, 0.7));
    if (key && this.textures.exists(key)) {
      this.root.add(this.add.image(artX, py, key).setDisplaySize(artW, artH).setAlpha(0.99));
    } else {
      this.root.add(this.add.rectangle(artX, py, artW, artH, 0x141d2b, 0.9));
    }

    // Right column is a scrollable viewport (lots of content now). Text is drawn
    // in absolute coords offset by -detailScroll, then clipped by opaque curtains
    // top & bottom (WebGL has no geometry masks).
    const tx = artX + artW / 2 + 26;
    const wrap = right - tx - 22;
    const viewTop = mTop + 16;
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
    this.root.add(this.add.text(tx, yy, displayName(card), { fontFamily: UI_FONT, fontSize: '27px', fontStyle: UI_BOLD, color: UI_GOLD, wordWrap: { width: wrap } })); yy += 38;
    this.root.add(this.add.text(tx, yy, `${cardLabel(card)}  ·  Cost ${card.cost}${flav?.bird ? `  ·  ${flav.bird}` : ''}`, { fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_MUTED, wordWrap: { width: wrap } })); yy += 26;

    // Effect — base + preened (keywords highlighted, hoverable).
    heading('EFFECT', '#7f93a8');
    yy += renderRichText(this, this.root, tx, yy, card.text, { wrap, fontSize: 15, tooltips: true }) + 6;
    if (card.upgradedText && card.upgradedText !== card.text) {
      this.root.add(this.add.text(tx, yy, 'PREENED  +', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: '#7fe39a' })); yy += 16;
      yy += renderRichText(this, this.root, tx, yy, card.upgradedText, { wrap, fontSize: 14, baseColor: '#bfe9cc', tooltips: true }) + 12;
    } else { yy += 6; }

    // Molt ability — base + preened.
    if (card.moltText) {
      heading('❂ MOLT ABILITY', '#c8923a');
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
    const statStr = Object.entries(card.runtime.flockStats).map(([k, v]) => `${statLabels[k] ?? k} +${v}`).join('   ·   ') || 'None';
    heading('FLOCK STATS', '#7f93a8');
    const statText = this.add.text(tx, yy, statStr, { fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: UI_CYAN, wordWrap: { width: wrap } });
    const statKw = Object.keys(card.runtime.flockStats).map((k) => statLabels[k] ?? k).find((label) => KEYWORDS[label]);
    if (statKw) {
      statText.setInteractive({ useHandCursor: true });
      statText.on('pointerover', () => showKwTooltip(this, statKw, tx + statText.width / 2, yy));
      statText.on('pointerout', () => hideKwTooltip());
    }
    this.root.add(statText); yy += 30;

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
      heading(`🐦  ABOUT THE ${(flav?.bird ?? card.bird).toUpperCase()}`, '#e8c24a');
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
      this.root.add(this.add.text(right - 22, mBottom - 10, this.detailScroll < this.detailMaxScroll ? '▾ scroll' : '▴ top', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: UI_MUTED }).setOrigin(1, 1));
    }

    const close = this.add.rectangle(right - 26, mTop + 26, 36, 36, 0x3d2a2d, 0.97).setStrokeStyle(2, 0xff6b57, 1).setInteractive({ useHandCursor: true });
    close.on('pointerdown', closeDetail);
    this.root.add(close);
    this.root.add(this.add.text(right - 26, mTop + 26, '✕', { fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: '#ffd5cc' }).setOrigin(0.5));
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

    const art = this.enemyArtAsset(enemy);
    const artBoxX = left + 220;
    const artBoxY = py + 24;
    this.root.add(this.add.rectangle(artBoxX, artBoxY, 372, 516, 0x05080e, 0.58).setStrokeStyle(1, accent, 0.52));
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

    const tx = left + 430;
    const wrap = right - tx - 28;
    const viewTop = mTop + 86;
    const viewBottom = mBottom - 42;
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

    heading(enemy.source === 'encounter' ? 'COMBAT KIT' : 'MOVE KIT', accentText);
    enemy.moveKit.forEach((move) => {
      para(`- ${move}`, { size: 13, color: '#dbe6f0' });
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
      this.root.add(this.add.text(right - 22, mBottom - 10, this.detailScroll < this.detailMaxScroll ? 'v scroll' : '^ top', {
        fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: UI_MUTED
      }).setOrigin(1, 1));
    }

    const close = this.add.rectangle(right - 26, mTop + 26, 36, 36, 0x3d2a2d, 0.97)
      .setStrokeStyle(2, 0xff6b57, 1)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', closeDetail);
    this.root.add(close);
    this.root.add(this.add.text(right - 26, mTop + 26, 'X', {
      fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: '#ffd5cc'
    }).setOrigin(0.5));
  }
}

class RouteScene extends Phaser.Scene {
  private runState!: RunState;
  private selectableNodeIds = new Set<string>();
  private selectedNodeId: string | undefined;
  private nodeChoiceOpen = false;
  private nodeChoiceNodeId: string | undefined;
  private nodeChoicePreviousNodeId: string | undefined;
  private routeCardPickerRestoreState: RunState | undefined;
  private routeCardRewardChoices: Card[] = [];
  private routeStaticCardRewardChoiceIds = new Map<string, string[]>();
  private routeStaticItemRewardChoices = new Map<string, PendingRouteRewardItem>();
  private pendingRouteReward: PendingRouteReward | undefined;
  private cardPickerMode: CardPickerMode | undefined;
  private cardPickerContext: 'route' | 'market' | undefined;
  private cardPickerRemainingPicks = 0;
  private marketPickerUtilitySlot: number | undefined;
  private deckOverlayOpen = false;
  private flockOverlayOpen = false;
  private waymarkDrawerOpen = false;
  private supplyDrawerOpen = false;
  private marketOpen = false;
  private confirmExitOpen = false;
  private marketNodeId: string | undefined;
  private marketMessage = '';
  private marketRefreshCount = 0;
  private marketCardShelf: MarketCardListing[] = [];
  private marketWaymarkShelf: MarketWaymarkListing[] = [];
  private marketUtilityShelf: MarketUtilityListing[] = [];
  private inspectedCardId: string | undefined;
  private hoverCardDetail?: Phaser.GameObjects.Container;
  private marketItemHover?: Phaser.GameObjects.Container;
  private routeChoiceHover?: Phaser.GameObjects.Container;
  private cardReviewScroll = 0;
  private cardPickerScroll = 0;
  private routeWaymarkScroll = 0;
  private routeNodeIconArtRequested = false;
  private supplyFeedback: SupplyFeedback[] = [];

  constructor() {
    super('RouteScene');
  }

  init(data: RouteSceneData = {}) {
    this.runState = cloneRunState(data.runState ?? createInitialRunState());
    activeMapIndex = this.runState.mapIndex ?? 0;
    activeSeed = this.runState.seed ?? 'alpha';
    while ((this.runState.freePreenNextDistrict ?? 0) > 0) {
      const preened = this.preenFirstAvailableCard();
      this.runState.freePreenNextDistrict = Math.max(0, (this.runState.freePreenNextDistrict ?? 0) - 1);
      this.runState.routeLog.push(preened
        ? `Boss prep: ${preened.name} is preened for the new district.`
        : 'Boss prep: no unpreened card remains.');
      this.runState.routeLog = this.runState.routeLog.slice(-8);
      if (!preened) break;
    }
    this.selectableNodeIds = new Set(this.getSelectableNodes().map((node) => node.id));
    this.selectedNodeId = this.getSelectableNodes()[0]?.id;
    this.nodeChoiceOpen = false;
    this.nodeChoiceNodeId = undefined;
    this.nodeChoicePreviousNodeId = undefined;
    this.routeCardPickerRestoreState = undefined;
    this.routeCardRewardChoices = [];
    this.routeStaticCardRewardChoiceIds.clear();
    this.routeStaticItemRewardChoices.clear();
    this.pendingRouteReward = undefined;
    this.cardPickerMode = undefined;
    this.cardPickerContext = undefined;
    this.cardPickerRemainingPicks = 0;
    this.marketPickerUtilitySlot = undefined;
    this.deckOverlayOpen = false;
    this.flockOverlayOpen = false;
    this.waymarkDrawerOpen = false;
    this.supplyDrawerOpen = false;
    this.marketOpen = false;
    this.marketNodeId = undefined;
    this.marketMessage = '';
    this.marketRefreshCount = 0;
    this.marketCardShelf = [];
    this.marketWaymarkShelf = [];
    this.marketUtilityShelf = [];
    this.inspectedCardId = undefined;
    this.hoverCardDetail = undefined;
    this.marketItemHover = undefined;
    this.cardReviewScroll = 0;
    this.cardPickerScroll = 0;
    this.routeWaymarkScroll = 0;
    this.routeNodeIconArtRequested = false;
    this.supplyFeedback = [];
  }

  preload() {
    queuePreloadImageAssets(
      this,
      [
        scrapArtAsset,
        snagCardBorderAsset,
        ...Object.values(uiIconAssets),
        ...Object.values(rewardBadgeArtAssets),
        ...Object.values(routeNodeIconAssets),
        ...Object.values(MARKET_KIT_ASSETS),
        ...Object.values(ROUTE_EVENT_BACKDROP_ASSETS),
        ...Object.values(ROUTE_EVENT_PROP_ASSETS),
        ...this.runState.deck.map((card) => cardArtAssets[card.id])
      ],
      'Route scene art failed to preload'
    );
  }

  create() {
    this.cameras.main.setBackgroundColor('#08101d');
    this.cameras.main.fadeIn(200);
    this.queueRouteNodeIconArtLoad();
    this.renderAll();

    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.deckOverlayOpen || this.flockOverlayOpen || this.waymarkDrawerOpen || this.supplyDrawerOpen) return;
      // Commit the selected node if it is reachable, else the first available.
      const target = (this.selectedNodeId && this.selectableNodeIds.has(this.selectedNodeId))
        ? this.selectedNodeId
        : this.getSelectableNodes()[0]?.id;
      if (target) this.commitRouteNode(target);
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.cardPickerMode && this.cardPickerContext === 'market') {
        this.cancelMarketCardPicker();
        return;
      }
      if (this.nodeChoiceOpen || this.cardPickerMode) return; // a node choice / card pick must be resolved, not escaped
      if (this.confirmExitOpen) { // Esc dismisses the abandon prompt (keep playing)
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
        this.closeSupplyDrawer();
        return;
      }
      this.confirmExitOpen = true; // leaving a run is destructive — confirm first
      this.renderAll();
    });
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      if (this.cardPickerMode) {
        this.scrollCardPicker(deltaY > 0 ? 1 : -1);
        return;
      }
      if (this.waymarkDrawerOpen) {
        this.scrollRouteWaymarks(deltaY > 0 ? 1 : -1);
        return;
      }
      if (this.supplyDrawerOpen) return;
      if (!this.deckOverlayOpen || this.marketOpen) return;
      this.scrollDeck(deltaY > 0 ? 1 : -1);
    });
  }

  private renderAll() {
    killTweensForScene(this);
    this.children.removeAll(true);
    this.hoverCardDetail = undefined;
    this.marketItemHover = undefined;
    this.routeChoiceHover = undefined;
    this.renderBackdrop();
    this.renderRouteMap();
    const hasBlockingOverlay = this.deckOverlayOpen || this.flockOverlayOpen || this.waymarkDrawerOpen || this.supplyDrawerOpen || this.marketOpen || this.nodeChoiceOpen || !!this.pendingRouteReward || !!this.cardPickerMode;
    if (!hasBlockingOverlay) {
      this.renderRouteSupplyFeedbackStrip();
    }
    if (this.deckOverlayOpen) this.renderMapDeckOverlay();
    if (this.flockOverlayOpen) this.renderRouteFlockOverlay();
    if (this.waymarkDrawerOpen) this.renderRouteWaymarkDrawer();
    if (this.supplyDrawerOpen) this.renderRouteSupplyDrawer();
    if (this.marketOpen) this.renderMarketOverlay();
    if (this.nodeChoiceOpen) this.renderNodeChoiceOverlay();
    if (this.pendingRouteReward) this.renderRouteCardRewardOverlay();
    if (this.cardPickerMode) this.renderCardPickerOverlay();
    if (!this.confirmExitOpen) this.renderRunHud();
    if (this.confirmExitOpen) this.renderConfirmExitOverlay();
    this.updateTextState();
    if (!this.marketOpen && !this.nodeChoiceOpen && !this.pendingRouteReward && !this.cardPickerMode) {
      persistActiveRun(this.runState); // checkpoint: resume lands back on the route map
    }
  }

  private queueOptionalCardArtLoad() {
    const ids = new Set(this.runState.deck.map((card) => card.id));
    this.marketCardShelf.forEach((offer) => ids.add(offer.id));
    queueRuntimeImageAssets(
      this,
      [...ids].map((id) => cardThumbArtAssets[id] ?? cardArtAssets[id]),
      'Optional card art failed to load on route map',
      () => this.renderAll()
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
      'Route reward card art failed to load',
      () => this.renderAll()
    );
  }

  private queueCardPickerArtLoad(entries: Array<{ card: Card }>) {
    if (entries.length === 0) return;
    queueRuntimeImageAssets(
      this,
      uniqueImageAssets(entries.map((entry) => cardCompactArtAsset(entry.card))),
      'Card picker art failed to load',
      () => this.renderAll()
    );
  }

  private queueRouteRewardItemArtLoad() {
    const item = this.pendingRouteReward?.previewItem;
    if (!item) return;
    queueRuntimeImageAssets(
      this,
      [item.kind === 'supply' ? supplyArtAssets[item.id] : waymarkArtAssets[item.id]],
      'Route reward item art failed to load',
      () => this.renderAll()
    );
  }

  private queueRouteNodeIconArtLoad() {
    if (this.routeNodeIconArtRequested) return;
    this.routeNodeIconArtRequested = true;
    queueRuntimeImageAssets(
      this,
      [
        ...Object.values(routeNodeIconAssets),
        ...Object.values(rewardBadgeArtAssets)
      ],
      'Route node icon failed to load',
      () => this.renderAll()
    );
  }

  private routeEventBackdropAsset(node?: RouteNode) {
    return node ? ROUTE_EVENT_BACKDROP_ASSETS[node.type] : undefined;
  }

  private routeEventResidentAsset(node?: RouteNode) {
    return node ? ROUTE_EVENT_RESIDENT_ASSETS[node.type] : undefined;
  }

  private queueRouteEventBackdropArtLoad(node?: RouteNode) {
    queueRuntimeImageAssets(
      this,
      [this.routeEventBackdropAsset(node)],
      'Route event backdrop failed to load',
      () => this.renderAll()
    );
  }

  private queueRouteEventSetPieceArtLoad(node?: RouteNode) {
    const prop = this.routeEventPropAssetForType(node?.type);
    const propAssets = prop ? [prop] : [];
    queueRuntimeImageAssets(
      this,
      [this.routeEventBackdropAsset(node), this.routeEventResidentAsset(node), ...propAssets],
      'Route event set piece art failed to load',
      () => this.renderAll()
    );
  }

  private routeEventPropAssetForType(type?: RouteNode['type']) {
    if (type === 'basin') return ROUTE_EVENT_PROP_ASSETS.basinHearthCart;
    if (type === 'cache') return ROUTE_EVENT_PROP_ASSETS.marnLockboxCabinet;
    if (type === 'signal') return ROUTE_EVENT_PROP_ASSETS.signalSwitchboard;
    if (type === 'nest') return ROUTE_EVENT_PROP_ASSETS.nestFeatherwrightBench;
    return undefined;
  }

  private queueRouteSupplyArtLoad() {
    queueRuntimeImageAssets(
      this,
      this.runState.supplies.map((id) => supplyArtAssets[id]),
      'Route supply art failed to load',
      () => this.renderAll()
    );
  }

  private queueMarketWaymarkArtLoad() {
    queueRuntimeImageAssets(
      this,
      this.marketWaymarkShelf.map((offer) => waymarkArtAssets[offer.id]),
      'Market waymark art failed to load on route map',
      () => this.renderAll()
    );
  }

  private queueRouteWaymarkArtLoad() {
    queueRuntimeImageAssets(
      this,
      this.runState.routeMarks.map((id) => waymarkArtAssets[id]),
      'Route waymark art failed to load on route map',
      () => this.renderAll()
    );
  }

  private queueMarketUtilityArtLoad() {
    queueRuntimeImageAssets(
      this,
      this.marketUtilityShelf.map((offer) => this.marketUtilityProxyArtAsset(offer)),
      'Market utility art failed to load on route map',
      () => this.renderAll()
    );
  }

  private queueMarketKitArtLoad() {
    queueRuntimeImageAssets(
      this,
      Object.values(MARKET_KIT_ASSETS),
      'Market kit art failed to load',
      () => this.renderAll()
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
    this.add.rectangle(GAME_WIDTH / 2, 24, GAME_WIDTH - 100, 2, accent, hasBackdrop ? 0.42 : 0.24);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 28, GAME_WIDTH - 100, 2, accent, hasBackdrop ? 0.36 : 0.22);
  }

  private renderConfirmExitOverlay() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.86)
      .setInteractive({ useHandCursor: false });
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 640, 286, 0x0d1420, 0.98)
      .setStrokeStyle(3, 0xff7a6e, 0.92);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 78, 'Abandon this run?', {
      fontFamily: UI_FONT, fontSize: '30px', fontStyle: UI_BOLD, color: UI_GOLD, stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24, 'Your progress on this run will be lost.', {
      fontFamily: UI_FONT, fontSize: '16px', color: UI_SOFT, align: 'center', wordWrap: { width: 540 }
    }).setOrigin(0.5);

    const keep = this.add.rectangle(GAME_WIDTH / 2 - 140, GAME_HEIGHT / 2 + 56, 230, 54, 0x122235, 0.98)
      .setStrokeStyle(2, 0x7ab8d6, 0.95).setInteractive({ useHandCursor: true });
    keep.on('pointerdown', () => { this.confirmExitOpen = false; this.renderAll(); });
    this.add.text(GAME_WIDTH / 2 - 140, GAME_HEIGHT / 2 + 56, 'Keep Playing', {
      fontFamily: UI_FONT, fontSize: '18px', fontStyle: UI_BOLD, color: '#dbe6f0'
    }).setOrigin(0.5);

    const abandon = this.add.rectangle(GAME_WIDTH / 2 + 140, GAME_HEIGHT / 2 + 56, 230, 54, 0x2a1014, 0.98)
      .setStrokeStyle(2, 0xff7a6e, 0.95).setInteractive({ useHandCursor: true });
    abandon.on('pointerdown', () => { clearActiveRun(); this.scene.start('MenuScene'); });
    this.add.text(GAME_WIDTH / 2 + 140, GAME_HEIGHT / 2 + 56, 'Abandon Run', {
      fontFamily: UI_FONT, fontSize: '18px', fontStyle: UI_BOLD, color: '#ffd0c9'
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 108, 'Esc to keep playing', {
      fontFamily: UI_FONT, fontSize: '13px', color: '#6f8296'
    }).setOrigin(0.5);
  }

  private renderBackdrop() {
    const layout = this.routeLayout();
    const backdropKey = this.textures.exists(ROUTE_MAP_BACKDROP_ASSET.key)
      ? ROUTE_MAP_BACKDROP_ASSET.key
      : 'splash';
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, backdropKey)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(backdropKey === ROUTE_MAP_BACKDROP_ASSET.key ? 1 : 0.48);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, backdropKey === ROUTE_MAP_BACKDROP_ASSET.key ? 0.34 : 0.62);
    renderFieldPanel(this, (obj) => {}, layout.map.cx, layout.map.cy, layout.map.w, layout.map.h, {
      accent: 0x49606d,
      fill: 0x07101a
    });
    this.add.rectangle(layout.map.cx, layout.map.cy, layout.map.w - 34, layout.map.h - 34, 0x03070d, 0.28);
    this.renderRouteMapBacking(layout);
    this.renderRouteMapFrame(layout);

  }

  private renderRunHud() {
    const status = this.routeStatusSummary();
    renderUnifiedRunHud(this, (obj) => {}, {
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
  }

  private renderRouteMapBacking(layout: ReturnType<RouteScene['routeLayout']>) {
    const w = layout.map.w;
    const h = layout.map.h;
    const x = layout.map.cx;
    const y = layout.map.cy;
    if (this.textures.exists(ROUTE_MAP_BACKING_ASSET.key)) {
      this.add.image(x, y, ROUTE_MAP_BACKING_ASSET.key)
        .setDisplaySize(w, h)
        .setAlpha(1);
    } else {
      this.add.rectangle(x, y, w, h, 0x07101a, 0.34);
    }
  }

  private renderRouteMapFrame(layout: ReturnType<RouteScene['routeLayout']>) {
    const accent = 0x49606d;
    const { cx, cy, w, h } = layout.map;
    const left = cx - w / 2;
    const right = cx + w / 2;
    const top = cy - h / 2;
    const bottom = cy + h / 2;
    const corner = 28;
    this.add.rectangle(cx, top + 14, w - 34, 2, accent, 0.72);
    this.add.rectangle(cx, bottom - 14, w - 34, 1, 0xffffff, 0.08);
    [
      [left + 15, top + 15, corner, 2], [left + 15, top + 15, 2, corner],
      [right - 15, top + 15, corner, 2], [right - 15, top + 15, 2, corner],
      [left + 15, bottom - 15, corner, 2], [left + 15, bottom - 15, 2, corner],
      [right - 15, bottom - 15, corner, 2], [right - 15, bottom - 15, 2, corner]
    ].forEach(([x, y, cw, ch], index) => {
      const ox = index === 2 || index === 6 ? -corner : 0;
      const oy = index === 5 || index === 7 ? -corner : 0;
      this.add.rectangle(x + ox, y + oy, cw, ch, accent, 0.72).setOrigin(0, 0);
    });
  }

  private routeLayout() {
    return {
      top: { y: 124 },
      map: { x: 32, y: 112, w: 1208, h: 590, cx: 636, cy: 407 },
      graph: { left: 88, right: 1158, top: 146, bottom: 638 },
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
    return formatEffects(supply.effects)
      .replace(/\s+/g, ' ')
      .replace(/\.$/, '');
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
    const x = 1140;
    const y = 116;
    addUiIconImage(this, 'supply-pouch', x - 96, y - 18, 24)?.setAlpha(0.82);
    this.add.rectangle(x, y, 176, 38, 0x07101a, 0.86)
      .setStrokeStyle(1, 0xffb86b, 0.72);
    this.add.text(x - 66, y - 14, latest.name, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      fixedWidth: 142,
      maxLines: 1
    }).setResolution(2);
    this.add.text(x - 66, y + 1, latest.summary, {
      fontFamily: UI_FONT,
      fontSize: '8px',
      color: UI_BODY,
      fixedWidth: 144,
      maxLines: 1
    }).setResolution(2);
  }

  private renderRouteMap() {
    const positions = new Map(currentMap().nodes.map((node) => [node.id, this.nodePosition(node)]));
    const onChosenPath = new Set(this.runState.completedRouteNodeIds);
    const previewEdges = this.routePreviewEdges();
    this.renderRouteColumnGuides();
    const lines = this.add.graphics();
    currentMap().edges.forEach((edge) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) return;
      // Route lines are subdued unless they connect completed (chosen-path) nodes.
      const lit = onChosenPath.has(edge.from) && onChosenPath.has(edge.to);
      const key = this.routeEdgeKey(edge.from, edge.to);
      const primaryPreview = previewEdges.primary.has(key);
      const secondaryPreview = previewEdges.secondary.has(key);
      const available = this.selectableNodeIds.has(edge.to);
      const color = lit ? 0x87b884 : primaryPreview ? 0xbf7842 : available ? 0x4fb2a9 : secondaryPreview ? 0x657f89 : 0x263d4b;
      const alpha = lit ? 0.88 : primaryPreview ? 0.92 : available ? 0.86 : secondaryPreview ? 0.6 : 0.5;
      const dotRadius = lit ? 1.45 : primaryPreview ? 1.45 : available ? 1.28 : secondaryPreview ? 1.22 : 1.05;
      const curve = this.drawRouteEdgePath(lines, from, to, key, color, alpha, dotRadius);
      if (available || primaryPreview) {
        const marker = curve.getPoint(0.65);
        lines.fillStyle(0x06111a, primaryPreview ? 0.5 : 0.42);
        lines.fillCircle(marker.x, marker.y, primaryPreview ? 4.35 : 3.85);
        lines.fillStyle(primaryPreview ? 0xbf7842 : 0x4fb2a9, primaryPreview ? 0.96 : 0.88);
        lines.fillCircle(marker.x, marker.y, primaryPreview ? 3.5 : 3);
      }
    });

    currentMap().nodes.forEach((node) => this.renderRouteNode(node, this.selectableNodeIds.has(node.id)));

    this.renderRouteConfirmButton();
  }

  private drawRouteEdgePath(
    graphics: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    edgeKey: string,
    color: number,
    alpha: number,
    dotRadius: number
  ) {
    const start = new Phaser.Math.Vector2(from.x + ROUTE_NODE_ICON_SIZE / 2, from.y);
    const end = new Phaser.Math.Vector2(to.x - ROUTE_NODE_ICON_SIZE / 2, to.y);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const seed = hashSeed(edgeKey, activeMapIndex);
    const side = (seed & 1) === 0 ? 1 : -1;
    const bend = clamp(length * 0.16, 14, 34) * side;
    const control = new Phaser.Math.Vector2(
      (start.x + end.x) / 2 + (-dy / length) * bend,
      (start.y + end.y) / 2 + (dx / length) * bend
    );
    const curve = new Phaser.Curves.QuadraticBezier(start, control, end);
    const pointCount = Math.max(7, Math.ceil(length / 16));
    const points = curve.getSpacedPoints(pointCount);

    points.slice(1, -1).forEach((point, index) => {
      const pulse = index % 3 === 1 ? 0.9 : 1;
      graphics.fillStyle(0x06111a, Math.min(0.52, alpha * 0.78));
      graphics.fillCircle(point.x, point.y, dotRadius * pulse + 0.58);
      graphics.fillStyle(color, alpha);
      graphics.fillCircle(point.x, point.y, dotRadius * pulse);
    });
    return curve;
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

  private renderRouteColumnGuides() {
    const columns = currentMap().columns;
    const { left: leftX, right: rightX, top, bottom } = this.routeLayout().graph;
    const colCount = Math.max(1, columns.length);
    const graphics = this.add.graphics();
    for (let column = 0; column < colCount; column += 1) {
      const x = colCount > 1 ? leftX + (column * (rightX - leftX)) / (colCount - 1) : (leftX + rightX) / 2;
      graphics.lineStyle(1, 0x2a3a4d, column === 0 || column === colCount - 1 ? 0.26 : 0.16);
      graphics.lineBetween(x, top, x, bottom);
    }
  }

  private renderRouteConfirmButton() {
    if (!this.selectedNodeId || !this.selectableNodeIds.has(this.selectedNodeId)) return;
    const nodeId = this.selectedNodeId;
    const confirm = this.routeLayout().confirm;
    const hit = this.add.rectangle(confirm.cx, confirm.cy, confirm.h + 12, confirm.h + 12, 0x000000, 0.01)
      .setInteractive({ useHandCursor: true });
    const icon = addUiIconImage(this, 'route-pin', confirm.cx, confirm.cy, 26);
    if (icon) icon.setAlpha(0.98);
    const iconBaseScaleX = icon?.scaleX ?? 1;
    const iconBaseScaleY = icon?.scaleY ?? 1;
    let tip: Phaser.GameObjects.Container | undefined;
    hit.on('pointerover', () => {
      icon?.setScale(iconBaseScaleX * 1.08, iconBaseScaleY * 1.08);
      tip = this.showSimpleTooltip('Take this route', confirm.cx, confirm.cy - 46);
    });
    hit.on('pointerout', () => {
      icon?.setScale(iconBaseScaleX, iconBaseScaleY);
      tip?.destroy(true);
      tip = undefined;
    });
    hit.on('pointerdown', () => {
      playUiSound('confirm');
      this.commitRouteNode(nodeId);
    });
  }

  private showSimpleTooltip(label: string, x: number, y: number) {
    const width = Math.max(96, label.length * 8 + 26);
    const container = this.add.container(0, 0);
    container.add(this.add.rectangle(x, y, width, 32, 0x05161f, 0.98).setStrokeStyle(1, UI_FIELD.green, 0.9));
    container.add(this.add.text(x, y - 7, label, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: UI_GOLD
    }).setOrigin(0.5, 0));
    return container;
  }

  private renderInspectorRewardBadges(node: RouteNode, left: number, top: number, width: number) {
    const badges = this.routeRewardBadges(node).slice(0, 5);
    if (badges.length === 0) return 0;
    this.add.text(left, top, 'LIKELY FINDS', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: '#7f93a8'
    });
    const gap = Math.min(48, width / Math.max(1, badges.length));
    const startX = left + 17;
    const badgeY = top + 30;
    badges.forEach((badge, index) => {
      const bx = startX + index * gap;
      this.add.circle(bx, badgeY, 15, 0x07101c, 0.98)
        .setStrokeStyle(1.5, badge.color, 0.94);
      const image = addRewardBadgeArtImage(this, badge.id, bx, badgeY, 24);
      if (image) {
        image.setAlpha(0.96);
      } else {
        this.add.text(bx, badgeY - 1, badge.icon, {
          fontFamily: UI_FONT,
          fontSize: '12px',
          fontStyle: UI_BOLD,
          color: badge.text,
          stroke: '#020409',
          strokeThickness: 2
        }).setOrigin(0.5);
      }
    });
    return 58;
  }

  private renderInspectorBossPrep(left: number, top: number, width: number) {
    const prep = this.bossPrepReadiness();
    const cx = left + width / 2;
    this.add.rectangle(cx, top + 68, width, 136, 0x120f0a, 0.74).setStrokeStyle(1, 0xffb86b, 0.5);
    this.add.rectangle(cx, top + 4, width - 22, 2, 0xffb86b, 0.48);
    this.add.text(left + 12, top + 12, 'BOSS PREP', {
      fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: '#ffb86b'
    });
    this.add.text(left + 12, top + 31, prep.bossName, {
      fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: UI_GOLD, wordWrap: { width: width - 24 }
    });
    this.add.text(left + 12, top + 55, `Pressure: ${prep.pressure}`, {
      fontFamily: UI_FONT, fontSize: '11px', color: '#ffb38a', lineSpacing: 1, wordWrap: { width: width - 24 }, maxLines: 2
    });
    this.add.text(left + 12, top + 84, `Prep: ${prep.usefulNodes.join(', ') || 'none ahead'}`, {
      fontFamily: UI_FONT, fontSize: '11px', color: UI_CYAN, lineSpacing: 1, wordWrap: { width: width - 24 }, maxLines: 2
    });
    this.add.text(left + 12, top + 100,
      `Cover ${prep.readiness.cover} / Damage ${prep.readiness.damage} / Recovery ${prep.readiness.recovery} / Molt ${prep.readiness.moltSafety} / Supplies ${prep.readiness.supplies}`,
      { fontFamily: UI_FONT, fontSize: '10px', color: UI_BODY, wordWrap: { width: width - 24 }, maxLines: 2 }
    );
  }

  private nodeDetail(node: RouteNode) {
    const encounter = alphaEncounterLibrary.get(node.payloadId);
    const profile = encounter ? alphaRewardProfileLibrary.get(encounter.rewardProfileId) : undefined;
    const rewards = profile
      ? [
          Array.isArray(profile.scrap) ? `${profile.scrap[0]}-${profile.scrap[1]} Scrap` : profile.scrap !== undefined ? `${profile.scrap} Scrap` : '',
          profile.cardReward ? 'new card' : '',
          profile.preenGuaranteed ? 'Preen' : profile.preenChance ? `${Math.round(profile.preenChance * 100)}% Preen` : '',
          profile.routeMarkGuaranteed ? 'Waymark' : profile.routeMarkChance ? `${Math.round(profile.routeMarkChance * 100)}% Waymark` : '',
          profile.bossRouteMarkChoices ? `${WAYMARK_REWARD_CHOICE_COUNT} high-tier Waymarks` : ''
        ].filter(Boolean).join('  /  ')
      : nonCombatRewardBias(node.type);
    const bossPrep = node.type === 'boss'
      ? `Final crossing. ${encounter?.name ?? 'The boss'} tests Cover and Molt restraint.`
      : node.type === 'rival'
        ? 'Rival Crew - an optional boss-prep bet for richer rewards.'
        : undefined;
    return {
      title: encounter?.name ?? routeNodeTitle(node),
      type: routeNodeTypeLabel(node.type),
      lesson: encounter?.lesson ?? nonCombatLesson(node.type),
      rewards,
      bossPrep
    };
  }

  private renderRouteNode(node: RouteNode, selectable: boolean) {
    const { x, y } = this.nodePosition(node);
    const completed = this.runState.completedRouteNodeIds.includes(node.id);
    const selected = this.selectedNodeId === node.id;
    const isBoss = node.type === 'boss';
    const radius = isBoss ? ROUTE_BOSS_NODE_RADIUS : ROUTE_NODE_RADIUS;
    const iconSize = isBoss ? ROUTE_BOSS_NODE_ICON_SIZE : ROUTE_NODE_ICON_SIZE;
    const hitTarget = this.add.circle(x, y, radius + 10, 0x000000, 0);
    if (selected) this.renderSelectedRouteNodeFocus(x, y, radius);
    // Every node is hoverable for the full preview; selectable nodes commit-select on click.
    hitTarget.setInteractive({ useHandCursor: selectable });
    if (selectable) hitTarget.on('pointerdown', () => this.selectRouteNode(node.id));
    let tip: Phaser.GameObjects.Container | undefined;
    hitTarget.on('pointerover', () => { tip = this.showNodeTooltip(node, x, y - radius - 8); });
    hitTarget.on('pointerout', () => { tip?.destroy(true); tip = undefined; });

    this.renderRouteNodeTypeIcon(node.type, x, y, iconSize, completed ? 0.55 : 1);

  }

  private renderSelectedRouteNodeFocus(x: number, y: number, radius: number) {
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
    return this.add.text(x, y, routeNodeGlyph(type), {
      fontFamily: UI_FONT,
      fontSize: `${Math.max(11, Math.round(size * 0.45))}px`,
      fontStyle: UI_BOLD,
      color: alpha < 1 ? '#7c8da0' : '#ffffff',
      stroke: '#0a121c',
      strokeThickness: 3
    }).setOrigin(0.5).setAlpha(alpha);
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
    const detail = this.nodeDetail(node);
    const badges = this.routeRewardBadges(node).slice(0, 5);
    const width = Math.max(128, Math.min(224, Math.max(detail.title.length * 8 + 28, 78 + badges.length * 30)));
    const graph = this.routeLayout().graph;
    const cx = Math.max(graph.left + width / 2, Math.min(graph.right - width / 2, x));
    const top = anchorY - 22;
    const container = this.add.container(0, 0);
    container.add(this.add.rectangle(cx, top + 6, width, 58, 0x05161f, 0.98).setStrokeStyle(1, 0x7ab8d6, 0.95));
    container.add(this.add.text(cx, top - 17, detail.title, { fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_GOLD }).setOrigin(0.5));

    const iconY = top + 11;
    const typeIcon = this.renderRouteNodeTypeIcon(node.type, cx - width / 2 + 22, iconY, 26, 1);
    container.add(typeIcon);
    const riskX = cx - width / 2 + 50;
    const riskCount = node.risk === 'high' ? 3 : node.risk === 'medium' ? 2 : 1;
    for (let i = 0; i < 3; i += 1) {
      container.add(this.add.rectangle(riskX + i * 8, iconY, 5, 18, routeNodeRiskColor(node.risk), i < riskCount ? 0.92 : 0.22));
    }
    const badgeStartX = cx - width / 2 + 84;
    badges.forEach((badge, index) => {
      const bx = badgeStartX + index * 27;
      container.add(this.add.circle(bx, iconY, 11, 0x07101c, 0.98).setStrokeStyle(1, badge.color, 0.9));
      const image = addRewardBadgeArtImage(this, badge.id, bx, iconY, 18);
      if (image) container.add(image.setAlpha(0.96));
      else container.add(this.add.text(bx, iconY - 1, badge.icon, {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: badge.text
      }).setOrigin(0.5));
    });
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
    const baseX = colCount > 1 ? leftX + (node.column * (rightX - leftX)) / (colCount - 1) : (leftX + rightX) / 2;
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
    const canDrift = node.id !== currentMap().entryNodeId && node.id !== currentMap().bossNodeId;
    const seed = hashSeed(`${activeSeed}:${activeMapIndex}:${node.id}:route-position`, node.column * 31 + laneIndex);
    const driftX = canDrift ? ((seed & 0xff) / 255 - 0.5) * 24 : 0;
    const driftY = canDrift ? (((seed >>> 8) & 0xff) / 255 - 0.5) * 36 : 0;
    const iconSize = node.type === 'boss' ? ROUTE_BOSS_NODE_ICON_SIZE : ROUTE_NODE_ICON_SIZE;
    const horizontalPad = iconSize / 2 + ROUTE_NODE_FOCUS_PAD + 2;
    const verticalPad = iconSize / 2 + ROUTE_NODE_FOCUS_PAD + 2;
    const x = canDrift ? clamp(baseX + driftX, leftX + horizontalPad, rightX - horizontalPad) : baseX;
    const y = canDrift ? clamp(baseY + driftY, top + verticalPad, bottom - verticalPad) : baseY;
    return { x, y };
  }

  private nodeVisualBounds(node: RouteNode) {
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

  // First interaction: select the node and show its detail panel.
  private selectRouteNode(routeNodeId: string) {
    if (this.deckOverlayOpen || this.flockOverlayOpen || this.marketOpen) return;
    this.selectedNodeId = routeNodeId;
    this.renderAll();
  }

  // Confirm: actually travel to the node (battle / market / data-driven choice).
  private commitRouteNode(routeNodeId: string) {
    if (this.deckOverlayOpen || this.flockOverlayOpen || this.marketOpen || this.nodeChoiceOpen) return;
    if (!this.selectableNodeIds.has(routeNodeId)) return;
    const node = currentMap().nodes.find((candidate) => candidate.id === routeNodeId);
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
  // through the route-effect interpreter (next-level-data-contracts §6.3/§7).
  private openNodeChoices(node: RouteNode) {
    this.nodeChoicePreviousNodeId = this.runState.currentRouteNodeId;
    this.runState.currentRouteNodeId = node.id;
    this.nodeChoiceOpen = true;
    this.nodeChoiceNodeId = node.id;
    this.selectableNodeIds = new Set();
    this.routeStaticCardRewardChoiceIds.clear();
    this.routeStaticItemRewardChoices.clear();
    this.renderAll();
  }

  private closeNodeChoices() {
    this.hideRouteChoiceDetail();
    this.nodeChoiceOpen = false;
    this.nodeChoiceNodeId = undefined;
    this.runState.currentRouteNodeId = this.nodeChoicePreviousNodeId;
    this.nodeChoicePreviousNodeId = undefined;
    this.routeStaticCardRewardChoiceIds.clear();
    this.routeStaticItemRewardChoices.clear();
    const selectable = this.getSelectableNodes();
    this.selectableNodeIds = new Set(selectable.map((node) => node.id));
    this.selectedNodeId = selectable[0]?.id;
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
    const withDecline = (choices: NodeChoiceOption[], text = 'Keep moving.') => {
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
      return withDecline(alphaNestSet.options.map(nodeOption), 'Leave the nest as-is.');
    }
    if (node.type === 'rival') {
      return [
        {
          key: 'challenge_rival',
          text: 'Take Caldra\'s wager',
          effects: ['startRivalBattle'],
          locked: false
        },
        {
          key: 'decline',
          text: 'Do not get involved.',
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
    }), 'Do not get involved.');
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
    this.pendingRouteReward = undefined;
    this.nodeChoiceOpen = false;
    this.nodeChoiceNodeId = undefined;
    this.nodeChoicePreviousNodeId = undefined;
    this.routeCardPickerRestoreState = undefined;
    this.hideRouteChoiceDetail();
    this.hideHoverCardDetail();
    this.hideMarketItemDetail();
    this.scene.restart({ runState: cloneRunState(this.runState) });
  }

  private chooseNodeOption(key: string) {
    const node = currentMap().nodes.find((candidate) => candidate.id === this.nodeChoiceNodeId);
    if (!node) return;
    const choice = this.nodeChoiceList(node).find((entry) => entry.key === key);
    if (!choice || choice.locked) return;
    const scrapCost = this.scrapCostOfEffects(choice.effects);
    if (scrapCost > this.runState.scrap) return;
    const pickerRestoreState = cloneRunState(this.runState);
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
      this.nodeChoicePreviousNodeId = undefined;
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
    if (pickerPlan && this.pickerEligibleCards(pickerPlan.mode).length > 0) {
      this.cardPickerMode = pickerPlan.mode;
      this.cardPickerContext = 'route';
      this.cardPickerRemainingPicks = pickerPlan.count;
      this.marketPickerUtilitySlot = undefined;
      this.routeCardPickerRestoreState = pickerRestoreState;
      this.cardPickerScroll = 0;
      this.nodeChoiceOpen = false;
      this.renderAll();
      return;
    }
    if (routeCardRewardSelector) {
      const choices = this.staticRouteCardRewardChoices(node.id, choice.key, routeCardRewardSelector);
      if (choices.length > 0) {
        this.routeCardRewardChoices = choices;
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
    const cardSelector = this.routeCardRewardSelector(choice.effects);
    this.routeCardRewardChoices = cardSelector
      ? this.staticRouteCardRewardChoices(node.id, choice.key, cardSelector)
      : [];
    const previewItem = this.staticRouteItemRewardChoice(node.id, choice.key, choice.effects);
    const previewCards = cardSelector ? [] : this.routeRewardPreviewCards(node.id, choice.key, choice.effects);
    const effectText = routeEffectSummaryWithPreview(choice.effects, previewItem, previewCards);
    this.pendingRouteReward = {
      nodeId: node.id,
      nodeType: node.type,
      choiceKey: choice.key,
      choiceText: choice.text,
      effects: choice.effects,
      effectText,
      restoreState,
      accent: routeEventAccent(node.type),
      effectsAppliedOnOpen: false,
      previewItem,
      previewCards
    };
    this.nodeChoiceOpen = false;
    this.hideRouteChoiceDetail();
    this.queueRouteRewardCardArtLoad();
    this.queueRouteRewardItemArtLoad();
    this.renderAll();
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

  private claimRouteReward() {
    const pending = this.pendingRouteReward;
    if (!pending) return;
    const pickerPlan = this.routeRewardPickerPlan(pending.effects);
    if (pickerPlan && this.pickerEligibleCards(pickerPlan.mode, 'route').length > 0) {
      if (!pending.effectsAppliedOnOpen) this.applyPendingRouteRewardEffects(pending, false, true);
      this.cardPickerMode = pickerPlan.mode;
      this.cardPickerContext = 'route';
      this.cardPickerRemainingPicks = pickerPlan.count;
      this.marketPickerUtilitySlot = undefined;
      this.routeCardPickerRestoreState = cloneRunState(pending.restoreState);
      this.cardPickerScroll = 0;
      this.routeCardRewardChoices = [];
      this.pendingRouteReward = undefined;
      this.nodeChoiceOpen = false;
      this.hideHoverCardDetail();
      this.hideMarketItemDetail();
      this.renderAll();
      return;
    }
    if (!pending.effectsAppliedOnOpen) this.applyPendingRouteRewardEffects(pending);
    this.finishPendingRouteReward(pending);
  }

  private createRouteCardRewardChoices(selector: string) {
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
    const choices: Card[] = [];
    while (pool.length > 0 && choices.length < 2) {
      const index = Math.floor(Math.random() * pool.length);
      const [id] = pool.splice(index, 1);
      if (id) choices.push(cloneCard(id));
    }
    return choices;
  }

  private staticRouteCardRewardChoices(nodeId: string, choiceKey: string, selector: string) {
    const key = `${nodeId}:${choiceKey}:${selector}`;
    const cachedIds = this.routeStaticCardRewardChoiceIds.get(key);
    if (cachedIds) return cachedIds.map((id) => cloneCard(id));
    const choices = this.createRouteCardRewardChoices(selector);
    this.routeStaticCardRewardChoiceIds.set(key, choices.map((card) => card.id));
    return choices;
  }

  private staticRouteCardPreviewChoice(nodeId: string, choiceKey: string, selector: string) {
    const key = `${nodeId}:${choiceKey}:preview:${selector}`;
    const cachedIds = this.routeStaticCardRewardChoiceIds.get(key);
    const cachedId = cachedIds?.[0];
    if (cachedId && cardLibrary[cachedId]) return cloneCard(cachedId);
    const id = this.selectCardRewardId(selector);
    if (!id) return undefined;
    this.routeStaticCardRewardChoiceIds.set(key, [id]);
    return cloneCard(id);
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
      const id = this.selectRouteMarkRewardId(parsed.args[0] ?? 'random');
      if (id) item = { kind: 'waymark', id };
    } else {
      const id = this.selectSupplyRewardId(parsed.name === 'gainSupplyChoice' ? 'random' : parsed.args[0] ?? 'random');
      if (id) item = { kind: 'supply', id };
    }
    if (item) this.routeStaticItemRewardChoices.set(key, { ...item });
    return item;
  }

  private selectRouteMarkRewardId(selector: string) {
    if (selector && !['random', 'randomNonBoss', 'randomCommon', 'randomRare', 'randomUncommonOrRare', 'choice'].includes(selector)) {
      return !this.hasRouteMark(selector) && alphaRouteMarkLibrary.has(selector) ? selector : undefined;
    }
    const basePool = MARKET_ROUTE_MARK_IDS.filter((markId) => !this.hasRouteMark(markId));
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
    if (pool.length === 0) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private selectSupplyRewardId(selector: string) {
    if ((this.runState.supplies ?? []).length >= runSupplyCapacity(this.runState)) return undefined;
    if (selector && !['random', 'choice'].includes(selector) && alphaSupplyLibrary.has(selector)) {
      return this.runState.supplies.includes(selector) ? undefined : selector;
    }
    const ids = [...alphaSupplyLibrary.keys()].filter((candidate) => !this.runState.supplies.includes(candidate));
    if (ids.length === 0) return undefined;
    return ids[Math.floor(Math.random() * ids.length)];
  }

  private chooseRouteRewardCard(cardId: string) {
    const pending = this.pendingRouteReward;
    if (!pending) return;
    const reward = this.routeCardRewardChoices.find((card) => card.id === cardId);
    if (!reward) return;
    if (!pending.effectsAppliedOnOpen) this.applyPendingRouteRewardEffects(pending, true);
    this.runState.deck.push({ id: reward.id });
    discoverCards([reward.id]);
    this.runState.routeLog.push(`${displayName(reward)} joins the flock.`);
    this.runState.routeLog = this.runState.routeLog.slice(-8);
    this.finishPendingRouteReward(pending);
  }

  private cancelRouteCardReward() {
    const pending = this.pendingRouteReward;
    if (!pending) return;
    this.runState = cloneRunState(pending.restoreState);
    this.routeCardRewardChoices = [];
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
        if (mode === 'preen') return !saved.upgraded && card.runtime.kind !== 'snag';
        return true;
      })
      .map(({ saved, index }) => {
        const card = cloneCard(saved.id);
        card.upgraded = !!saved.upgraded;
        const cost = context === 'market' ? this.marketCardPickerPrice(mode, card) : card.cost;
        return { index, card, name: card.name, cost, upgraded: !!saved.upgraded };
      });
  }

  private applyCardPick(index: number) {
    if (this.cardPickerContext === 'market') {
      this.applyMarketCardPick(index);
      return;
    }
    const mode = this.cardPickerMode;
    const saved = this.runState.deck[index];
    if (!saved || !mode) return;
    const name = cardLibrary[saved.id]?.name ?? saved.id;
    if (mode === 'preen') {
      saved.upgraded = true;
      this.runState.routeLog.push(`Preened ${name}.`);
    } else {
      this.runState.routeLog.push(`Removed ${name}.`);
      this.runState.deck.splice(index, 1);
    }
    this.cardPickerRemainingPicks = Math.max(0, (this.cardPickerRemainingPicks || 1) - 1);
    this.runState.routeLog = this.runState.routeLog.slice(-8);
    if (this.cardPickerRemainingPicks > 0 && this.pickerEligibleCards(mode, 'route').length > 0) {
      this.cardPickerScroll = clamp(this.cardPickerScroll, 0, this.cardPickerMaxScroll(this.pickerEligibleCards(mode, 'route').length));
      this.hideHoverCardDetail();
      this.renderAll();
      return;
    }
    this.completePendingRouteNode();
    this.cardPickerMode = undefined;
    this.cardPickerContext = undefined;
    this.cardPickerRemainingPicks = 0;
    this.marketPickerUtilitySlot = undefined;
    this.routeCardPickerRestoreState = undefined;
    this.cardPickerScroll = 0;
    this.nodeChoiceNodeId = undefined;
    this.nodeChoicePreviousNodeId = undefined;
    this.runState.routeLog = this.runState.routeLog.slice(-8);
    this.scene.restart({ runState: cloneRunState(this.runState) });
  }

  private marketCardPickerPrice(mode: CardPickerMode, card?: Card) {
    return mode === 'preen' ? this.marketPreenPrice(card) : this.marketReleasePrice();
  }

  private cancelMarketCardPicker() {
    this.cardPickerMode = undefined;
    this.cardPickerContext = undefined;
    this.cardPickerRemainingPicks = 0;
    this.marketPickerUtilitySlot = undefined;
    this.cardPickerScroll = 0;
    this.renderAll();
  }

  private cancelRouteCardPicker() {
    const nodeId = this.nodeChoiceNodeId;
    if (this.routeCardPickerRestoreState) {
      this.runState = cloneRunState(this.routeCardPickerRestoreState);
    }
    this.cardPickerMode = undefined;
    this.cardPickerContext = undefined;
    this.cardPickerRemainingPicks = 0;
    this.marketPickerUtilitySlot = undefined;
    this.routeCardPickerRestoreState = undefined;
    this.cardPickerScroll = 0;
    this.nodeChoiceOpen = !!nodeId;
    this.hideHoverCardDetail();
    this.renderAll();
  }

  private applyMarketCardPick(index: number) {
    const mode = this.cardPickerMode;
    const slot = this.marketPickerUtilitySlot;
    if (!mode || slot === undefined) return;
    const listing = this.marketUtilityShelf[slot];
    if (!listing || listing.sold || listing.id !== mode) return;
    const entry = this.pickerEligibleCards(mode, 'market').find((candidate) => candidate.index === index);
    const saved = this.runState.deck[index];
    if (!entry || !saved || this.runState.scrap < entry.cost) return;
    const name = cardLibrary[saved.id]?.name ?? saved.id;
    this.runState.scrap -= entry.cost;
    listing.price = entry.cost;
    listing.sold = true;
    if (mode === 'preen') {
      saved.upgraded = true;
      this.marketMessage = `${name} is preened for ${entry.cost} Scrap.`;
    } else {
      this.runState.deck.splice(index, 1);
      this.marketMessage = `${name} is removed from the travel pack for ${entry.cost} Scrap.`;
    }
    this.applyRouteMarkTrigger('afterMarketPurchase');
    this.cardPickerMode = undefined;
    this.cardPickerContext = undefined;
    this.cardPickerRemainingPicks = 0;
    this.marketPickerUtilitySlot = undefined;
    this.cardPickerScroll = 0;
    this.renderAll();
  }

  private cardPickerMaxScroll(totalCards: number) {
    const columns = 5;
    const visibleRows = 2;
    return Math.max(0, Math.ceil(totalCards / columns) - visibleRows);
  }

  private scrollCardPicker(deltaRows: number) {
    if (!this.cardPickerMode) return;
    const totalCards = this.pickerEligibleCards(this.cardPickerMode).length;
    const next = clamp(this.cardPickerScroll + deltaRows, 0, this.cardPickerMaxScroll(totalCards));
    if (next === this.cardPickerScroll) return;
    this.cardPickerScroll = next;
    this.hideHoverCardDetail();
    this.renderAll();
  }

  private renderCardPickerScrollButton(x: number, y: number, direction: 'up' | 'down', enabled: boolean, onClick: () => void) {
    const accent = enabled ? UI_FIELD.gold : 0x3f4c58;
    const button = this.add.rectangle(x, y, 40, 32, enabled ? 0x0d1420 : 0x0a0e15, enabled ? 0.94 : 0.7)
      .setStrokeStyle(1.5, accent, enabled ? 0.82 : 0.46);
    const icon = addUiIconImage(this, direction === 'up' ? 'scroll-up-chevron' : 'scroll-down-chevron', x, y, 13);
    if (icon) icon.setAlpha(enabled ? 0.9 : 0.38);
    if (!enabled) return;
    button.setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => {
      playUiSound('confirm');
      onClick();
    });
  }

  private renderCardPickerOverlay() {
    const mode = this.cardPickerMode;
    if (!mode) return;
    const isMarketPicker = this.cardPickerContext === 'market';
    const eligible = this.pickerEligibleCards(mode);
    const node = currentMap().nodes.find((candidate) => candidate.id === (isMarketPicker ? this.marketNodeId : this.nodeChoiceNodeId));
    const accent = mode === 'preen' ? UI_FIELD.cyan : UI_FIELD.danger;
    const columns = 5;
    const visibleRows = 2;
    const visibleCount = columns * visibleRows;
    const rowGap = 176;
    const remainingPicks = Math.max(1, this.cardPickerRemainingPicks || 1);
    const maxScroll = this.cardPickerMaxScroll(eligible.length);
    this.cardPickerScroll = clamp(this.cardPickerScroll, 0, maxScroll);
    const firstVisible = this.cardPickerScroll * columns;
    const visible = eligible.slice(firstVisible, firstVisible + visibleCount);
    this.queueCardPickerArtLoad(visible);
    if (isMarketPicker) {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.72)
        .setInteractive({ useHandCursor: false });
    } else {
      this.renderRouteEventBackdrop(node, 0.82);
    }
    const frame = renderFieldPanel(this, (obj) => {}, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8, 1040, 558, {
      eyebrow: isMarketPicker ? 'Market Service' : node ? routeNodeTypeLabel(node.type) : 'Flock Workbench',
      title: mode === 'preen'
        ? remainingPicks > 1 ? `Preen ${remainingPicks} Cards` : 'Preen a Card'
        : remainingPicks > 1 ? `Remove ${remainingPicks} Cards` : 'Remove a Card',
      subtitle: mode === 'preen'
        ? isMarketPicker ? 'Choose which card Veyra improves, then pay Scrap.' : 'Choose the card the landmark workbench improves.'
        : isMarketPicker ? 'Choose which card is removed from the deck, then pay Scrap.' : 'Choose the card the flock removes before moving on.',
      accent,
      fill: mode === 'preen' ? 0x071824 : 0x1b1114
    });
    this.add.rectangle(frame.cx, frame.cy, frame.w - 36, frame.h - 36, 0x020409, 0.14);
    this.add.text(frame.left + 54, frame.top + 112, node?.label ?? 'Workshop stop', {
      fontFamily: UI_FONT,
      fontSize: '16px',
      fontStyle: UI_BOLD,
      color: UI_CYAN,
      wordWrap: { width: 360 },
      maxLines: 2
    });
    visible.forEach((entry, i) => {
      const cardW = 94;
      const cardH = Math.round(cardW * 1.5);
      const x = frame.left + 450 + (i % columns) * 112;
      const y = frame.top + 184 + Math.floor(i / columns) * rowGap;
      const affordable = !isMarketPicker || this.runState.scrap >= entry.cost;
      this.add.rectangle(x + 5, y + 7, cardW, cardH, 0x020409, 0.72);
      const key = compactCardArtKey(entry.card);
      if (key && this.textures.exists(key)) {
        this.add.image(x, y, key)
          .setDisplaySize(cardW, cardH)
          .setAlpha(affordable ? 1 : 0.48);
      } else if (!renderSnagCardBorder(this, undefined, entry.card, x, y, cardW, cardH, affordable ? 1 : 0.48)) {
        this.add.rectangle(x, y, cardW, cardH, affordable ? 0x101b2a : 0x0a0e15, affordable ? 0.96 : 0.78)
          .setStrokeStyle(1.5, affordable ? accent : 0x3f4c58, affordable ? 0.74 : 0.48);
        this.add.text(x, y - 16, cardLabel(entry.card), {
          fontFamily: UI_FONT,
          fontSize: '12px',
          fontStyle: UI_BOLD,
          color: affordable ? '#ffe1a3' : '#91a6b8',
          align: 'center',
          wordWrap: { width: cardW - 12 },
          maxLines: 2
        }).setOrigin(0.5);
      } else {
        this.add.rectangle(x, y, cardW, cardH, 0x05101a, 0.12);
      }
      this.add.circle(x - 34, y - 52, 14, affordable ? (entry.cost === 0 ? 0x24d0d6 : 0xd8a840) : 0x3f4c58, 1);
      this.add.text(x - 34, y - 60, `${entry.cost}`, {
        fontFamily: UI_FONT,
        fontSize: '12px',
        fontStyle: UI_BOLD,
        color: affordable ? '#07101c' : '#91a6b8'
      }).setOrigin(0.5, 0);
      this.add.rectangle(x, y + 82, cardW + 4, 25, 0x020409, 0.94);
      this.add.text(x, y + 72, `${entry.name}${entry.upgraded ? '+' : ''}`, {
        fontFamily: UI_FONT,
        fontSize: '11px',
        fontStyle: UI_BOLD,
        color: affordable ? '#ffe1a3' : '#91a6b8',
        align: 'center',
        wordWrap: { width: cardW - 6 },
        maxLines: 2
      }).setOrigin(0.5, 0);
      const button = this.add.rectangle(x, y + 10, cardW + 12, cardH + 54, 0x000000, 0.01)
        .setInteractive({ useHandCursor: affordable });
      if (affordable) button.on('pointerdown', () => this.applyCardPick(entry.index));
      button.on('pointerover', () => this.showHoverCardDetail(entry.card, mode === 'preen' ? 'Preen candidate' : 'Remove candidate', entry.cost, x, y));
      button.on('pointerout', () => this.hideHoverCardDetail());
    });
    if (eligible.length > visibleCount) {
      const scrollX = frame.right - 66;
      this.renderCardPickerScrollButton(scrollX, frame.top + 184, 'up', this.cardPickerScroll > 0, () => this.scrollCardPicker(-1));
      this.renderCardPickerScrollButton(scrollX, frame.top + 184 + rowGap, 'down', this.cardPickerScroll < maxScroll, () => this.scrollCardPicker(1));
      this.add.text(scrollX, frame.top + 218 + rowGap, `${firstVisible + 1}-${firstVisible + visible.length} / ${eligible.length}`, {
        fontFamily: UI_FONT,
        fontSize: '12px',
        color: '#91a6b8',
        align: 'center'
      }).setOrigin(0.5, 0);
    }
    if (isMarketPicker) {
      this.renderMarketEnamelButton(frame.left + 142, frame.bottom - 48, 176, 38, 'Back to Market', true, () => this.cancelMarketCardPicker(), UI_FIELD.cyan, '13px');
    } else {
      this.renderRouteEventCancelButton(frame.left + 126, frame.bottom - 48, 166, 38, 'Cancel', () => this.cancelRouteCardPicker());
    }
  }

  private renderRouteRewardCardOption(card: Card, x: number, y: number, cardW: number, cardH: number, accent: number) {
    const top = y - cardH / 2;
    const bottom = y + cardH / 2;
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

    this.add.rectangle(x, y, cardW, cardH, 0x0b1420, 0.98)
      .setStrokeStyle(2, accent, 0.9);
    this.add.rectangle(x, top + 18, cardW - 8, 32, 0x05080e, 0.86);
    this.add.rectangle(x, top + 42, cardW - 18, 2, accent, 0.72);
    this.add.circle(x - cardW / 2 + 22, top + 19, 15, card.cost === 0 ? 0x24d0d6 : 0xe8b830, 1)
      .setStrokeStyle(2, 0x05080e, 0.9);
    this.add.text(x - cardW / 2 + 22, top + 19, `${card.cost}`, {
      fontFamily: UI_FONT,
      fontSize: '16px',
      fontStyle: UI_BOLD,
      color: '#06101c'
    }).setOrigin(0.5);
    this.add.text(x - cardW / 2 + 42, top + 9, displayName(card), {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: '#ffe7b0',
      wordWrap: { width: cardW - 50 },
      maxLines: 2
    });
    this.add.text(x, top + 52, `${cardLabel(card)} / ${card.role.toUpperCase()}`, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_CYAN,
      align: 'center',
      wordWrap: { width: cardW - 16 },
      maxLines: 1
    }).setOrigin(0.5, 0);
    this.add.rectangle(x, bottom - 57, cardW - 10, 98, 0x05080e, 0.82);
    this.add.rectangle(x, bottom - 106, cardW - 10, 2, accent, 0.72);
    this.add.text(x, bottom - 96, displayText(card), {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: '#dbe6f2',
      align: 'center',
      lineSpacing: 1,
      wordWrap: { width: cardW - 20 },
      maxLines: 6
    }).setOrigin(0.5, 0);
  }

  private renderRouteRewardItemShowcase(item: PendingRouteRewardItem, x: number, y: number, w: number, h: number, companionCards: Card[] = []) {
    const isSupply = item.kind === 'supply';
    const supply = isSupply ? alphaSupplyLibrary.get(item.id) : undefined;
    const mark = !isSupply ? alphaRouteMarkLibrary.get(item.id) : undefined;
    if (!supply && !mark) return false;
    const accent = supply ? supplyAccent(supply) : mark ? routeMarkAccent(mark) : UI_FIELD.gold;
    const title = supply?.name ?? mark?.name ?? 'Found item';
    const kicker = supply
      ? `${supplyCategoryLabel(supply)} Supply / ${supply.rarity}`
      : mark
        ? `${routeMarkFamilyLabel(mark.family)} Waymark / ${mark.rarity}`
        : '';
    const summary = supply
      ? compactEffectSummary(supply.effects, 110)
      : mark
        ? compactEffectSummary(routeMarkEffectText(mark), 110)
        : '';
    const key = supply ? supplyArtAssets[supply.id]?.key : mark ? waymarkArtAssets[mark.id]?.key : undefined;
    const companion = companionCards[0];
    if (companion) {
      const itemKindLabel = supply
        ? `${supply.rarity.toUpperCase()} SUPPLY`
        : mark
          ? `${mark.rarity.toUpperCase()} WAYMARK`
          : 'ITEM';
      this.add.rectangle(x, y, w, h, 0x06101a, 0.9)
        .setStrokeStyle(2, accent, 0.76);
      this.add.rectangle(x, y - h / 2 + 16, w - 28, 3, accent, 0.72);

      const itemCx = x - 104;
      const cardCx = x + 108;
      const artY = y - 30;
      this.add.text(itemCx, y - 100, itemKindLabel, {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: UI_CYAN,
        align: 'center',
        wordWrap: { width: 150 },
        maxLines: 1
      }).setOrigin(0.5, 0);
      this.add.rectangle(itemCx, artY, 118, 118, 0x020409, 0.54)
        .setStrokeStyle(1, accent, 0.56);
      if (key && this.textures.exists(key)) {
        const image = supply
          ? addSupplyArtImage(this, itemCx, artY, key)
          : addWaymarkArtImage(this, itemCx, artY, key);
        image.setDisplaySize(104, 104);
      } else if (supply) {
        this.add.text(itemCx, artY - 17, this.supplyGlyph(supply), {
          fontFamily: UI_FONT,
          fontSize: '30px',
          fontStyle: UI_BOLD,
          color: '#ffe7c9',
          stroke: '#020409',
          strokeThickness: 2
        }).setOrigin(0.5, 0);
      } else if (mark) {
        this.add.text(itemCx, artY - 17, waymarkGlyph(mark), {
          fontFamily: UI_FONT,
          fontSize: '32px',
          fontStyle: UI_BOLD,
          color: '#efe4ff',
          stroke: '#020409',
          strokeThickness: 2
        }).setOrigin(0.5, 0);
      }
      this.add.text(itemCx, y + 42, title, {
        fontFamily: UI_FONT,
        fontSize: '14px',
        fontStyle: UI_BOLD,
        color: UI_GOLD,
        align: 'center',
        wordWrap: { width: 158 },
        maxLines: 2
      }).setOrigin(0.5, 0);
      this.add.text(itemCx, y + 79, summary, {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: UI_SOFT,
        align: 'center',
        lineSpacing: 1,
        wordWrap: { width: 168 },
        maxLines: 2
      }).setOrigin(0.5, 0);
      const itemHit = this.add.rectangle(itemCx, y - 1, 170, 210, 0x000000, 0.01)
        .setInteractive({ useHandCursor: true });
      itemHit.on('pointerover', () => {
        if (supply) this.showRewardSupplyDetail(supply, itemCx, y + 18);
        else if (mark) this.showRewardWaymarkDetail(mark, itemCx, y + 18);
      });
      itemHit.on('pointerout', () => this.hideMarketItemDetail());

      this.add.rectangle(x, y + 2, 1, h - 44, accent, 0.36);
      this.add.text(cardCx, y - 100, 'SNAG CARD', {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: '#ffd5cc',
        align: 'center',
        wordWrap: { width: 150 },
        maxLines: 1
      }).setOrigin(0.5, 0);
      this.renderRouteRewardCardOption(companion, cardCx, y - 4, 108, 162, UI_FIELD.danger);
      this.add.rectangle(cardCx, y + 93, 138, 28, 0x020409, 0.94)
        .setStrokeStyle(1, UI_FIELD.danger, 0.72);
      this.add.text(cardCx, y + 83, displayName(companion), {
        fontFamily: UI_FONT,
        fontSize: '11px',
        fontStyle: UI_BOLD,
        color: '#ffd5cc',
        align: 'center',
        wordWrap: { width: 126 },
        maxLines: 2
      }).setOrigin(0.5, 0);
      const cardHit = this.add.rectangle(cardCx, y - 4, 126, 208, 0x000000, 0.01)
        .setInteractive({ useHandCursor: true });
      cardHit.on('pointerover', () => this.showHoverCardDetail(companion, 'Cache consequence', companion.cost, cardCx, y - 4));
      cardHit.on('pointerout', () => this.hideHoverCardDetail());
      return true;
    }

    const artX = x - w / 2 + 114;
    const artY = y - 8;
    this.add.rectangle(x, y, w, h, 0x06101a, 0.9)
      .setStrokeStyle(2, accent, 0.76);
    this.add.rectangle(x, y - h / 2 + 16, w - 28, 3, accent, 0.72);
    this.add.rectangle(artX, artY, 142, 142, 0x020409, 0.54)
      .setStrokeStyle(1, accent, 0.56);
    if (key && this.textures.exists(key)) {
      const image = supply
        ? addSupplyArtImage(this, artX, artY, key)
        : addWaymarkArtImage(this, artX, artY, key);
      image.setDisplaySize(126, 126);
    } else if (supply) {
      this.add.text(artX, artY - 18, this.supplyGlyph(supply), {
        fontFamily: UI_FONT,
        fontSize: '34px',
        fontStyle: UI_BOLD,
        color: '#ffe7c9',
        stroke: '#020409',
        strokeThickness: 2
      }).setOrigin(0.5, 0);
    } else if (mark) {
      this.add.text(artX, artY - 18, waymarkGlyph(mark), {
        fontFamily: UI_FONT,
        fontSize: '36px',
        fontStyle: UI_BOLD,
        color: '#efe4ff',
        stroke: '#020409',
        strokeThickness: 2
      }).setOrigin(0.5, 0);
    }

    const tx = x - w / 2 + 205;
    const textW = w - 232;
    this.add.text(tx, y - 88, title, {
      fontFamily: UI_FONT,
      fontSize: '19px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      wordWrap: { width: textW },
      maxLines: 2
    });
    this.add.text(tx, y - 38, kicker, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: UI_CYAN,
      wordWrap: { width: textW },
      maxLines: 1
    });
    this.add.text(tx, y - 8, summary, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: UI_SOFT,
      lineSpacing: 2,
      wordWrap: { width: textW },
      maxLines: 4
    });
    const hit = this.add.rectangle(x, y, w - 22, h - 26, 0x000000, 0.01)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      if (supply) this.showRewardSupplyDetail(supply, x, y);
      else if (mark) this.showRewardWaymarkDetail(mark, x, y);
    });
    hit.on('pointerout', () => this.hideMarketItemDetail());
    return true;
  }

  private renderRouteRewardEffectShowcase(pending: PendingRouteReward, x: number, y: number, w: number, h: number) {
    const accent = pending.accent;
    const previewCards = pending.previewCards ?? [];
    this.add.rectangle(x, y, w, h, 0x06101a, 0.9)
      .setStrokeStyle(2, accent, 0.76);
    this.add.rectangle(x, y - h / 2 + 16, w - 28, 3, accent, 0.72);

    if (previewCards.length > 0) {
      const cardSlots = previewCards.slice(0, 2);
      const compactCards = cardSlots.length > 1;
      cardSlots.forEach((card, index) => {
        const cardX = compactCards ? x + 48 + index * 116 : x + 102;
        const cardW = compactCards ? 86 : 108;
        const cardH = Math.round(cardW * 1.5);
        const cardY = compactCards ? y - 10 : y - 4;
        const cardKindLabel = card.runtime.kind === 'snag'
          ? 'SNAG CARD'
          : `${card.runtime.rarity.toUpperCase()} CARD`;
        const cardAccent = card.runtime.kind === 'snag' ? UI_FIELD.danger : UI_FIELD.gold;
        const cardTextColor = card.runtime.kind === 'snag' ? '#ffd5cc' : UI_GOLD;
        this.add.text(cardX, y - 100, cardKindLabel, {
          fontFamily: UI_FONT,
          fontSize: compactCards ? '9px' : '10px',
          fontStyle: UI_BOLD,
          color: card.runtime.kind === 'snag' ? '#ffd5cc' : UI_CYAN,
          align: 'center',
          wordWrap: { width: compactCards ? 104 : 150 },
          maxLines: 1
        }).setOrigin(0.5, 0);
        this.renderRouteRewardCardOption(card, cardX, cardY, cardW, cardH, cardAccent);
        this.add.rectangle(cardX, y + 93, compactCards ? 104 : 138, 28, 0x020409, 0.94)
          .setStrokeStyle(1, cardAccent, 0.72);
        this.add.text(cardX, y + 83, displayName(card), {
          fontFamily: UI_FONT,
          fontSize: compactCards ? '10px' : '11px',
          fontStyle: UI_BOLD,
          color: cardTextColor,
          align: 'center',
          wordWrap: { width: compactCards ? 96 : 126 },
          maxLines: 2
        }).setOrigin(0.5, 0);
        const cardHit = this.add.rectangle(cardX, cardY, cardW + 18, cardH + 76, 0x000000, 0.01)
          .setInteractive({ useHandCursor: true });
        cardHit.on('pointerover', () => this.showHoverCardDetail(card, `${routeNodeTypeLabel(pending.nodeType)} preview`, card.cost, cardX, cardY));
        cardHit.on('pointerout', () => this.hideHoverCardDetail());
      });
      this.add.rectangle(x, y + 2, 1, h - 44, accent, 0.36);
    }

    const tokens = routeEffectTokens(pending.effects);
    const rows = this.routeChoicePreviewRows({
      key: pending.choiceKey,
      text: pending.choiceText,
      effects: pending.effects,
      locked: false
    });
    const leftX = previewCards.length > 0 ? x - 116 : x;
    const tileW = previewCards.length > 0 ? 146 : 332;
    const tileH = 56;
    const listTop = y - 68;
    const positiveTokens = tokens.filter((token) => token.color !== UI_FIELD.danger);
    const riskTokens = tokens.filter((token) => token.color === UI_FIELD.danger);
    const visualTokens = tokens.length <= 3
      ? tokens
      : [...positiveTokens.slice(0, Math.max(1, 3 - Math.min(2, riskTokens.length))), ...riskTokens.slice(0, 2)].slice(0, 3);
    if (visualTokens.length === 0) {
      this.add.text(leftX, y - 12, 'No reward will be taken.', {
        fontFamily: UI_FONT,
        fontSize: '15px',
        fontStyle: UI_BOLD,
        color: UI_SOFT,
        align: 'center',
        wordWrap: { width: tileW - 20 },
        maxLines: 2
      }).setOrigin(0.5, 0);
    } else {
      visualTokens.forEach((token, index) => {
        const ty = listTop + index * (tileH + 8);
        this.add.rectangle(leftX, ty, tileW, tileH, 0x020409, 0.68)
          .setStrokeStyle(1, token.color, 0.68);
        const compactTokenRow = tileW < 160;
        const iconX = leftX - tileW / 2 + (compactTokenRow ? 25 : 34);
        const labelX = leftX - tileW / 2 + (compactTokenRow ? 52 : 78);
        if (token.scrap) {
          addUiIconImage(this, 'scrap-gear', iconX, ty, compactTokenRow ? 16 : 18)?.setAlpha(0.94);
        } else if (token.icon) {
          addUiIconImage(this, token.icon, iconX, ty, compactTokenRow ? 16 : 18)?.setAlpha(0.92);
        }
        this.add.text(labelX, ty, token.label, {
          fontFamily: UI_FONT,
          fontSize: compactTokenRow ? '12px' : '14px',
          fontStyle: UI_BOLD,
          color: token.textColor,
          wordWrap: { width: tileW - (compactTokenRow ? 62 : 94) },
          maxLines: 1
        }).setOrigin(0, 0.5);
      });
    }
    if (rows.length > 0 && visualTokens.length === 0) {
      const summary = rows
        .slice(0, 3)
        .map((row) => `${row.label} ${this.routeChoiceChangeAmountText(row)}`)
        .join(' / ');
      this.add.text(leftX, y + 80, summary, {
        fontFamily: UI_FONT,
        fontSize: '11px',
        fontStyle: UI_BOLD,
        color: UI_SOFT,
        align: 'center',
        wordWrap: { width: tileW },
        maxLines: 2
      }).setOrigin(0.5, 0);
    }
    return true;
  }

  private renderRouteCardRewardOverlay() {
    const pending = this.pendingRouteReward;
    if (!pending) return;
    const node = currentMap().nodes.find((candidate) => candidate.id === pending.nodeId);
    const accent = pending.accent;
    const hasCardChoices = this.routeCardRewardChoices.length > 0;
    const isDecline = pending.effects.length === 0;
    if (hasCardChoices || (pending.previewCards?.length ?? 0) > 0) this.queueRouteRewardCardArtLoad();
    if (pending.previewItem) this.queueRouteRewardItemArtLoad();
    this.renderRouteEventBackdrop(node, 0.86);
    if (node) this.renderRouteEventAtmosphere(node, accent);
    const profile = ROUTE_SET_PIECE_PROFILES[pending.nodeType];
    const confirmName = profile?.residentName?.split(' ')[0] ?? routeNodeTypeLabel(pending.nodeType);
    const frame = renderFieldPanel(this, (obj) => {}, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8, 940, 558, {
      eyebrow: node ? routeNodeTypeLabel(node.type) : 'Route Reward',
      title: hasCardChoices ? 'Choose a Reward' : isDecline ? `Leave ${routeNodeTypeLabel(pending.nodeType)}` : pending.nodeType === 'cache' ? 'Open This Drawer' : 'Review This Choice',
      subtitle: hasCardChoices
        ? `Pick one card from this ${routeNodeTypeLabel(pending.nodeType).toLowerCase()}, or cancel back to ${confirmName}.`
        : isDecline
          ? `Leave without taking a reward, or cancel back to ${confirmName}.`
          : `Confirm this choice, or cancel back to ${confirmName}.`,
      accent,
      fill: 0x07101a
    });
    this.add.rectangle(frame.cx, frame.cy, frame.w - 36, frame.h - 36, 0x020409, 0.16);
    this.add.text(frame.left + 54, frame.top + 112, pending.choiceText, {
      fontFamily: UI_FONT,
      fontSize: '16px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      wordWrap: { width: 360 },
      maxLines: 2
    });
    this.add.text(frame.left + 54, frame.top + 164, pending.effectText || 'No reward will be taken.', {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: UI_SOFT,
      wordWrap: { width: 360 },
      maxLines: 2
    });
    this.add.rectangle(frame.left + 408, frame.cy + 14, 2, 396, accent, 0.36);
    if (!hasCardChoices) {
      const panelX = frame.left + 672;
      const panelY = frame.top + 326;
      if (!pending.previewItem || !this.renderRouteRewardItemShowcase(pending.previewItem, panelX, panelY, 410, 238, pending.previewCards ?? [])) {
        this.renderRouteRewardEffectShowcase(pending, panelX, panelY, 410, 238);
      }
      const claim = this.add.rectangle(frame.right - 158, frame.bottom - 48, 180, 38, 0x102235, 0.98)
        .setStrokeStyle(2, accent, 0.92)
        .setInteractive({ useHandCursor: true });
      claim.on('pointerover', () => claim.setFillStyle(0x18314a, 1));
      claim.on('pointerout', () => claim.setFillStyle(0x102235, 0.98));
      claim.on('pointerdown', () => {
        playUiSound('confirm');
        this.claimRouteReward();
      });
      const claimLabel = isDecline ? 'Leave' : pending.nodeType === 'cache' ? 'Claim' : 'Confirm';
      this.add.text(frame.right - 158, frame.bottom - 60, claimLabel, {
        fontFamily: UI_FONT,
        fontSize: '15px',
        fontStyle: UI_BOLD,
        color: UI_GOLD,
        align: 'center',
        fixedWidth: 150
      }).setOrigin(0.5, 0);
    }
    this.routeCardRewardChoices.forEach((card, index) => {
      const cardW = 148;
      const cardH = Math.round(cardW * 1.5);
      const x = frame.left + 540 + index * 190;
      const y = frame.top + 336;
      const accentColor = card.type === 'major' ? UI_FIELD.gold : card.type === 'molt' ? 0xc56cff : suitAccentColor(card);
      this.renderRouteRewardCardOption(card, x, y, cardW, cardH, accentColor);
      this.add.rectangle(x, y + cardH / 2 + 24, cardW + 16, 34, 0x020409, 0.94)
        .setStrokeStyle(1, accentColor, 0.72);
      this.add.text(x, y + cardH / 2 + 12, displayName(card), {
        fontFamily: UI_FONT,
        fontSize: '12px',
        fontStyle: UI_BOLD,
        color: UI_GOLD,
        align: 'center',
        wordWrap: { width: cardW },
        maxLines: 2
      }).setOrigin(0.5, 0);
      const hit = this.add.rectangle(x, y + 8, cardW + 18, cardH + 76, 0x000000, 0.01)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.chooseRouteRewardCard(card.id));
      hit.on('pointerover', () => this.showHoverCardDetail(card, 'Cache reward', card.cost, x, y));
      hit.on('pointerout', () => this.hideHoverCardDetail());
    });
    this.renderRouteEventCancelButton(frame.left + 126, frame.bottom - 48, 166, 38, 'Cancel', () => this.cancelRouteCardReward());
  }

  private showHoverCardDetail(card: Card, zone: string, cost: number, anchorX: number, anchorY: number) {
    this.hideMarketItemDetail();
    this.hideHoverCardDetail();
    const adjustedAnchorX = this.marketOpen && zone === 'Market offer'
      ? 440
      : anchorX;
    this.hoverCardDetail = renderFloatingCardDetail(this, card, zone, cost, adjustedAnchorX, anchorY);
  }

  private hideHoverCardDetail() {
    this.hoverCardDetail?.destroy(true);
    this.hoverCardDetail = undefined;
  }

  private showMarketWaymarkDetail(mark: RuntimeRouteMark, price: number, anchorX: number, anchorY: number) {
    this.showMarketItemDetail({
      title: mark.name,
      kicker: `${routeMarkFamilyLabel(mark.family)} Waymark / ${mark.rarity} / ${mark.source}`,
      body: mark.description,
      meta: `Trigger: ${mark.trigger}\nEffect: ${routeMarkEffectGrammar(mark)}`,
      price,
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
      meta: supply ? `Effects: ${supply.effects.join(', ')}` : this.marketUtilityDetail(listing),
      price: listing.price,
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
      meta: `Trigger: ${mark.trigger}\nEffect: ${routeMarkEffectGrammar(mark)}`,
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
      meta: `Effects: ${supply.effects.join(', ')}`,
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
    accent: number;
    anchorX: number;
    anchorY: number;
  }) {
    this.hideMarketItemDetail();
    this.hideHoverCardDetail();
    const w = 306;
    const body = this.add.text(16, 74, opts.body, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      color: '#dbe6f2',
      lineSpacing: 3,
      wordWrap: { width: w - 32 },
      maxLines: 4
    });
    const meta = this.add.text(16, 86 + body.height, opts.meta, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: UI_CYAN,
      lineSpacing: 2,
      wordWrap: { width: w - 32 },
      maxLines: 3
    });
    const h = Math.max(150, 104 + body.height + meta.height);
    const bg = this.add.rectangle(0, 0, w, h, 0x07101a, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(2, opts.accent, 1);
    const rail = this.add.rectangle(0, 0, w, 4, opts.accent, 1).setOrigin(0, 0);
    const title = this.add.text(16, 13, opts.title, {
      fontFamily: UI_FONT,
      fontSize: '17px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      wordWrap: { width: opts.price === undefined ? w - 32 : w - 92 },
      maxLines: 2
    });
    const price = opts.price === undefined
      ? undefined
      : this.add.text(w - 16, 16, `${opts.price}`, {
        fontFamily: UI_FONT,
        fontSize: '17px',
        fontStyle: UI_BOLD,
        color: '#f0c36f'
      }).setOrigin(1, 0);
    const scrapIcon = opts.price === undefined ? undefined : addScrapIconImage(this, w - 50, 28, 24);
    const kicker = this.add.text(16, 52, opts.kicker.toUpperCase(), {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: '#91a6b8',
      wordWrap: { width: w - 32 },
      maxLines: 1
    });
    const panelChildren = [bg, rail, title, ...(price ? [price] : []), ...(scrapIcon ? [scrapIcon] : []), kicker, body, meta];
    const panel = this.add.container(0, 0, panelChildren).setDepth(20000);
    const px = Math.max(12, Math.min(GAME_WIDTH - w - 12, opts.anchorX - w / 2));
    const above = opts.anchorY - h - 22;
    const py = above > 10 ? above : Math.min(GAME_HEIGHT - h - 12, opts.anchorY + 48);
    panel.setPosition(px, py);
    this.marketItemHover = panel;
  }

  private hideMarketItemDetail() {
    this.marketItemHover?.destroy(true);
    this.marketItemHover = undefined;
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
  // run state (next-level-data-contracts §6.3).
  private checkRouteCondition(condition: string) {
    const visitedType = /^visitedNodeType\(([a-zA-Z0-9_]+)\)$/.exec(condition);
    if (visitedType) {
      const wantedType = visitedType[1];
      return currentMap().nodes.some((node) =>
        node.type === wantedType && this.runState.completedRouteNodeIds.includes(node.id)
      );
    }
    return false;
  }

  private resolveRouteEffect(effect: string) {
    const conditional = /^if (.+?) then (.+)$/.exec(effect);
    if (conditional) {
      if (this.checkRouteCondition(conditional[1])) this.resolveRouteEffect(conditional[2]);
      return;
    }
    const parsed = parseEffect(effect);
    if (!parsed) return;
    const arg0 = parsed.args[0] ?? '';
    const n = Number(arg0);
    const max = this.runMaxHp();
    const rs = this.runState;
    const mod = (patch: NextCombatMods) => { rs.nextCombat = { ...rs.nextCombat, ...patch }; };
    switch (parsed.name) {
      case 'gainScrap': rs.scrap += n; break;
      case 'payScrap': rs.scrap = Math.max(0, rs.scrap - n); break;
      case 'loseCohesion': rs.currentHp = Math.max(0, rs.currentHp - n); break;
      case 'healCohesion': case 'heal': rs.currentHp = Math.min(max, rs.currentHp + n); break;
      case 'healMissingPct': {
        const heal = Math.max(Number(parsed.args[1]) || 0, Math.round(((max - rs.currentHp) * n) / 100));
        rs.currentHp = Math.min(max, rs.currentHp + heal);
        break;
      }
      case 'gainRouteMark': this.grantRouteMark(arg0); break;
      case 'gainSupply': this.grantSupply(arg0); break;
      case 'gainSupplyChoice': this.grantSupply('random'); break;
      case 'peekNextNodes': {
        const choices = this.getSelectableNodes().map((node) => node.label).slice(0, Math.max(1, n || 1) + 1);
        this.runState.routeLog.push(choices.length > 0
          ? `Route preview: ${choices.join(' / ')}.`
          : 'Route preview: no reachable crossings remain.');
        break;
      }
      case 'gainCacheReward': {
        const options = alphaCacheSet.options;
        const pick = options[Math.floor(Math.random() * options.length)];
        pick?.effects.forEach((inner) => this.resolveRouteEffect(inner));
        break;
      }
      case 'addSnagToDiscard': case 'addSnagToDraw': if (arg0) rs.deck.push({ id: arg0 }); break;
      case 'addCard': this.grantCard(arg0); break;
      case 'preenCard': for (let i = 0; i < (n || 1); i += 1) this.preenFirstAvailableCard(); break;
      case 'releaseCard': this.releaseFirstReleasable(n || 1); break;
      case 'gainOpenSkyGuard': mod({ openSkyGuard: (rs.nextCombat?.openSkyGuard ?? 0) + n }); break;
      case 'reduceNextOpenSky': mod({ reduceNextOpenSky: (rs.nextCombat?.reduceNextOpenSky ?? 0) + n }); break;
      case 'enemyCoverNextCombat': mod({ enemyCover: (rs.nextCombat?.enemyCover ?? 0) + n }); break;
      case 'bossDamageShield': mod({ bossDamageShield: (rs.nextCombat?.bossDamageShield ?? 0) + n }); break;
      case 'freePreenNextDistrict': rs.freePreenNextDistrict = (rs.freePreenNextDistrict ?? 0) + (n || 1); break;
      case 'increaseSupplySlots': rs.supplySlots = runSupplyCapacity(rs) + (n || 1); break;
      case 'startNextCombatOpenSky': mod({ startOpenSky: true }); break;
      // revealNodes / skipNextStreet / removeRouteChoice are route-graph hints;
      // Alpha pre-reveals the whole map, so they are no-ops here.
      default: break;
    }
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

  private grantSpecificCard(cardId: string) {
    if (!cardLibrary[cardId]) return;
    this.runState.deck.push({ id: cardId });
    discoverCards([cardId]);
  }

  private selectCardRewardId(selector: string) {
    const owned = new Set(this.runState.deck.map((card) => card.id));
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
    if (pool.length === 0) return;
    return pool[Math.floor(Math.random() * pool.length)];
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
    const frame = renderFieldPanel(this, (obj) => {}, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8, 1100, 560, {
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
      const button = this.add.rectangle(x, y, 520, 64, choice.locked ? 0x101827 : 0x122235, choice.locked ? 0.62 : 0.94)
        .setStrokeStyle(1.5, choice.locked ? 0x49606d : accent, choice.locked ? 0.5 : 0.82);
      if (!choice.locked) {
        button.setInteractive({ useHandCursor: true });
        button.on('pointerdown', () => this.chooseNodeOption(choice.key));
      }
      this.add.text(x - 238, y - 22, choice.text, {
        fontFamily: UI_FONT,
        fontSize: '16px',
        fontStyle: UI_BOLD,
        color: choice.locked ? '#7f93a8' : '#ffe1a3',
        wordWrap: { width: 456 },
        maxLines: 1
      });
      this.add.text(x - 238, y + 2, choice.locked && choice.lockedText ? choice.lockedText : routeEffectSummary(choice.effects), {
        fontFamily: UI_FONT,
        fontSize: '13px',
        color: choice.locked ? '#ff9d4d' : '#b9c7d6',
        wordWrap: { width: 456 },
        maxLines: 2
      });
    });
  }

  private renderRouteEventCancelButton(x: number, y: number, w: number, h: number, labelText: string, onClick: () => void) {
    const accent = UI_FIELD.danger;
    this.add.rectangle(x + 4, y + 5, w, h, 0x020409, 0.58).setDepth(22000);
    const hit = this.add.rectangle(x, y, w, h, 0x141820, 0.94)
      .setStrokeStyle(1, accent, 0.84)
      .setDepth(22001)
      .setInteractive({ useHandCursor: true });
    this.add.rectangle(x, y - h / 2 + 4, w - 22, 2, accent, 0.8).setDepth(22002);
    const icon = addUiIconImage(this, 'close-medallion', x - w / 2 + 17, y, Math.min(20, h - 8));
    icon?.setDepth(22003).setAlpha(0.92);
    const label = this.add.text(x + 14, y - 8, 'Exit', {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: '#ffd5cc',
      align: 'center',
      fixedWidth: 56,
      maxLines: 1
    }).setDepth(22003).setOrigin(0.5, 0);
    label.setText(labelText);
    hit.on('pointerover', () => {
      hit.setFillStyle(0x2a1720, 0.98);
      label.setColor('#ffffff');
    });
    hit.on('pointerout', () => {
      hit.setFillStyle(0x141820, 0.94);
      label.setColor('#ffd5cc');
    });
    hit.on('pointerdown', () => {
      playUiSound('close');
      onClick();
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
    this.marketNodeId = node.id;
    this.marketRefreshCount = 0;
    this.marketCardShelf = this.createMarketCardShelf(this.marketRng('cards'));
    this.marketWaymarkShelf = this.createMarketWaymarkShelf(this.marketRng('waymarks'));
    this.marketUtilityShelf = this.createMarketUtilityShelf(this.marketRng('utilities'));
    this.marketMessage = 'Fresh stock. Spend Scrap, tune up, or call new offers.';
    this.selectableNodeIds = new Set();
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
      this.runState.scrap += CACHE_SCRAP_REWARD;
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
    this.queueMarketKitArtLoad();
    this.queueOptionalCardArtLoad();
    this.queueMarketWaymarkArtLoad();
    this.queueMarketUtilityArtLoad();
    const node = currentMap().nodes.find((candidate) => candidate.id === this.marketNodeId);
    this.renderRouteEventBackdrop(node, 0.52);
    const frame = {
      left: 62,
      right: GAME_WIDTH - 62,
      top: 102,
      bottom: GAME_HEIGHT - 32,
      cx: GAME_WIDTH / 2,
      w: GAME_WIDTH - 124
    };

    this.renderMarketSceneBackdrop(frame);
    this.renderMarketVendor(frame);
    this.renderMarketVendorTitle(frame);

    const goodsRowY = frame.top + 500;
    this.renderMarketSectionHeader(frame.left + 576, frame.top + 114, 680, 'Crew Cards', 'Permanent deck options', UI_FIELD.gold);
    this.renderMarketSectionHeader(frame.left + 458, goodsRowY - 116, 330, 'Waymarks', 'Run modifiers', UI_FIELD.violet);
    this.renderMarketSectionHeader(frame.right - 124, frame.top + 154, 240, 'Services', 'Deck tuning', UI_FIELD.cyan);
    this.renderMarketSectionHeader(frame.left + 810, goodsRowY - 116, 300, 'Supplies', 'One-use tools', UI_FIELD.green);
    this.renderMarketCardOffers(frame.left + 576, frame.top + 286);
    this.renderMarketWaymarkOffers(frame.left + 458, goodsRowY);
    this.renderMarketUtilityOffers(frame.left + 810, frame.top + 292, goodsRowY);

    this.renderMarketEnamelButton(frame.right - 48, frame.top + 42, 86, 30, 'Close', true, () => {
      playUiSound('close');
      this.leaveMarket();
    }, UI_FIELD.danger, '13px');
  }

  private renderMarketSectionHeader(x: number, y: number, w: number, title: string, subtitle: string, accent: number) {
    this.add.rectangle(x, y, w, 1, accent, 0.72);
    this.add.rectangle(x - w / 2 + 4, y + 13, 4, 26, accent, 0.78);
    this.add.text(x - w / 2 + 14, y + 4, title.toUpperCase(), {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_GOLD
    });
    this.add.text(x - w / 2 + 14, y + 19, subtitle, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: UI_MUTED
    });
  }

  private renderMarketVendorTitle(frame: { cx: number; top: number }) {
    const x = frame.cx;
    const y = frame.top + 38;
    const w = 408;
    const h = 48;
    this.add.rectangle(x, y, w, h, 0x080604, 1)
      .setStrokeStyle(MENU_BORDER_WIDTH, UI_FIELD.gold, 0.9);
    this.add.text(x, y - 16, 'Veyra Tallybright', {
      fontFamily: UI_FONT,
      fontSize: '20px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      stroke: '#020409',
      strokeThickness: 4,
      align: 'center'
    }).setOrigin(0.5, 0);
    this.add.text(x, y + 9, 'CANAL CURATOR', {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_CYAN,
      align: 'center'
    }).setOrigin(0.5, 0);
  }

  private renderMarketScrapTag(x: number, y: number) {
    renderHudMetricChip(this, (obj) => {}, x, y, 124, 'Scrap', `${this.runState.scrap}`, UI_FIELD.gold, {
      valueColor: UI_FIELD.warm
    });
  }

  private renderMarketSceneBackdrop(frame: { left: number; right: number; top: number; bottom: number; cx: number; w: number }) {
    const backgroundKey = MARKET_KIT_ASSETS.background.key;
    const signKey = MARKET_KIT_ASSETS.sign.key;
    const counterKey = MARKET_KIT_ASSETS.counter.key;
    const hasBackground = this.textures.exists(backgroundKey);

    if (hasBackground) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, backgroundKey)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(1);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.07);
    } else {
      this.add.rectangle(frame.cx, frame.top + 360, frame.w - 86, 460, 0x080604, 0.28)
        .setStrokeStyle(1, UI_FIELD.gold, 0.14);
      for (let i = 0; i < 17; i += 1) {
        const lx = frame.left + 118 + i * 52;
        this.add.line(lx - 24, frame.top + 210, 0, 0, 48, i % 2 === 0 ? 8 : -3, UI_FIELD.gold, 0.34);
        this.add.circle(lx, frame.top + 213 + (i % 2) * 7, 4, i % 3 === 0 ? 0x8df4ff : 0xf0c36f, 0.86);
      }
    }

    if (this.textures.exists(signKey)) {
      this.add.image(frame.cx, frame.top + 160, signKey)
        .setDisplaySize(486, 274)
        .setAlpha(1);
    } else {
      this.add.rectangle(frame.cx, frame.top + 168, 456, 58, 0x241708, 0.86)
        .setStrokeStyle(1, UI_FIELD.gold, 0.52);
    }

    if (this.textures.exists(counterKey)) {
      this.add.image(frame.cx + 44, frame.bottom + 8, counterKey)
        .setOrigin(0.5, 1)
        .setDisplaySize(982, 524)
        .setAlpha(1);
    } else {
      this.add.rectangle(frame.cx + 26, frame.bottom - 108, frame.w - 164, 128, 0x130c06, 0.96)
        .setStrokeStyle(2, 0x7b4f18, 0.88);
      this.add.rectangle(frame.cx + 26, frame.bottom - 166, frame.w - 138, 18, 0x321f0d, 0.98)
        .setStrokeStyle(1, UI_FIELD.gold, 0.48);
    }

  }

  private renderMarketVendor(frame: { left: number; top: number; bottom: number }) {
    const x = frame.left + 90;
    const y = frame.bottom + 136;
    const shopkeeperKey = MARKET_KIT_ASSETS.shopkeeper.key;
    if (this.textures.exists(shopkeeperKey)) {
      this.add.ellipse(x + 8, y - 19, 254, 42, 0x020409, 0.5);
      const vendor = this.add.image(x, y, shopkeeperKey)
        .setOrigin(0.5, 1)
        .setDisplaySize(408, 612)
        .setAlpha(1)
        .setDepth(20);
      vendor.setName('market-vendor-shopkeeper');
      this.animateMarketVendorIdle(vendor);
      return;
    }

    const fallbackY = frame.bottom - 206;
    this.add.rectangle(x, fallbackY + 54, 112, 150, 0x0b1018, 0.98)
      .setStrokeStyle(2, UI_FIELD.gold, 0.62);
    this.add.circle(x, fallbackY - 28, 44, 0x1b2630, 0.98)
      .setStrokeStyle(2, UI_FIELD.cyan, 0.68);
    this.add.circle(x - 16, fallbackY - 34, 7, 0xf0c36f, 0.95);
    this.add.circle(x + 18, fallbackY - 34, 7, 0xf0c36f, 0.95);
    this.add.rectangle(x, fallbackY - 6, 72, 12, 0xf0c36f, 0.76);
    this.add.rectangle(x - 52, fallbackY + 42, 18, 88, 0xd8a840, 0.52).setAngle(-16);
    this.add.rectangle(x + 52, fallbackY + 42, 18, 88, 0xd8a840, 0.52).setAngle(16);
  }

  private animateMarketVendorIdle(vendor: Phaser.GameObjects.Image) {
    const baseScaleX = vendor.scaleX;
    const baseScaleY = vendor.scaleY;
    this.tweens.add({
      targets: vendor,
      scaleX: baseScaleX * 0.996,
      scaleY: baseScaleY * 1.012,
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
      return { x: 190, y: GAME_HEIGHT + 70, maxWidth: 420, maxHeight: 590 };
    }

    return { x: 176, y: GAME_HEIGHT + 42, maxWidth: 340, maxHeight: 500 };
  }

  private renderRouteEventAtmosphere(node: RouteNode, accent: number) {
    const glowPoints = node.type === 'signal'
      ? [{ x: 516, y: 278, r: 78 }, { x: 625, y: 454, r: 58 }, { x: 928, y: 238, r: 44 }]
      : node.type === 'cache'
        ? [{ x: 516, y: 384, r: 92 }, { x: 690, y: 300, r: 44 }, { x: 940, y: 514, r: 42 }]
        : [{ x: 238, y: 418, r: 82 }, { x: 985, y: 304, r: 62 }];
    glowPoints.forEach((point, index) => {
      const glow = this.add.circle(point.x, point.y, point.r, accent, 0.07 + index * 0.015)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.045, to: 0.16 },
        scale: { from: 0.92, to: 1.06 },
        duration: 1700 + index * 320,
        yoyo: true,
        repeat: -1
      });
    });
    const moteColor = node.type === 'cache' ? UI_FIELD.gold : node.type === 'signal' ? UI_FIELD.violet : accent;
    for (let i = 0; i < 5; i += 1) {
      const mote = this.add.rectangle(438 + i * 95, 192 + (i % 2) * 34, 30, 2, moteColor, 0.22)
        .setAngle(-10 + i * 5)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: mote,
        alpha: { from: 0.08, to: 0.32 },
        x: mote.x + 12,
        duration: 1500 + i * 180,
        yoyo: true,
        repeat: -1
      });
    }
  }

  private renderRouteEventTitlePlaque(node: RouteNode, x: number, y: number, w = 560) {
    const accent = routeEventAccent(node.type);
    const profile = ROUTE_SET_PIECE_PROFILES[node.type];
    this.add.rectangle(x + 4, y + 5, w, 82, 0x020409, 0.48);
    this.add.rectangle(x, y, w, 78, 0x020409, 0.97)
      .setStrokeStyle(2, accent, 0.92);
    this.add.rectangle(x, y - 32, w - 34, 2, accent, 0.68);
    this.add.text(x, y - 22, profile?.residentName ?? node.label, {
      fontFamily: UI_FONT,
      fontSize: '24px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center'
    }).setOrigin(0.5);
    this.add.text(x, y + 6, profile?.residentRole ?? routeNodeTypeLabel(node.type), {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: UI_CYAN,
      align: 'center'
    }).setOrigin(0.5);
    this.add.text(x, y + 23, (profile?.species ?? routeNodeTypeLabel(node.type)).toUpperCase(), {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: UI_SOFT,
      align: 'center'
    }).setOrigin(0.5);
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
        .setAlpha(0.99);
      this.fitImageInside(residentImage, maxWidth, maxHeight);
      return;
    }
    this.add.circle(x, floorY - maxHeight * 0.34, 82, 0x1c2230, 0.98)
      .setStrokeStyle(2, accent, 0.82);
    this.renderRouteNodeTypeIcon(node.type, x, floorY - maxHeight * 0.34, 96);
  }

  private renderEventEffectTokens(
    choice: NodeChoiceOption,
    x: number,
    y: number,
    maxWidth: number,
    compact = false
  ) {
    const tokens: RouteEffectToken[] = choice.locked
      ? [{ label: choice.lockedText ?? 'Locked', color: UI_FIELD.danger, textColor: '#ffd5cc', icon: 'locked-padlock' }]
      : routeEffectTokens(choice.effects);
    const maxTokens = compact ? 2 : 3;
    let cursor = x;
    tokens.slice(0, maxTokens).forEach((token) => {
      const label = token.label.length > 14 ? `${token.label.slice(0, 12)}...` : token.label;
      const w = Math.min(124, Math.max(62, label.length * 7 + (token.icon || token.scrap ? 36 : 18)));
      if (cursor + w > x + maxWidth) return;
      this.add.rectangle(cursor + w / 2, y, w, compact ? 18 : 22, 0x020409, 0.72)
        .setStrokeStyle(1, token.color, 0.82);
      if (token.scrap) {
        addUiIconImage(this, 'scrap-gear', cursor + 15, y, compact ? 13 : 15)
          ?.setAlpha(choice.locked ? 0.46 : 0.94);
      } else if (token.icon) {
        addUiIconImage(this, token.icon, cursor + 15, y, compact ? 13 : 15)
          ?.setAlpha(choice.locked ? 0.46 : 0.92);
      }
      this.add.text(cursor + (token.icon || token.scrap ? 29 : 9), y - (compact ? 7 : 8), label, {
        fontFamily: UI_FONT,
        fontSize: compact ? '9px' : '10px',
        fontStyle: UI_BOLD,
        color: choice.locked ? '#91a6b8' : token.textColor,
        wordWrap: { width: w - (token.icon || token.scrap ? 34 : 12) },
        maxLines: 1
      });
      cursor += w + 7;
    });
    if (tokens.length > maxTokens && cursor + 34 <= x + maxWidth) {
      this.add.text(cursor + 4, y - 7, `+${tokens.length - maxTokens}`, {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: UI_SOFT
      });
    }
  }

  private routeChoicePreviewRows(choice: NodeChoiceOption): Array<{ label: string; before: string; after: string; color: string }> {
    const rows = new Map<string, { label: string; before: string; after: string; color: string }>();
    const maxHp = this.runMaxHp();
    let scrap = this.runState.scrap;
    let hp = this.runState.currentHp;
    let deck = this.runState.deck.length;
    let supplies = this.runState.supplies.length;
    let waymarks = this.runState.routeMarks.length;
    const supplyCap = runSupplyCapacity(this.runState);
    const setRow = (id: string, label: string, before: string, after: string, color: string) => {
      rows.set(id, { label, before, after, color });
    };
    const visit = (effect: string) => {
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
          hp = Math.min(maxHp, hp + n);
          setRow('hp', 'Cohesion', `${before}/${maxHp}`, `${hp}/${maxHp}`, '#e4fbe9');
          break;
        }
        case 'healMissingPct': {
          const before = hp;
          const heal = Math.max(Number(parsed.args[1]) || 0, Math.round(((maxHp - hp) * n) / 100));
          hp = Math.min(maxHp, hp + heal);
          setRow('hp', 'Cohesion', `${before}/${maxHp}`, `${hp}/${maxHp}`, '#e4fbe9');
          break;
        }
        case 'addCard':
        case 'addSnagToDiscard':
        case 'addSnagToDraw': {
          const before = deck;
          deck += 1;
          setRow('deck', 'Deck', `${before}`, `${deck}`, parsed.name === 'addCard' ? '#fff0b8' : '#ffd5cc');
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
        case 'gainOpenSkyGuard':
          setRow('guard', 'Next combat', 'Guard', `+${n}`, '#e4fbe9');
          break;
        case 'reduceNextOpenSky':
          setRow('sky', 'Open Sky', 'Next rise', `-${n}`, '#dffbff');
          break;
        case 'peekNextNodes':
        case 'revealNodes':
          setRow('intel', 'Route intel', 'Hidden', `${n || 1} look`, '#dffbff');
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

  private routeChoiceChangeAmountText(row: { before: string; after: string }) {
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

  private showRouteChoiceDetail(
    node: RouteNode,
    choice: NodeChoiceOption,
    anchorX: number,
    anchorY: number,
    accent: number
  ) {
    this.hideRouteChoiceDetail();
    this.hideMarketItemDetail();
    this.hideHoverCardDetail();
    const w = 330;
    const rows = this.routeChoicePreviewRows(choice);
    const h = Math.max(168, 128 + rows.length * 27);
    const panel = this.add.container(0, 0).setDepth(22000);
    const bg = this.add.rectangle(0, 0, w, h, 0x07101a, 0.985)
      .setOrigin(0, 0)
      .setStrokeStyle(2, choice.locked ? UI_FIELD.danger : accent, 0.96);
    panel.add(bg);
    panel.add(this.add.rectangle(0, 0, w, 4, choice.locked ? UI_FIELD.danger : accent, 1).setOrigin(0, 0));
    panel.add(this.add.text(16, 13, choice.text, {
      fontFamily: UI_FONT,
      fontSize: '17px',
      fontStyle: UI_BOLD,
      color: choice.locked ? '#ffb8ad' : UI_GOLD,
      wordWrap: { width: w - 32 },
      maxLines: 2
    }));
    panel.add(this.add.text(16, 52, `${routeNodeTypeLabel(node.type)} / ${choice.locked ? 'LOCKED' : 'CHOICE'}`, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: choice.locked ? '#ff9d4d' : UI_CYAN,
      wordWrap: { width: w - 32 },
      maxLines: 1
    }));
    panel.add(this.add.text(16, 74, choice.locked && choice.lockedText ? choice.lockedText : routeEffectSummary(choice.effects), {
      fontFamily: UI_FONT,
      fontSize: '12px',
      color: '#dbe6f2',
      lineSpacing: 2,
      wordWrap: { width: w - 32 },
      maxLines: 2
    }));
    const rowY = 118;
    if (rows.length === 0) {
      panel.add(this.add.text(16, rowY, 'No resource change. You simply keep moving.', {
        fontFamily: UI_FONT,
        fontSize: '12px',
        color: UI_SOFT,
        wordWrap: { width: w - 32 },
        maxLines: 2
      }));
    } else {
      panel.add(this.add.text(16, rowY - 18, 'PREVIEW', {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: UI_MUTED
      }));
      rows.forEach((row, index) => {
        const y = rowY + index * 27;
        panel.add(this.add.rectangle(16, y - 1, w - 32, 22, 0x020409, 0.62)
          .setOrigin(0, 0)
          .setStrokeStyle(1, 0x49606d, 0.36));
        panel.add(this.add.text(26, y + 4, row.label, {
          fontFamily: UI_FONT,
          fontSize: '11px',
          fontStyle: UI_BOLD,
          color: UI_SOFT,
          maxLines: 1
        }));
        panel.add(this.add.text(w - 24, y + 4, `${row.before} -> ${row.after}`, {
          fontFamily: UI_FONT,
          fontSize: '11px',
          fontStyle: UI_BOLD,
          color: row.color,
          align: 'right',
          maxLines: 1
        }).setOrigin(1, 0));
      });
    }
    const px = Math.max(20, Math.min(GAME_WIDTH - w - 20, anchorX - w - 238));
    const py = Math.max(96, Math.min(GAME_HEIGHT - h - 18, anchorY - h / 2));
    panel.setPosition(px, py);
    this.routeChoiceHover = panel;
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

    this.renderRouteEventAtmosphere(node, accent);
    this.add.rectangle(GAME_WIDTH / 2, 24, GAME_WIDTH - 100, 2, accent, 0.38);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 28, GAME_WIDTH - 100, 2, accent, 0.34);

    this.renderRouteEventTitlePlaque(node, GAME_WIDTH / 2, 132, 548);
    this.renderRouteEventResident(node, 146, GAME_HEIGHT + 58, 350, 460, { showGlow: false });
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
    if (this.textures.exists(prop.key)) {
      this.renderRouteEventPropCenterpiece(prop, x + 12, y + 8, w + 76, h + 84, accent, 0xff8c36, {
        showGlow: false,
        showAccentLine: false
      });
      return;
    }
    this.add.rectangle(x + 8, y + 10, w, h, 0x020409, 0.42);
    this.add.rectangle(x, y, w, h, 0x08120f, 0.9)
      .setStrokeStyle(2, accent, 0.78);
    this.add.rectangle(x, y - h / 2 + 26, w - 44, 3, accent, 0.68);
    this.add.text(x, y - h / 2 + 42, 'ROOST HEARTH SERVICE', {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      align: 'center'
    }).setOrigin(0.5);
    const hearth = this.add.circle(x, y + 2, 64, 0x3b1708, 0.94)
      .setStrokeStyle(2, UI_FIELD.gold, 0.82);
    this.add.circle(x, y + 2, 42, 0xff9d4d, 0.34)
      .setBlendMode(Phaser.BlendModes.ADD);
    [
      { icon: 'flock-heart' as UiIconId, label: 'Recover', dx: -134, color: UI_FIELD.green },
      { icon: 'cover-shield' as UiIconId, label: 'Shelter', dx: 0, color: UI_FIELD.cyan },
      { icon: 'supply-pouch' as UiIconId, label: 'Pack', dx: 134, color: 0xffb86b }
    ].forEach((item) => {
      this.add.rectangle(x + item.dx, y + 102, 112, 44, 0x020409, 0.66)
        .setStrokeStyle(1, item.color, 0.66);
      addUiIconImage(this, item.icon, x + item.dx - 32, y + 102, 18)
        ?.setAlpha(0.9);
      this.add.text(x + item.dx - 4, y + 96, item.label, {
        fontFamily: UI_FONT,
        fontSize: '11px',
        fontStyle: UI_BOLD,
        color: '#dbe6f2',
        align: 'center',
        fixedWidth: 74
      });
    });
    for (let i = 0; i < 4; i += 1) {
      this.add.rectangle(x - 58 + i * 38, y - 84, 16, 2, 0xdffbff, 0.18)
        .setAngle(-82 + i * 8)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
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

    this.renderRouteEventAtmosphere(node, accent);
    this.renderRouteEventTitlePlaque(node, GAME_WIDTH / 2, 132, 560);
    const residentFrame = this.routeSetPieceResidentFrame(node);
    this.renderRouteEventResident(node, residentFrame.x, residentFrame.y, residentFrame.maxWidth, residentFrame.maxHeight);

    const compact = choices.length > 5;
    const choiceHeight = compact ? 56 : 78;
    const gap = compact ? 9 : 18;
    const totalHeight = choices.length * choiceHeight + Math.max(0, choices.length - 1) * gap;
    const startY = GAME_HEIGHT / 2 - totalHeight / 2 + choiceHeight / 2 + (compact ? 24 : 20);
    choices.forEach((choice, index) => {
      const x = 1010;
      const y = startY + index * (choiceHeight + gap);
      this.renderSetPieceChoice(choice, x, y, index, accent, choiceHeight, compact);
    });
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
    this.renderRouteEventAtmosphere(node, accent);
    this.renderRouteEventTitlePlaque(node, GAME_WIDTH / 2, 132, 560);
    this.renderRouteEventResident(node, 146, GAME_HEIGHT + 70, 350, 560, { showGlow: false });
    this.renderNestWorkbench(1018, 488, 392, 300, accent);
    this.renderRouteEventChoiceColumn(node, choices, 560, 316, 472, accent);
  }

  private renderNestWorkbench(x: number, y: number, w: number, h: number, accent: number) {
    const prop = ROUTE_EVENT_PROP_ASSETS.nestFeatherwrightBench;
    if (this.textures.exists(prop.key)) {
      this.renderRouteEventPropCenterpiece(prop, x + 18, y + 8, w + 94, h + 70, accent, 0xffd37a, {
        showGlow: false,
        showAccentLine: false
      });
      return;
    }
    this.add.rectangle(x + 8, y + 10, w, h, 0x020409, 0.42);
    this.add.rectangle(x, y, w, h, 0x07101a, 0.9)
      .setStrokeStyle(2, accent, 0.82);
    this.add.rectangle(x, y - h / 2 + 26, w - 44, 3, accent, 0.7);
    this.add.text(x, y - h / 2 + 42, 'FEATHERWRIGHT DECK BENCH', {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      align: 'center'
    }).setOrigin(0.5);
    this.add.rectangle(x, y + 36, w - 86, 96, 0x020409, 0.46)
      .setStrokeStyle(1, accent, 0.36);
    this.renderRouteNodeTypeIcon('nest', x, y - 18, 110);
    [
      { icon: 'preen-kit' as UiIconId, label: 'Preen', x: x - 130, y: y + 92, color: UI_FIELD.cyan },
      { icon: 'deck-stack' as UiIconId, label: 'Sleeve', x, y: y + 104, color: UI_FIELD.gold },
      { icon: 'release-card' as UiIconId, label: 'Remove', x: x + 130, y: y + 92, color: UI_FIELD.danger }
    ].forEach((tool) => {
      this.add.rectangle(tool.x, tool.y, 104, 48, 0x020409, 0.68)
        .setStrokeStyle(1, tool.color, 0.66);
      addUiIconImage(this, tool.icon, tool.x - 31, tool.y, 18)
        ?.setAlpha(0.92);
      this.add.text(tool.x - 2, tool.y - 7, tool.label, {
        fontFamily: UI_FONT,
        fontSize: '11px',
        fontStyle: UI_BOLD,
        color: '#dbe6f2',
        fixedWidth: 74,
        align: 'center'
      });
    });
    this.add.circle(x + 126, y - 78, 36, accent, 0.12)
      .setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 4; i += 1) {
      this.add.rectangle(x - 136 + i * 82, y + 16 + (i % 2) * 10, 52, 4, 0xd8a840, 0.5)
        .setAngle(-8 + i * 5);
    }
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
    this.renderRouteEventAtmosphere(node, accent);
    this.renderRouteEventTitlePlaque(node, GAME_WIDTH / 2, 132, 560);
    this.renderRouteEventResident(node, 146, GAME_HEIGHT + 62, 350, 500, { showGlow: false });
    this.renderCacheCabinet(node, 620, 438, 590, 506, choices, accent);
  }

  private renderCacheCabinet(node: RouteNode, x: number, y: number, w: number, h: number, choices: NodeChoiceOption[], accent: number) {
    const top = y - h / 2;
    const cabinetAsset = ROUTE_EVENT_PROP_ASSETS.marnLockboxCabinet;
    const cabinetX = x + 412;
    const optionX = x - 58;

    if (this.textures.exists(cabinetAsset.key)) {
      this.add.ellipse(cabinetX, top + 420, 418, 42, 0x020409, 0.32);
      const cabinetImage = this.add.image(cabinetX, top + 302, cabinetAsset.key)
        .setAlpha(0.98);
      this.fitImageInside(cabinetImage, 438, 386);
    } else {
      this.renderRouteNodeTypeIcon('cache', cabinetX, top + 302, 120);
    }

    const optionW = 472;
    const optionH = choices.length > 6 ? 48 : 54;
    const panelStartY = top + 144;
    const startY = panelStartY + 12;
    const optionPanelH = choices.length * (optionH + 6) + 56;
    const optionPanelY = panelStartY + optionPanelH / 2 - 26;
    this.add.rectangle(optionX + 7, optionPanelY + 8, optionW + 40, optionPanelH, 0x020409, 0.34);
    this.add.rectangle(optionX, optionPanelY, optionW + 40, optionPanelH, 0x06101a, 0.58)
      .setStrokeStyle(2, accent, 0.78);
    this.add.rectangle(optionX, panelStartY - 42, optionW - 28, 2, accent, 0.62);
    this.add.text(optionX - optionW / 2 + 20, panelStartY - 33, 'MARN WAITS FOR YOUR NOD', {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_SOFT,
      align: 'left'
    }).setOrigin(0, 0.5);

    choices.forEach((choice, i) => {
      const dy = startY + i * (optionH + 6);
      this.renderCacheDrawerTile(node, choice, optionX, dy, optionW, optionH, i, accent);
    });
    this.add.rectangle(cabinetX + 96, top + 208, 72, 2, 0xffffff, 0.14)
      .setAngle(-18)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  private routeEventChoiceColumnHeader(node: RouteNode) {
    const firstName = ROUTE_SET_PIECE_PROFILES[node.type]?.residentName.split(' ')[0] ?? routeNodeTypeLabel(node.type);
    switch (node.type) {
      case 'basin': return `${firstName.toUpperCase()} KEEPS THE HEARTH READY`;
      case 'nest': return `${firstName.toUpperCase()} WAITS AT THE BENCH`;
      case 'signal': return `${firstName.toUpperCase()} HOLDS THE SWITCHES`;
      default: return `${firstName.toUpperCase()} WAITS FOR YOUR NOD`;
    }
  }

  private renderRouteEventChoiceColumn(node: RouteNode, choices: NodeChoiceOption[], x: number, top: number, w: number, accent: number) {
    const optionH = choices.length > 6 ? 38 : 44;
    const optionGap = 6;
    const panelH = choices.length * (optionH + optionGap) + 56;
    const panelY = top + panelH / 2 - 26;
    this.add.rectangle(x + 7, panelY + 8, w + 40, panelH, 0x020409, 0.34);
    this.add.rectangle(x, panelY, w + 40, panelH, 0x06101a, 0.58)
      .setStrokeStyle(2, accent, 0.78);
    this.add.rectangle(x, top - 42, w - 28, 2, accent, 0.62);
    this.add.text(x - w / 2 + 20, top - 33, this.routeEventChoiceColumnHeader(node), {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_SOFT,
      align: 'left',
      maxLines: 1
    }).setOrigin(0, 0.5);
    choices.forEach((choice, index) => {
      this.renderRouteEventChoiceTile(node, choice, x, top + index * (optionH + optionGap), w, optionH, index, accent);
    });
  }

  private renderRouteEventChoiceTile(
    node: RouteNode,
    choice: NodeChoiceOption,
    x: number,
    y: number,
    w: number,
    h: number,
    index: number,
    accent: number
  ) {
    const token = routeEffectTokens(choice.effects)[0];
    const colors = [UI_FIELD.green, UI_FIELD.cyan, UI_FIELD.gold, 0xffb86b, UI_FIELD.violet, UI_FIELD.danger];
    const choiceAccent = choice.locked ? 0x49606d : token?.color ?? colors[index % colors.length] ?? accent;
    this.add.rectangle(x + 3, y + 4, w, h, 0x020409, 0.2);
    const bg = this.add.rectangle(x, y, w, h, choice.locked ? 0x0b1018 : 0xf3f7ff, choice.locked ? 0.34 : 0.055)
      .setStrokeStyle(1, choiceAccent, choice.locked ? 0.34 : 0.45);
    bg.setInteractive({ useHandCursor: !choice.locked });
    if (!choice.locked) bg.on('pointerdown', () => this.chooseNodeOption(choice.key));
    bg.on('pointerover', () => {
      bg.setFillStyle(choice.locked ? 0x141827 : 0xf3f7ff, choice.locked ? 0.48 : 0.16);
      bg.setStrokeStyle(1, choice.locked ? UI_FIELD.danger : choiceAccent, 0.92);
      this.hideRouteChoiceDetail();
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(choice.locked ? 0x0b1018 : 0xf3f7ff, choice.locked ? 0.34 : 0.055);
      bg.setStrokeStyle(1, choiceAccent, choice.locked ? 0.34 : 0.45);
      this.hideRouteChoiceDetail();
    });
    this.add.rectangle(x - w / 2 + 5, y, 4, h - 10, choiceAccent, choice.locked ? 0.38 : 0.72);
    this.add.text(x - w / 2 + 21, y - 8, `${index + 1}`.padStart(2, '0'), {
      fontFamily: UI_FONT,
      fontSize: '16px',
      fontStyle: UI_BOLD,
      color: choice.locked ? '#65788b' : '#ffe1a3',
      align: 'center',
      fixedWidth: 38
    }).setOrigin(0.5, 0);
    if (choice.locked) {
      addUiIconImage(this, 'locked-padlock', x - w / 2 + 61, y, 25)?.setAlpha(0.38);
    } else if (token?.scrap) {
      addUiIconImage(this, 'scrap-gear', x - w / 2 + 61, y, 25)?.setAlpha(0.82);
    } else {
      addUiIconImage(this, token?.icon ?? 'route-pin', x - w / 2 + 61, y, 25)?.setAlpha(0.72);
    }
    this.add.text(x - w / 2 + 92, y - 11, choice.text, {
      fontFamily: UI_FONT,
      fontSize: '14px',
      fontStyle: UI_BOLD,
      color: choice.locked ? '#7f93a8' : '#f3f7ff',
      wordWrap: { width: w - 222 },
      maxLines: 1
    }).setOrigin(0, 0);
    this.add.text(x + w / 2 - 14, y - 9, choice.locked ? (choice.lockedText ?? 'Locked') : routeEffectSummary(choice.effects), {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: choice.locked ? '#ffb8ad' : '#dffbff',
      align: 'right',
      fixedWidth: 132,
      maxLines: 1
    }).setOrigin(1, 0);
    if (choice.locked) {
      this.add.rectangle(x + w / 2 - 8, y, 3, h - 12, UI_FIELD.danger, 0.48);
    }
  }

  private renderCacheDrawerTile(
    node: RouteNode,
    choice: NodeChoiceOption,
    x: number,
    y: number,
    w: number,
    h: number,
    index: number,
    accent: number
  ) {
    const profile = cacheDrawerProfile(choice, index);
    const choiceAccent = choice.locked ? 0x49606d : profile.accent;
    this.add.rectangle(x + 3, y + 4, w, h, 0x020409, 0.2);
    const bg = this.add.rectangle(x, y, w, h, choice.locked ? 0x0b1018 : 0xf3f7ff, choice.locked ? 0.34 : 0.055)
      .setStrokeStyle(1, choiceAccent, choice.locked ? 0.34 : 0.45);
    bg.setInteractive({ useHandCursor: !choice.locked });
    if (!choice.locked) bg.on('pointerdown', () => this.chooseNodeOption(choice.key));
    bg.on('pointerover', () => {
      bg.setFillStyle(choice.locked ? 0x141827 : 0xf3f7ff, choice.locked ? 0.48 : 0.16);
      bg.setStrokeStyle(1, choice.locked ? UI_FIELD.danger : choiceAccent, 0.92);
      this.hideRouteChoiceDetail();
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(choice.locked ? 0x0b1018 : 0xf3f7ff, choice.locked ? 0.34 : 0.055);
      bg.setStrokeStyle(1, choiceAccent, choice.locked ? 0.34 : 0.45);
      this.hideRouteChoiceDetail();
    });
    this.add.rectangle(x - w / 2 + 5, y, 4, h - 10, choiceAccent, choice.locked ? 0.38 : 0.72);
    this.add.text(x - w / 2 + 21, y - 8, profile.drawer, {
      fontFamily: UI_FONT,
      fontSize: '16px',
      fontStyle: UI_BOLD,
      color: choice.locked ? '#65788b' : '#ffe1a3',
      align: 'center',
      fixedWidth: 38
    }).setOrigin(0.5, 0);
    addUiIconImage(this, choice.locked ? 'locked-padlock' : profile.icon, x - w / 2 + 61, y, 25)
      ?.setAlpha(choice.locked ? 0.38 : 0.72);
    this.add.text(x - w / 2 + 92, y - 11, profile.title, {
      fontFamily: UI_FONT,
      fontSize: '14px',
      fontStyle: UI_BOLD,
      color: choice.locked ? '#7f93a8' : '#f3f7ff',
      wordWrap: { width: w - 222 },
      maxLines: 1
    }).setOrigin(0, 0);
    this.add.text(x + w / 2 - 14, y - 9, choice.locked ? 'Locked' : profile.tell, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: choice.locked ? '#ffb8ad' : '#dffbff',
      align: 'right',
      fixedWidth: 132,
      maxLines: 1
    }).setOrigin(1, 0);
    if (choice.locked) {
      this.add.rectangle(x + w / 2 - 8, y, 3, h - 12, UI_FIELD.danger, 0.48);
    }
  }

  private renderCacheClaimPanel(
    choice: NodeChoiceOption,
    x: number,
    y: number,
    w: number,
    h: number,
    index: number,
    accent: number,
    panel?: Phaser.GameObjects.Container
  ) {
    const own = <T extends Phaser.GameObjects.GameObject>(obj: T) => {
      panel?.add(obj);
      return obj;
    };
    const profile = cacheDrawerProfile(choice, index);
    const choiceAccent = choice.locked ? UI_FIELD.danger : profile.accent;
    const rows = this.routeChoicePreviewRows(choice);
    own(this.add.rectangle(x + 8, y + 10, w, h, 0x020409, 0.44));
    own(this.add.rectangle(x, y, w, h, 0x07101a, 0.97)
      .setStrokeStyle(2, choiceAccent, choice.locked ? 0.9 : 0.82));
    own(this.add.rectangle(x, y - h / 2 + 24, w - 40, 3, choiceAccent, 0.76));
    own(this.add.text(x - w / 2 + 22, y - h / 2 + 42, 'CLAIM FILE', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: UI_GOLD
    }));
    own(this.add.text(x + w / 2 - 22, y - h / 2 + 42, choice.locked ? 'LOCKED' : 'READY', {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: choice.locked ? '#ffb8ad' : '#dffbff',
      align: 'right'
    }).setOrigin(1, 0));
    own(this.add.rectangle(x - w / 2 + 54, y - h / 2 + 96, 68, 78, 0x020409, 0.68)
      .setStrokeStyle(1, choiceAccent, 0.78));
    own(this.add.text(x - w / 2 + 54, y - h / 2 + 72, 'DRAWER', {
      fontFamily: UI_FONT,
      fontSize: '8px',
      fontStyle: UI_BOLD,
      color: '#dffbff',
      align: 'center',
      fixedWidth: 62,
      maxLines: 1
    }).setOrigin(0.5, 0));
    own(this.add.text(x - w / 2 + 54, y - h / 2 + 87, profile.drawer, {
      fontFamily: UI_FONT,
      fontSize: '28px',
      fontStyle: UI_BOLD,
      color: choice.locked ? '#7f93a8' : '#ffe1a3',
      align: 'center',
      fixedWidth: 62
    }).setOrigin(0.5, 0));
    const icon = addUiIconImage(this, choice.locked ? 'locked-padlock' : profile.icon, x - w / 2 + 54, y - h / 2 + 146, 22);
    if (icon) own(icon.setAlpha(choice.locked ? 0.46 : 0.9));
    own(this.add.text(x - w / 2 + 104, y - h / 2 + 72, profile.title, {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: choice.locked ? '#ffb8ad' : '#ffe1a3',
      wordWrap: { width: w - 132 },
      maxLines: 2
    }));
    own(this.add.text(x - w / 2 + 104, y - h / 2 + 122, choice.locked ? 'Unavailable claim' : profile.tell, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: choice.locked ? '#ff9d4d' : '#dffbff',
      wordWrap: { width: w - 132 },
      maxLines: 1
    }));
    own(this.add.text(x - w / 2 + 34, y - h / 2 + 176, 'REWARD / COST', {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_MUTED
    }));
    if (choice.locked && choice.lockedText) {
      own(this.add.rectangle(x, y - h / 2 + 220, w - 68, 64, 0x020409, 0.62)
        .setStrokeStyle(1, UI_FIELD.danger, 0.42));
      own(this.add.text(x - w / 2 + 48, y - h / 2 + 199, choice.lockedText, {
        fontFamily: UI_FONT,
        fontSize: '13px',
        color: '#ffb8ad',
        wordWrap: { width: w - 68 },
        maxLines: 2
      }));
    } else if (rows.length === 0) {
      own(this.add.rectangle(x, y - h / 2 + 220, w - 68, 42, 0x020409, 0.62)
        .setStrokeStyle(1, 0x49606d, 0.34));
      own(this.add.text(x - w / 2 + 48, y - h / 2 + 210, 'No cost / no reward', {
        fontFamily: UI_FONT,
        fontSize: '13px',
        fontStyle: UI_BOLD,
        color: UI_SOFT,
        maxLines: 1
      }));
    } else {
      rows.slice(0, 4).forEach((row, rowIndex) => {
        const rowY = y - h / 2 + 201 + rowIndex * 32;
        const kind = row.color === '#ffd5cc' ? 'Cost' : 'Reward';
        own(this.add.rectangle(x, rowY + 9, w - 68, 26, 0x020409, 0.62)
          .setStrokeStyle(1, 0x49606d, 0.34));
        own(this.add.text(x - w / 2 + 48, rowY + 1, `${kind}: ${row.label}`, {
          fontFamily: UI_FONT,
          fontSize: '12px',
          fontStyle: UI_BOLD,
          color: UI_SOFT,
          maxLines: 1
        }));
        own(this.add.text(x + w / 2 - 48, rowY + 1, this.routeChoiceChangeAmountText(row), {
          fontFamily: UI_FONT,
          fontSize: '12px',
          fontStyle: UI_BOLD,
          color: row.color,
          align: 'right',
          maxLines: 1
        }).setOrigin(1, 0));
      });
    }
    own(this.add.rectangle(x, y + h / 2 - 34, w - 56, 30, 0x020409, 0.72)
      .setStrokeStyle(1, choiceAccent, choice.locked ? 0.42 : 0.78));
    own(this.add.text(x, y + h / 2 - 43, choice.locked ? 'Find another claim' : 'Choose this claim', {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: choice.locked ? '#ffb8ad' : '#ffe1a3',
      align: 'center',
      fixedWidth: w - 64,
      maxLines: 1
    }).setOrigin(0.5, 0));
  }

  private showCacheDrawerInspector(
    choice: NodeChoiceOption,
    x: number,
    y: number,
    w: number,
    h: number,
    index: number,
    accent: number
  ) {
    this.hideRouteChoiceDetail();
    const panel = this.add.container(0, 0).setDepth(22000);
    this.renderCacheClaimPanel(choice, x, y, w, h, index, accent, panel);
    this.routeChoiceHover = panel;
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
    this.renderRouteEventAtmosphere(node, accent);
    this.renderRouteEventTitlePlaque(node, GAME_WIDTH / 2, 132, 560);
    this.renderRouteEventResident(node, 146, GAME_HEIGHT + 50, 330, 488, { showGlow: false });
    this.renderSignalSwitchboard(1018, 486, 430, 386, [], accent);
    this.renderRouteEventChoiceColumn(node, choices, 560, 316, 472, accent);
  }

  private renderSignalSwitchboard(x: number, y: number, w: number, h: number, choiceYs: number[], accent: number) {
    const prop = ROUTE_EVENT_PROP_ASSETS.signalSwitchboard;
    if (this.textures.exists(prop.key)) {
      this.renderRouteEventPropCenterpiece(prop, x + 12, y + 12, w + 92, h + 54, accent, UI_FIELD.cyan, {
        showGlow: false,
        showAccentLine: false
      });
      return;
    }
    this.add.rectangle(x + 8, y + 10, w, h, 0x020409, 0.44);
    this.add.rectangle(x, y, w, h, 0x07101a, 0.9)
      .setStrokeStyle(2, accent, 0.84);
    this.add.rectangle(x, y - h / 2 + 26, w - 42, 3, accent, 0.7);
    this.add.text(x, y - h / 2 + 42, 'SWITCHBOARD ROUTE MAP', {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      align: 'center'
    }).setOrigin(0.5);
    const board = this.add.graphics();
    const colors = [UI_FIELD.violet, UI_FIELD.cyan, UI_FIELD.gold, UI_FIELD.green, 0xffb86b, UI_FIELD.danger];
    choiceYs.forEach((choiceY, index) => {
      const jackX = x + 42 + (index % 3) * 92;
      const jackY = y - 76 + Math.floor(index / 3) * 82;
      const color = colors[index % colors.length] ?? accent;
      board.lineStyle(2, color, 0.58);
      board.lineBetween(jackX, jackY, x + w / 2 - 22, choiceY);
      this.add.circle(jackX, jackY, 11, 0x020409, 0.92)
        .setStrokeStyle(2, color, 0.9);
      this.add.circle(jackX, jackY, 5, color, 0.54)
        .setBlendMode(Phaser.BlendModes.ADD);
    });
    this.renderRouteNodeTypeIcon('signal', x, y + 66, 118);
    this.add.rectangle(x, y + 140, w - 90, 38, 0x020409, 0.54)
      .setStrokeStyle(1, accent, 0.36);
    this.add.text(x, y + 128, 'WIRE PATHS ACTIVE', {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_CYAN,
      align: 'center'
    }).setOrigin(0.5, 0);
  }

  private renderSetPieceChoice(
    choice: { key: string; text: string; effects: string[]; locked: boolean; lockedText?: string },
    x: number,
    y: number,
    index: number,
    accent: number,
    height = 78,
    compact = false
  ) {
    const colors = [UI_FIELD.green, UI_FIELD.cyan, UI_FIELD.gold];
    const choiceAccent = colors[index % colors.length] ?? accent;
    const w = 398;
    const h = height;
    this.add.rectangle(x + 7, y + 7, w, h, 0x020409, 0.38);
    const bg = this.add.rectangle(x, y, w, h, choice.locked ? 0x0d1420 : 0x07101a, choice.locked ? 0.8 : 0.98)
      .setStrokeStyle(2, choice.locked ? 0x49606d : choiceAccent, choice.locked ? 0.62 : 0.95);
    bg.setInteractive({ useHandCursor: !choice.locked });
    if (!choice.locked) {
      bg.on('pointerdown', () => this.chooseNodeOption(choice.key));
    }
    bg.on('pointerover', () => {
      const node = currentMap().nodes.find((candidate) => candidate.id === this.nodeChoiceNodeId);
      bg.setFillStyle(choice.locked ? 0x141827 : 0x102235, choice.locked ? 0.88 : 1);
      bg.setStrokeStyle(2, choice.locked ? UI_FIELD.danger : choiceAccent, 1);
      if (node) this.showRouteChoiceDetail(node, choice, x, y, choiceAccent);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(choice.locked ? 0x0d1420 : 0x07101a, choice.locked ? 0.8 : 0.98);
      bg.setStrokeStyle(2, choice.locked ? 0x49606d : choiceAccent, choice.locked ? 0.62 : 0.95);
      this.hideRouteChoiceDetail();
    });
    this.add.rectangle(x - w / 2 + 6, y, 8, h - 12, choice.locked ? 0x49606d : choiceAccent, choice.locked ? 0.62 : 1);
    this.add.rectangle(x, y - h / 2 + 8, w - 36, 2, choice.locked ? 0x49606d : choiceAccent, choice.locked ? 0.34 : 0.58);
    this.add.rectangle(x - w / 2 + 42, y, 48, h - 18, 0x020409, choice.locked ? 0.5 : 0.66)
      .setStrokeStyle(1, choice.locked ? 0x49606d : choiceAccent, choice.locked ? 0.42 : 0.72);
    addUiIconImage(this, choice.locked ? 'locked-padlock' : 'route-pin', x - w / 2 + 42, y, compact ? 15 : 17)
      ?.setAlpha(choice.locked ? 0.45 : 0.86);
    const titleY = y - h / 2 + (compact ? 9 : 11);
    this.add.text(x - w / 2 + 76, titleY, choice.text, {
      fontFamily: UI_FONT,
      fontSize: compact ? '14px' : '16px',
      fontStyle: UI_BOLD,
      color: choice.locked ? '#7f93a8' : '#ffe1a3',
      wordWrap: { width: 286 },
      maxLines: 1
    });
    if (!compact) {
      this.add.text(x - w / 2 + 76, y - h / 2 + 33, choice.locked && choice.lockedText ? choice.lockedText : routeEffectSummary(choice.effects), {
        fontFamily: UI_FONT,
        fontSize: '12px',
        color: choice.locked ? '#ff9d4d' : '#dbe6f2',
        lineSpacing: 1,
        wordWrap: { width: 288 },
        maxLines: 1
      });
    }
    this.renderEventEffectTokens(choice, x - w / 2 + 76, y + h / 2 - (compact ? 13 : 14), 292, compact);
  }

  private renderMarketCardOffers(x: number, y: number) {
    if (this.marketCardShelf.length === 0) {
      this.add.rectangle(x, y - 6, 420, 78, 0x020409, 0.42)
        .setStrokeStyle(1, 0x6f6044, 0.34);
      this.add.text(x, y - 24, 'Every available crew card is already in the flock.', {
        fontFamily: UI_FONT,
        fontSize: '15px',
        color: '#d7c5a6',
        align: 'center',
        wordWrap: { width: 360 },
        maxLines: 2
      }).setOrigin(0.5, 0);
      return;
    }
    this.marketCardShelf.forEach((listing, i) => {
      const card = cloneCard(listing.id);
      const artW = 190;
      const artH = Math.round(artW * 1.5);
      const cardW = artW + 8;
      const cardH = artH + 8;
      const cardX = x - 250 + i * 205;
      const cardY = y - 4 + (i % 2 === 0 ? -8 : 8);
      const enabled = !listing.sold && this.runState.scrap >= listing.price;
      const accent = card.type === 'major' ? 0xd8a840 : card.type === 'molt' ? 0xc56cff : suitAccentColor(card);
      this.add.rectangle(cardX + 5, cardY + 8, cardW - 18, cardH - 18, 0x020409, 0.5);
      const key = compactCardArtKey(card);
      if (key && this.textures.exists(key)) {
        this.add.image(cardX, cardY, key)
          .setDisplaySize(artW, artH)
          .setAlpha(1);
      } else if (!renderSnagCardBorder(this, undefined, card, cardX, cardY, artW, artH, 1)) {
        this.add.text(cardX, cardY - 30, cardLabel(card), {
        fontFamily: UI_FONT,
        fontSize: '12px',
        fontStyle: UI_BOLD,
        color: UI_CYAN,
        align: 'center',
        wordWrap: { width: 90 },
        maxLines: 2
        }).setOrigin(0.5);
      } else {
        this.add.rectangle(cardX, cardY, artW, artH, 0x05101a, 0.12);
      }
      this.renderMarketPriceTag(cardX, cardY + artH / 2 + 18, listing.price, enabled && !listing.sold, accent, 'BUY');
      if (listing.sold) this.renderMarketSoldSlat(cardX, cardY, cardW, cardH);
      if (!listing.sold) {
        const hit = this.add.rectangle(cardX, cardY + 8, cardW + 12, cardH + 58, 0x000000, 0.01)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => this.buyMarketCard(i));
        hit.on('pointerover', () => this.showHoverCardDetail(card, 'Market offer', listing.price, cardX, cardY));
        hit.on('pointerout', () => this.hideHoverCardDetail());
      }
    });
  }

  private renderMarketWaymarkOffers(x: number, rowY: number) {
    if (this.marketWaymarkShelf.length === 0) {
      this.add.rectangle(x, rowY + 22, 300, 72, 0x020409, 0.34)
        .setStrokeStyle(1, 0x6f6044, 0.28);
      this.add.text(x, rowY - 4, 'No unclaimed pins remain in this market.', {
        fontFamily: UI_FONT,
        fontSize: '13px',
        color: '#d7c5a6',
        align: 'center',
        wordWrap: { width: 260 },
        maxLines: 2
      }).setOrigin(0.5, 0);
      return;
    }
    this.marketWaymarkShelf.forEach((listing, i) => {
      const mark = alphaRouteMarkLibrary.get(listing.id);
      if (!mark) return;
      const itemX = x - 134 + i * 134;
      const enabled = !listing.sold && this.runState.scrap >= listing.price;
      const key = waymarkArtAssets[mark.id]?.key;
      this.renderMarketObjectBackplate(itemX, rowY - 16, 112, 94, enabled ? UI_FIELD.gold : 0x3f4c58);
      if (key && this.textures.exists(key)) addWaymarkArtImage(this, itemX, rowY - 16, key).setDisplaySize(96, 96).setAlpha(1);
      else {
        this.add.text(itemX, rowY - 29, waymarkGlyph(mark), {
          fontFamily: 'Georgia, serif',
          fontSize: '27px',
          fontStyle: UI_BOLD,
          color: '#fff1c7',
          stroke: '#020409',
          strokeThickness: 2
        }).setOrigin(0.5, 0);
      }
      this.renderMarketItemLabelBox(itemX, rowY + 68, 128, 48, 'WAYMARKER', mark.name, listing.price, enabled && !listing.sold, UI_FIELD.gold);
      if (listing.sold) this.renderMarketSoldSlat(itemX, rowY + 24, 128, 126);
      if (!listing.sold) {
        const hit = this.add.rectangle(itemX, rowY + 24, 136, 160, 0x000000, 0.01)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => this.buyMarketRouteMark(i));
        hit.on('pointerover', () => this.showMarketWaymarkDetail(mark, listing.price, itemX, rowY));
        hit.on('pointerout', () => this.hideMarketItemDetail());
      }
    });
  }

  private renderMarketUtilityOffers(x: number, y: number, goodsRowY?: number) {
    if (this.marketUtilityShelf.length === 0) {
      this.add.rectangle(x, y + 70, 220, 96, 0x020409, 0.34)
        .setStrokeStyle(1, 0x59606a, 0.24);
      this.add.text(x, y + 42, 'The benches are quiet. Your pouch may be full, or every card is settled.', {
        fontFamily: UI_FONT,
        fontSize: '13px',
        color: '#d7c5a6',
        align: 'center',
        wordWrap: { width: 190 },
        maxLines: 3
      }).setOrigin(0.5, 0);
      return;
    }
    let serviceIndex = 0;
    let supplyIndex = 0;
    const serviceBaseY = y - 44;
    this.marketUtilityShelf.forEach((listing, i) => {
      const enabled = !listing.sold && this.marketUtilityEnabled(listing);
      const accent = listing.id === 'release' ? UI_FIELD.danger : listing.id === 'supply' ? UI_FIELD.green : UI_FIELD.cyan;
      const supply = listing.supplyId ? alphaSupplyLibrary.get(listing.supplyId) : undefined;
      const supplyKey = supply ? supplyArtAssets[supply.id]?.key : undefined;
      if (listing.id === 'preen' || listing.id === 'release') {
        const serviceY = serviceBaseY + serviceIndex * 58;
        const serviceX = x + 300;
        serviceIndex += 1;
        this.renderMarketServiceButton(
          serviceX,
          serviceY,
          144,
          48,
          marketIconForKicker(this.marketUtilityVerb(listing)) ?? 'market-basket',
          listing.price,
          enabled && !listing.sold,
          accent
        );
        if (listing.sold) this.renderMarketSoldSlat(serviceX, serviceY, 146, 48);
        if (!listing.sold) {
          const hit = this.add.rectangle(serviceX, serviceY, 154, 56, 0x000000, 0.01)
            .setInteractive({ useHandCursor: true });
          hit.on('pointerdown', () => this.buyMarketUtility(i));
          hit.on('pointerover', () => this.showMarketUtilityDetail(listing, serviceX, serviceY));
          hit.on('pointerout', () => this.hideMarketItemDetail());
        }
        return;
      }

      const rowY = goodsRowY ?? y + 276;
      const supplyX = x - 72 + supplyIndex * 134;
      supplyIndex += 1;
      this.renderMarketObjectBackplate(supplyX, rowY - 16, 112, 94, enabled ? accent : 0x3f4c58);
      if (supplyKey && this.textures.exists(supplyKey)) {
        addSupplyArtImage(this, supplyX, rowY - 16, supplyKey)
          .setDisplaySize(96, 96)
          .setAlpha(1);
      } else {
        const artAsset = this.marketUtilityProxyArtAsset(listing);
        if (artAsset && this.textures.exists(artAsset.key)) {
          this.add.image(supplyX, rowY - 16, artAsset.key)
            .setDisplaySize(96, 96)
            .setAlpha(1);
        } else if (listing.id === 'supply') {
          this.add.text(supplyX, rowY - 26, 'S', {
            fontFamily: UI_FONT,
            fontSize: '17px',
            fontStyle: UI_BOLD,
            color: listing.sold ? '#596a78' : '#8df4ff',
            stroke: '#020409',
            strokeThickness: 2
          }).setOrigin(0.5, 0);
        }
      }
      this.renderMarketItemLabelBox(
        supplyX,
        rowY + 68,
        128,
        48,
        'SUPPLY',
        this.marketUtilityLabel(listing),
        listing.price,
        enabled && !listing.sold,
        accent
      );
      if (listing.sold) this.renderMarketSoldSlat(supplyX, rowY + 24, 128, 126);
      if (!listing.sold) {
        const hit = this.add.rectangle(supplyX, rowY + 24, 136, 160, 0x000000, 0.01)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => this.buyMarketUtility(i));
        hit.on('pointerover', () => this.showMarketUtilityDetail(listing, supplyX, rowY));
        hit.on('pointerout', () => this.hideMarketItemDetail());
      }
    });
    const refreshCost = this.marketRefreshCost();
    const refreshEnabled = this.runState.scrap >= refreshCost;
    const refreshX = x + 300;
    const refreshY = serviceBaseY + serviceIndex * 58;
    this.renderMarketServiceButton(
      refreshX,
      refreshY,
      144,
      48,
      'refresh-ring',
      refreshCost,
      refreshEnabled,
      UI_FIELD.cyan
    );
    if (refreshEnabled) {
      const hit = this.add.rectangle(refreshX, refreshY, 154, 56, 0x000000, 0.01)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.refreshMarket());
      hit.on('pointerover', () => this.showMarketRefreshDetail(refreshCost, refreshX, refreshY));
      hit.on('pointerout', () => this.hideMarketItemDetail());
    }
  }

  private renderMarketObjectBackplate(x: number, y: number, w: number, h: number, accent: number) {
    this.add.rectangle(x, y, w, h, 0x07101a, 0.92)
      .setStrokeStyle(1, accent, 0.62);
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
    const fill = enabled ? 0x0d1420 : 0x0a0e15;
    const stroke = enabled ? accent : 0x3f4c58;
    this.add.rectangle(x, y, w, h, fill, enabled ? 0.96 : 0.88)
      .setStrokeStyle(MENU_BORDER_WIDTH, stroke, enabled ? 0.9 : 0.58);
    const iconId = marketIconForKicker(kicker);
    const icon = iconId ? addUiIconImage(this, iconId, x - w / 2 + 18, y, 28) : undefined;
    if (icon) icon.setAlpha(enabled ? 0.94 : 0.42);
    const textLeft = x - w / 2 + (icon ? 54 : 8);
    const textWrapWidth = Math.max(38, w - (icon ? 98 : 58));
    const showKicker = kicker !== 'WAYMARKER' && kicker !== 'SUPPLY';
    if (showKicker) {
      this.add.text(textLeft, y - h / 2 + 6, kicker, {
        fontFamily: UI_FONT,
        fontSize: '9px',
        fontStyle: UI_BOLD,
        color: enabled ? '#ffe1a3' : '#91a6b8',
        wordWrap: { width: textWrapWidth },
        maxLines: 1
      });
    }
    this.add.text(textLeft, y - h / 2 + (showKicker ? 21 : 14), title, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: enabled ? '#8df4ff' : '#596a78',
      wordWrap: { width: textWrapWidth },
      maxLines: 2,
      lineSpacing: -1
    });
    this.add.text(x + w / 2 - 9, y - h / 2 + 9, `${price}`, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: enabled ? '#f0c36f' : '#91a6b8',
      align: 'right'
    }).setOrigin(1, 0);
    addScrapIconImage(this, x + w / 2 - 42, y - h / 2 + 18, 20)
      ?.setAlpha(enabled ? 0.94 : 0.46);
  }

  private renderMarketServiceButton(
    x: number,
    y: number,
    w: number,
    h: number,
    iconId: UiIconId,
    price: number,
    enabled: boolean,
    accent: number
  ) {
    const fill = enabled ? 0x0d1420 : 0x0a0e15;
    const stroke = enabled ? accent : 0x3f4c58;
    this.add.rectangle(x, y, w, h, fill, enabled ? 0.96 : 0.82)
      .setStrokeStyle(MENU_BORDER_WIDTH, stroke, enabled ? 0.9 : 0.54);
    addUiIconImage(this, iconId, x - w / 2 + 28, y, 25)
      ?.setAlpha(enabled ? 0.94 : 0.42);
    this.add.text(x + w / 2 - 9, y - 9, `${price}`, {
      fontFamily: UI_FONT,
      fontSize: '14px',
      fontStyle: UI_BOLD,
      color: enabled ? '#f0c36f' : '#91a6b8',
      align: 'right'
    }).setOrigin(1, 0);
    addScrapIconImage(this, x + 8, y, 20)
      ?.setAlpha(enabled ? 0.94 : 0.46);
  }

  private renderMarketPriceTag(x: number, y: number, price: number, enabled: boolean, accent: number, verb: string) {
    const fill = enabled ? 0x0d1420 : 0x0a0e15;
    const tagW = 122;
    this.add.rectangle(x + 3, y + 4, tagW, 26, 0x020409, 0.78);
    this.add.rectangle(x, y, tagW, 26, fill, enabled ? 0.94 : 0.86)
      .setStrokeStyle(MENU_BORDER_WIDTH, enabled ? accent : 0x3f4c58, enabled ? 0.86 : 0.52);
    addUiIconImage(this, 'scrap-gear', x - 47, y, 23)
      ?.setAlpha(enabled ? 0.94 : 0.5);
    this.add.text(x - 19, y - 10, `${price}`, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: enabled ? '#f0c36f' : '#91a6b8'
    });
    const verbIcon = buttonIconForLabel(verb);
    const icon = verbIcon ? addUiIconImage(this, verbIcon, x + 24, y, 20) : undefined;
    if (icon) icon.setAlpha(enabled ? 0.92 : 0.42);
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
    this.add.rectangle(x + 4, y + 5, w, h, 0x020409, 0.82);
    const panel = this.add.rectangle(x, y, w, h, enabled ? 0x0d1420 : 0x0a0e15, enabled ? 0.92 : 0.82)
      .setStrokeStyle(MENU_BORDER_WIDTH, enabled ? accent : 0x3f4c58, enabled ? 0.95 : 0.58);
    const labelY = detail ? y - 3 : y - 8;
    const iconId = label === 'Close' ? 'close-medallion' : buttonIconForLabel(label);
    const contentX = iconId ? x + (label === 'Close' ? 28 : Math.min(28, w * 0.18)) : x;
    const text = this.add.text(contentX, labelY, label, {
      fontFamily: UI_FONT,
      fontSize,
      fontStyle: UI_BOLD,
      color: enabled ? '#ffe1a3' : '#596a78',
      stroke: '#111111',
      strokeThickness: 2
    }).setResolution(2).setOrigin(0.5, 0);
    const detailText = detail
      ? this.add.text(contentX, y - 17, detail, {
        fontFamily: UI_FONT,
        fontSize: '11px',
        fontStyle: UI_BOLD,
        color: enabled ? '#8df4ff' : '#596a78',
        stroke: '#05070c',
        strokeThickness: 2
    }).setResolution(2).setOrigin(0.5, 0)
      : undefined;
    const icon = iconId ? addUiIconImage(this, iconId, x - w / 2 + (label === 'Close' ? 14 : 24), y, Math.min(26, h - 6)) : undefined;
    if (icon) icon.setAlpha(enabled ? 0.92 : 0.42);
    if (enabled) {
      panel.setInteractive({ useHandCursor: true });
      panel.on('pointerover', () => {
        panel.setFillStyle(0x1b2535, 0.96);
        text.setColor('#ffffff');
        detailText?.setColor('#ffffff');
      });
      panel.on('pointerout', () => {
        panel.setFillStyle(0x0d1420, 0.92);
        text.setColor('#ffe1a3');
        detailText?.setColor('#8df4ff');
      });
      panel.on('pointerdown', () => {
        playUiSound('confirm');
        onClick();
      });
    }
    return panel;
  }

  private renderMarketSoldSlat(x: number, y: number, w: number, h: number) {
    this.add.rectangle(x, y, w + 18, 10, 0x020409, 0.82).setAngle(-18);
    this.add.text(x, y - 10, 'SOLD', {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: '#91a6b8',
      stroke: '#020409',
      strokeThickness: 3
    }).setOrigin(0.5, 0);
  }

  private renderMarketButton(x: number, y: number, label: string, enabled: boolean, onClick: () => void, accent = UI_FIELD.gold) {
    renderFieldButton(this, (obj) => {}, x, y, 112, 34, label, enabled, onClick, accent);
  }

  private renderMarketSmallButton(x: number, y: number, label: string, enabled: boolean, onClick: () => void, accent = UI_FIELD.gold) {
    renderFieldButton(this, (obj) => {}, x, y, 70, 26, label, enabled, onClick, accent);
  }

  private buyMarketCard(slotIndex = 0) {
    const listing = this.marketCardShelf[slotIndex] ?? this.marketCardShelf.find((offer) => !offer.sold);
    if (!listing || listing.sold || this.runState.scrap < listing.price) return;
    const offer = cloneCard(listing.id);
    this.runState.scrap -= listing.price;
    this.runState.deck.push({ id: offer.id, upgraded: offer.upgraded });
    listing.sold = true;
    this.applyRouteMarkTrigger('afterMarketPurchase');
    discoverCards([offer.id]);
    this.marketMessage = `${displayName(offer)} joins the flock for ${listing.price} Scrap.`;
    this.renderAll();
    this.queueOptionalCardArtLoad();
  }

  private buyMarketRouteMark(slotIndex = 0) {
    const listing = this.marketWaymarkShelf[slotIndex] ?? this.marketWaymarkShelf.find((offer) => !offer.sold);
    const mark = listing ? alphaRouteMarkLibrary.get(listing.id) : undefined;
    if (!listing || listing.sold || !mark || this.runState.scrap < listing.price) return;
    this.runState.scrap -= listing.price;
    this.addRouteMark(mark.id);
    listing.sold = true;
    this.applyRouteMarkTrigger('afterMarketPurchase');
    this.marketMessage = `${mark.name} is pinned to the route board for ${listing.price} Scrap.`;
    this.renderAll();
  }

  private buyMarketPreen() {
    const index = this.marketUtilityShelf.findIndex((offer) => offer.id === 'preen' && !offer.sold);
    this.buyMarketUtility(Math.max(0, index));
  }

  private buyMarketUtility(slotIndex = 0) {
    const listing = this.marketUtilityShelf[slotIndex] ?? this.marketUtilityShelf.find((offer) => !offer.sold);
    if (!listing || listing.sold || !this.marketUtilityEnabled(listing)) return;
    if (listing.id === 'preen') {
      this.openMarketCardPicker(slotIndex, 'preen');
      return;
    } else if (listing.id === 'release') {
      this.openMarketCardPicker(slotIndex, 'release');
      return;
    } else if (listing.id === MARKET_BOSS_GUARD) {
      this.runState.scrap -= listing.price;
      this.runState.nextCombat = {
        ...this.runState.nextCombat,
        openSkyGuard: (this.runState.nextCombat?.openSkyGuard ?? 0) + 1,
        bossDamageShield: (this.runState.nextCombat?.bossDamageShield ?? 0) + 18
      };
      listing.sold = true;
      this.applyRouteMarkTrigger('afterMarketPurchase');
      this.marketMessage = `Boss rigging secured for ${listing.price} Scrap.`;
    } else if (listing.id === MARKET_ROUTE_SCOUT) {
      this.runState.scrap -= listing.price;
      this.resolveRouteEffect('peekNextNodes(2)');
      this.resolveRouteEffect('gainOpenSkyGuard(1)');
      listing.sold = true;
      this.applyRouteMarkTrigger('afterMarketPurchase');
      this.marketMessage = `Roofline scouted for ${listing.price} Scrap.`;
    } else {
      const supply = listing.supplyId ? alphaSupplyLibrary.get(listing.supplyId) : undefined;
      if (!supply || (this.runState.supplies ?? []).length >= runSupplyCapacity(this.runState)) return;
      this.runState.supplies.push(supply.id);
      this.runState.scrap -= listing.price;
      listing.sold = true;
      this.applyRouteMarkTrigger('afterMarketPurchase');
      this.marketMessage = `${supply.name} is packed for the road for ${listing.price} Scrap.`;
    }
    this.renderAll();
  }

  private openMarketCardPicker(slotIndex: number, mode: CardPickerMode) {
    this.cardPickerMode = mode;
    this.cardPickerContext = 'market';
    this.cardPickerRemainingPicks = 1;
    this.marketPickerUtilitySlot = slotIndex;
    this.cardPickerScroll = 0;
    this.hideHoverCardDetail();
    this.hideMarketItemDetail();
    this.renderAll();
  }

  private marketRefreshCost() {
    return MARKET_REFRESH_BASE_PRICE + this.marketRefreshCount * 20 + activeMapIndex * 8;
  }

  private refreshMarket() {
    const cost = this.marketRefreshCost();
    if (this.runState.scrap < cost) return;
    this.runState.scrap -= cost;
    this.marketRefreshCount += 1;
    this.marketCardShelf = this.createMarketCardShelf(this.marketRng('cards'));
    this.marketWaymarkShelf = this.createMarketWaymarkShelf(this.marketRng('waymarks'));
    this.marketUtilityShelf = this.createMarketUtilityShelf(this.marketRng('utilities'));
    this.marketMessage = `A runner calls down the line. Fresh stock arrives for ${cost} Scrap.`;
    this.renderAll();
    this.queueOptionalCardArtLoad();
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
        price: priceInBand(slot.price, cardRarityStep(card.runtime.rarity))
      });
    }
    return listings;
  }

  private marketCardWeight(id: string, slotRarity: 'common' | 'uncommon' | 'rare' | 'weighted') {
    const rarity = cardLibrary[id]?.runtime.rarity ?? 'common';
    if (slotRarity !== 'weighted') return rarity === slotRarity ? 100 : 20;
    const base = REWARD_RARITY_WEIGHT[rarity] ?? 50;
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
        price: priceInBand(slot.price, routeMarkRarityStep(mark.rarity))
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
    if (preenPrices.length > 0) listings.push({ id: 'preen', price: Math.min(...preenPrices) });
    const releasePrices = this.pickerEligibleCards('release', 'market').map((entry) => entry.cost);
    if (releasePrices.length > 0) listings.push({ id: 'release', price: Math.min(...releasePrices) });
    if (activeMapIndex >= 1) listings.push({ id: MARKET_BOSS_GUARD, price: 120 + activeMapIndex * 35 });
    if (activeMapIndex >= 2) listings.push({ id: MARKET_ROUTE_SCOUT, price: 90 + activeMapIndex * 30 });

    const pickedSupplies = new Set(this.runState.supplies ?? []);
    for (const slot of alphaMarketConfig.supplySlots) {
      const pool = [...alphaSupplyLibrary.values()].filter((supply) => !pickedSupplies.has(supply.id));
      const supply = this.pickWeighted(pool, (candidate) => this.marketSupplyWeight(candidate), rng);
      if (!supply) continue;
      pickedSupplies.add(supply.id);
      listings.push({
        id: 'supply',
        supplyId: supply.id,
        price: priceInBand(slot.price, supplyRarityStep(supply.rarity))
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
    if (listing.id === 'preen') return 'Choose a Card';
    if (listing.id === 'release') return 'Choose a Card';
    if (listing.id === MARKET_BOSS_GUARD) return 'Boss Rigging';
    if (listing.id === MARKET_ROUTE_SCOUT) return 'Scout Roofline';
    const supply = listing.supplyId ? alphaSupplyLibrary.get(listing.supplyId) : undefined;
    return supply?.name ?? 'Supply Crate';
  }

  private marketUtilityProxyArtAsset(listing: MarketUtilityListing) {
    if (!listing.supplyId) return undefined;
    const supplyArt = supplyArtAssets[listing.supplyId];
    if (supplyArt) return supplyArt;
    const markId = MARKET_SUPPLY_PROXY_MARKS[listing.supplyId];
    return markId ? waymarkArtAssets[markId] : undefined;
  }

  private marketUtilityDetail(listing: MarketUtilityListing) {
    if (listing.id === 'preen') return 'Choose one card in the flock deck to upgrade.';
    if (listing.id === 'release') return 'Choose one card to remove from the flock deck.';
    if (listing.id === MARKET_BOSS_GUARD) return 'Start the next boss fight with extra Cover and Open Sky Guard.';
    if (listing.id === MARKET_ROUTE_SCOUT) return 'Preview reachable crossings and carry Open Sky Guard into the next fight.';
    const supply = listing.supplyId ? alphaSupplyLibrary.get(listing.supplyId) : undefined;
    return supply?.description ?? 'Pack a one-use tool.';
  }

  private marketUtilityVerb(listing: MarketUtilityListing) {
    if (listing.id === 'preen') return 'Preen';
    if (listing.id === 'release') return 'Remove';
    if (listing.id === MARKET_BOSS_GUARD) return 'Rig';
    if (listing.id === MARKET_ROUTE_SCOUT) return 'Scout';
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
    const node = currentMap().nodes.find((candidate) => candidate.id === this.marketNodeId);
    this.completePendingRouteNode(node?.id);
    this.runState.routeLog.push(node ? `${node.label}: market business settled.` : 'Market business settled.');
    this.runState.routeLog = this.runState.routeLog.slice(-8);
    this.marketOpen = false;
    this.marketNodeId = undefined;
    this.marketMessage = '';
    this.scene.restart({ runState: cloneRunState(this.runState) });
  }

  private marketCardOffer() {
    const listing = this.marketCardShelf.find((offer) => !offer.sold);
    if (!listing) return undefined;
    const card = cloneCard(listing.id);
    card.upgraded = false;
    return card;
  }

  private marketCardOffers() {
    return this.marketCardShelf.map((listing) => ({
      ...listing,
      card: cloneCard(listing.id)
    }));
  }

  private marketRouteMarkOffer() {
    const listing = this.marketWaymarkShelf.find((offer) => !offer.sold);
    const mark = listing ? alphaRouteMarkLibrary.get(listing.id) : undefined;
    return mark ? { id: mark.id, name: mark.name, text: mark.description, price: listing?.price ?? MARKET_ROUTE_MARK_PRICE } : undefined;
  }

  private marketRouteMarkOffers() {
    return this.marketWaymarkShelf.map((listing) => {
      const mark = alphaRouteMarkLibrary.get(listing.id);
      return {
        ...listing,
        name: mark?.name ?? listing.id,
        text: mark?.description ?? ''
      };
    });
  }

  private marketPreenCandidate() {
    const listing = this.marketUtilityShelf.find((offer) => offer.id === 'preen' && !offer.sold);
    return this.firstPreenCandidate();
  }

  private firstPreenCandidate() {
    const saved = this.runState.deck.find((card) => !card.upgraded && cardLibrary[card.id]?.runtime.kind !== 'snag');
    if (!saved) return undefined;
    const card = cloneCard(saved.id);
    card.upgraded = saved.upgraded;
    return card;
  }

  private marketPreenPrice(card?: Card) {
    const shelfPreen = !card ? this.marketUtilityShelf.find((offer) => offer.id === 'preen' && !offer.sold) : undefined;
    if (shelfPreen) return shelfPreen.price;
    const raritySurcharge = card ? Math.min(2, cardRarityStep(card.runtime.rarity)) * 10 : 0;
    return Math.max(35, MARKET_PREEN_PRICE + raritySurcharge - this.routeMarkValue('passive', 'reducePreenPrice'));
  }

  private marketReleaseCandidate() {
    const snag = this.runState.deck.find((card) => cardLibrary[card.id]?.runtime.kind === 'snag');
    const starter = new Set(alphaCardSet.starterDeck);
    const saved = snag ?? this.runState.deck.find((card) => !starter.has(card.id));
    if (!saved) return undefined;
    const card = cloneCard(saved.id);
    card.upgraded = saved.upgraded;
    return card;
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
    const saved = this.runState.deck.find((card) => !card.upgraded);
    if (!saved) return undefined;
    saved.upgraded = true;
    return cloneCard(saved.id);
  }

  private openDeckOverlay() {
    this.deckOverlayOpen = true;
    this.flockOverlayOpen = false;
    this.waymarkDrawerOpen = false;
    this.supplyDrawerOpen = false;
    this.inspectedCardId = undefined;
    this.cardReviewScroll = 0;
    this.renderAll();
    this.queueOptionalCardArtLoad();
  }

  private openFlockOverlay() {
    this.flockOverlayOpen = true;
    this.deckOverlayOpen = false;
    this.waymarkDrawerOpen = false;
    this.supplyDrawerOpen = false;
    this.renderAll();
  }

  private closeFlockOverlay() {
    this.flockOverlayOpen = false;
    this.renderAll();
  }

  private openWaymarkDrawer() {
    this.waymarkDrawerOpen = true;
    this.routeWaymarkScroll = 0;
    this.deckOverlayOpen = false;
    this.flockOverlayOpen = false;
    this.supplyDrawerOpen = false;
    this.renderAll();
    this.queueRouteWaymarkArtLoad();
  }

  private closeWaymarkDrawer() {
    this.waymarkDrawerOpen = false;
    this.renderAll();
  }

  private openSupplyDrawer() {
    this.supplyDrawerOpen = true;
    this.deckOverlayOpen = false;
    this.flockOverlayOpen = false;
    this.waymarkDrawerOpen = false;
    this.renderAll();
    this.queueRouteSupplyArtLoad();
  }

  private closeSupplyDrawer() {
    this.supplyDrawerOpen = false;
    this.renderAll();
  }

  private ownedRouteMarkDefs() {
    return this.runState.routeMarks
      .map((id) => alphaRouteMarkLibrary.get(id))
      .filter((mark): mark is RuntimeRouteMark => Boolean(mark));
  }

  private renderRouteWaymarkIcon(mark: RuntimeRouteMark, x: number, y: number, size: number) {
    const accent = routeMarkAccent(mark);
    const artAsset = waymarkArtAssets[mark.id];
    this.add.rectangle(x, y, size, size, 0x07101c, 0.97).setStrokeStyle(2, accent, 0.95);
    if (artAsset && this.textures.exists(artAsset.key)) {
      addWaymarkArtImage(this, x, y, artAsset.key).setDisplaySize(size - 8, size - 8);
      return;
    }
    this.add.text(x, y - 1, waymarkGlyph(mark), {
      fontFamily: UI_FONT,
      fontSize: `${Math.round(size * 0.48)}px`,
      fontStyle: UI_BOLD,
      color: '#e7eef7'
    }).setOrigin(0.5);
  }

  private renderRouteWaymarkDrawer() {
    const marks = this.ownedRouteMarkDefs();
    this.queueRouteWaymarkArtLoad();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.66)
      .setInteractive({ useHandCursor: false });

    const panelW = HUD_MENU_PANEL.w;
    const panelH = HUD_MENU_PANEL.h;
    const frame = renderFieldPanel(this, (obj) => {}, HUD_MENU_PANEL.cx, HUD_MENU_PANEL.cy, panelW, panelH, {
      eyebrow: 'Route Kit',
      title: 'Found Waymarks',
      subtitle: `${marks.length} artifact item${marks.length === 1 ? '' : 's'} carried this run`,
      accent: UI_FIELD.violet
    });
    addUiIconImage(this, 'waymark-compass', frame.left + HUD_MENU_PANEL.headerIconX, frame.top + HUD_MENU_PANEL.headerIconY, 28)?.setAlpha(0.92);
    renderCloseControl(this, (obj) => {}, frame.right - HUD_MENU_PANEL.closeX, frame.top + HUD_MENU_PANEL.closeY, () => this.closeWaymarkDrawer());

    if (marks.length === 0) {
      addUiIconImage(this, 'waymark-compass', frame.left + 88, frame.top + 160, 34)?.setAlpha(0.32);
      this.add.text(frame.left + 126, frame.top + 150, '0 found', {
        fontFamily: UI_FONT,
        fontSize: '14px',
        fontStyle: UI_BOLD,
        color: UI_MUTED,
        wordWrap: { width: panelW - 108 }
      });
      return;
    }

    const columns = 3;
    const visibleRows = 3;
    const tileW = 252;
    const tileH = 104;
    const startX = frame.left + 64;
    const startY = frame.top + 128;
    const totalRows = Math.ceil(marks.length / columns);
    const maxScrollRows = Math.max(0, totalRows - visibleRows);
    this.routeWaymarkScroll = clamp(Math.round(this.routeWaymarkScroll), 0, maxScrollRows);
    const visible = marks.slice(this.routeWaymarkScroll * columns, (this.routeWaymarkScroll + visibleRows) * columns);
    visible.forEach((mark, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + col * 272;
      const y = startY + row * 112;
      renderCompactItemTile(this, (obj) => {}, x, y, tileW, tileH, {
        kind: 'waymark',
        id: mark.id,
        glyph: waymarkGlyph(mark),
        accent: routeMarkAccent(mark),
        name: mark.name,
        summary: compactEffectGrammar(routeMarkEffects(mark), 72, 2)
      });
    });

    if (maxScrollRows > 0) {
      const trackH = visibleRows * 112 - 8;
      const trackX = frame.right - 38;
      const trackY = startY + trackH / 2;
      const thumbH = Math.max(34, trackH * (visibleRows / totalRows));
      const thumbTravel = trackH - thumbH;
      const thumbY = trackY - trackH / 2 + thumbH / 2 + (this.routeWaymarkScroll / maxScrollRows) * thumbTravel;
      this.add.rectangle(trackX, trackY, 5, trackH, 0x1a2435, 0.9);
      this.add.rectangle(trackX, thumbY, 8, thumbH, UI_FIELD.violet, 0.95);
    }
  }

  private renderRouteSupplyIcon(supply: RuntimeSupply, x: number, y: number, size: number, usable: boolean) {
    const accent = supplyAccent(supply);
    const artAsset = supplyArtAssets[supply.id];
    this.add.rectangle(x, y, size, size, 0x07101c, usable ? 0.97 : 0.72)
      .setStrokeStyle(2, usable ? accent : 0x49606d, usable ? 0.95 : 0.62);
    if (artAsset && this.textures.exists(artAsset.key)) {
      addSupplyArtImage(this, x, y, artAsset.key).setDisplaySize(size - 8, size - 8).setAlpha(usable ? 1 : 0.58);
      return;
    }
    this.add.text(x, y - 1, this.supplyGlyph(supply), {
      fontFamily: UI_FONT,
      fontSize: `${Math.round(size * 0.44)}px`,
      fontStyle: UI_BOLD,
      color: usable ? '#ffe7c9' : '#7f93a8'
    }).setOrigin(0.5);
  }

  private renderRouteSupplyDrawer() {
    this.queueRouteSupplyArtLoad();
    const capacity = runSupplyCapacity(this.runState);
    const supplies = Array.from({ length: capacity }, (_entry, index) => this.runState.supplies[index]);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.66)
      .setInteractive({ useHandCursor: false });

    const frame = renderFieldPanel(this, (obj) => {}, HUD_MENU_PANEL.cx, HUD_MENU_PANEL.cy, HUD_MENU_PANEL.w, HUD_MENU_PANEL.h, {
      eyebrow: 'Run Kit',
      title: 'Packed Supplies',
      subtitle: `${this.runState.supplies.length}/${capacity} supply slot${capacity === 1 ? '' : 's'} filled`,
      accent: 0xffb86b
    });
    addUiIconImage(this, 'supply-pouch', frame.left + HUD_MENU_PANEL.headerIconX, frame.top + HUD_MENU_PANEL.headerIconY, 28)?.setAlpha(0.92);
    renderCloseControl(this, (obj) => {}, frame.right - HUD_MENU_PANEL.closeX, frame.top + HUD_MENU_PANEL.closeY, () => this.closeSupplyDrawer());

    if (capacity === 0) {
      addUiIconImage(this, 'supply-pouch', frame.left + 88, frame.top + 160, 34)?.setAlpha(0.32);
      this.add.text(frame.left + 126, frame.top + 150, '0 slots', {
        fontFamily: UI_FONT,
        fontSize: '14px',
        fontStyle: UI_BOLD,
        color: UI_MUTED,
        wordWrap: { width: frame.w - 108 }
      });
      return;
    }

    const columns = 3;
    const tileW = 252;
    const tileH = 104;
    const startX = frame.left + 64;
    const startY = frame.top + 128;
    supplies.forEach((supplyId, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + col * 272;
      const y = startY + row * 112;
      const supply = supplyId ? alphaSupplyLibrary.get(supplyId) : undefined;
      if (!supply) {
        this.add.rectangle(x + tileW / 2, y + tileH / 2, tileW, tileH, 0x07101c, 0.42)
          .setStrokeStyle(1.2, 0x263b52, 0.56);
        addUiIconImage(this, 'supply-pouch', x + tileW / 2, y + tileH / 2, 25)?.setAlpha(0.2);
        return;
      }
      const usable = supply.timing !== 'combat';
      const bg = renderCompactItemTile(this, (obj) => {}, x, y, tileW, tileH, {
        kind: 'supply',
        id: supply.id,
        glyph: this.supplyGlyph(supply),
        accent: supplyAccent(supply),
        name: supply.name,
        summary: compactEffectGrammar(supply.effects, 72, 2),
        enabled: usable,
        actionLabel: usable ? 'USE' : 'COMBAT'
      });
      if (usable) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => this.useRouteSupply(index));
      }
    });
  }

  private scrollRouteWaymarks(deltaRows: number) {
    const maxScrollRows = Math.max(0, Math.ceil(this.ownedRouteMarkDefs().length / 3) - 3);
    const next = clamp(this.routeWaymarkScroll + deltaRows, 0, maxScrollRows);
    if (next === this.routeWaymarkScroll) return;
    this.routeWaymarkScroll = next;
    this.renderAll();
  }

  // Flock passive stats sourced from the run deck so the flock is examinable
  // between fights without duplicating run-resource readouts from the HUD.
  private renderRouteFlockOverlay() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.78)
      .setInteractive({ useHandCursor: false });
    const rows = buildFlockStatRows(cardsFromSave(this.runState.deck), this.runMaxHp())
      .filter((row) => row.label !== 'Cohesion');

    const panelW = 820;
    const panelH = 540;
    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2;
    const panelTop = panelY - panelH / 2;
    const frame = renderFieldPanel(this, (obj) => {}, panelX, panelY, panelW, panelH, {
      eyebrow: 'Crew Dossier',
      title: 'Flock Stats',
      subtitle: 'Passive bonuses from owned cards. Build them up across the run.',
      accent: UI_FIELD.cyan
    });
    renderFlockStatTable(this, () => {}, rows, 390, panelTop + 124);
    renderCloseControl(this, (obj) => {}, frame.right - 72, frame.top + 54, () => this.closeFlockOverlay());
  }

  private closeDeckOverlay() {
    this.deckOverlayOpen = false;
    this.inspectedCardId = undefined;
    this.cardReviewScroll = 0;
    this.renderAll();
  }

  private scrollDeck(delta: number) {
    const cards = this.mapDeckCards();
    this.cardReviewScroll = clamp(this.cardReviewScroll + delta, 0, Math.max(0, cards.length - CARD_REVIEW_VISIBLE_ROWS));
    this.renderAll();
  }

  private inspectDeckCard(cardId: string) {
    this.inspectedCardId = cardId;
    this.renderAll();
  }

  private mapDeckCards() {
    return cardsFromSave(this.runState.deck).map((card) => ({ card, zone: 'Flock' }));
  }

  private renderMapDeckOverlay() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.76)
      .setInteractive({ useHandCursor: false });
    const frame = renderFieldPanel(this, (obj) => {}, HUD_MENU_PANEL.cx, HUD_MENU_PANEL.cy, HUD_MENU_PANEL.w, HUD_MENU_PANEL.h, {
      eyebrow: 'Field Binder',
      title: `Deck Review (${this.mapDeckCards().length})`,
      subtitle: `Flock deck / Cohesion ${this.runState.currentHp}/${this.runMaxHp()}`,
      accent: UI_FIELD.gold
    });
    addUiIconImage(this, 'deck-stack', frame.left + HUD_MENU_PANEL.headerIconX, frame.top + HUD_MENU_PANEL.headerIconY, 28)?.setAlpha(0.9);
    addUiIconImage(this, 'flock-heart', frame.left + 292, frame.top + 86, 20)?.setAlpha(0.85);
    renderCloseControl(this, (obj) => {}, frame.right - HUD_MENU_PANEL.closeX, frame.top + HUD_MENU_PANEL.closeY, () => this.closeDeckOverlay());

    this.renderMapCardBrowser();
  }

  private renderMapCardBrowser() {
    const cards = this.mapDeckCards();
    this.add.text(140, 166, 'CARD INDEX', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: '#91a6b8'
    });

    const selectedEntry = getInspectedEntry(cards, this.inspectedCardId);
    this.renderCardReviewColumn(cards, selectedEntry, (id) => this.inspectDeckCard(id), (delta) => this.scrollDeck(delta));
    if (selectedEntry) this.renderRouteCardDetailPanel(selectedEntry.card, selectedEntry.zone);
  }

  private renderCardReviewColumn(
    cards: Array<{ card: Card; zone: string }>,
    selectedEntry: { card: Card; zone: string } | undefined,
    onInspect: (cardId: string) => void,
    onScroll: (delta: number) => void
  ) {
    const scrollMax = Math.max(0, cards.length - CARD_REVIEW_VISIBLE_ROWS);
    this.cardReviewScroll = clamp(this.cardReviewScroll, 0, scrollMax);
    const visible = cards.slice(this.cardReviewScroll, this.cardReviewScroll + CARD_REVIEW_VISIBLE_ROWS);

    visible.forEach(({ card, zone }, index) => {
      const x = 140;
      const y = 198 + index * CARD_REVIEW_ROW_H;
      const selected = selectedEntry?.card.id === card.id;
      const rowBg = this.add.rectangle(x + 150, y + 15, 312, 34, selected ? 0x1d2224 : 0x0f151d, selected ? 0.96 : 0.44)
        .setStrokeStyle(selected ? 1.5 : 1, selected ? 0xd8a840 : card.upgraded ? 0x24d0d6 : 0xffffff, selected ? 0.95 : 0.08)
        .setInteractive({ useHandCursor: true });
      rowBg.on('pointerdown', () => onInspect(card.id));
      this.add.rectangle(x + 150, y + 31, 280, 1, card.upgraded ? 0x24d0d6 : 0xd8a840, selected ? 0.6 : 0.18);
      this.add.circle(x + 14, y + 15, 13, card.cost === 0 ? 0x24d0d6 : 0xd8a840, 1);
      this.add.text(x + 14, y + 15, `${card.cost}`, {
        fontFamily: UI_FONT,
        fontSize: '13px',
        fontStyle: UI_BOLD,
        color: '#07101c'
      }).setOrigin(0.5);
      this.add.text(x + 36, y + 5, displayName(card), {
        fontFamily: UI_FONT,
        fontSize: '14px',
        fontStyle: UI_BOLD,
        color: UI_GOLD,
        wordWrap: { width: 170 }
      });
      this.add.text(x + 222, y + 6, `${cardLabel(card)} / ${zone}`, {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: '#7ab8d6'
      });
    });

    this.renderScrollButton(472, 214, 'Up', this.cardReviewScroll > 0, () => onScroll(-1));
    this.renderScrollButton(472, 610, 'Down', this.cardReviewScroll < scrollMax, () => onScroll(1));
    this.add.text(424, 632, `${this.cardReviewScroll + 1}-${this.cardReviewScroll + visible.length} / ${cards.length}`, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      color: '#91a6b8'
    });
  }

  private renderScrollButton(x: number, y: number, label: string, enabled: boolean, onClick: () => void) {
    renderFieldButton(this, (obj) => {}, x, y, 72, 28, label, enabled, onClick, UI_FIELD.gold);
  }

  private renderRouteCardDetailPanel(card: Card, zone: string) {
    renderSceneCardDetail(this, card, zone, card.cost);
  }

  private updateTextState() {
    const inspected = this.deckOverlayOpen
      ? inspectedCardPayload(getInspectedEntry(this.mapDeckCards(), this.inspectedCardId), undefined)
      : undefined;
    const marketNode = currentMap().nodes.find((node) => node.id === this.marketNodeId);
    const choiceNode = currentMap().nodes.find((node) => node.id === this.nodeChoiceNodeId);
    const marketBackdrop = this.routeEventBackdropAsset(marketNode);
    const choiceBackdrop = this.routeEventBackdropAsset(choiceNode);
    window.render_game_to_text = () => JSON.stringify({
      mode: 'routeSelection',
      scene: 'RouteScene',
      map: {
        id: currentMap().id,
        name: currentMap().name,
        index: currentMap().index,
        entryNodeId: currentMap().entryNodeId,
        bossNodeId: currentMap().bossNodeId
      },
      run: {
        currentNodeId: this.runState.currentRouteNodeId ?? '',
        completedNodeIds: [...this.runState.completedRouteNodeIds],
        deckSize: this.runState.deck.length,
        currentHp: this.runState.currentHp,
        maxHp: this.runMaxHp(),
        scrap: this.runState.scrap,
        routeMarks: [...this.runState.routeMarks],
        supplies: [...this.runState.supplies],
        supplySlots: runSupplyCapacity(this.runState)
      },
      routeStatus: this.routeStatusSummary(),
      supplyFeedback: [...this.supplyFeedback],
      deckOverlayOpen: this.deckOverlayOpen,
      flockOverlayOpen: this.flockOverlayOpen,
      waymarkDrawerOpen: this.waymarkDrawerOpen,
      supplyDrawerOpen: this.supplyDrawerOpen,
      marketOpen: this.marketOpen,
      market: this.marketOpen
        ? {
            scrap: this.runState.scrap,
            cardOffer: this.marketCardOffer()?.id ?? '',
            cardOffers: this.marketCardShelf.map((offer) => ({ id: offer.id, price: offer.price, sold: !!offer.sold })),
            routeMarkOffer: this.marketRouteMarkOffer()?.id ?? '',
            routeMarkOffers: this.marketWaymarkShelf.map((offer) => ({ id: offer.id, price: offer.price, sold: !!offer.sold })),
            preenOffer: this.marketPreenCandidate()?.id ?? '',
            utilityOffers: this.marketUtilityShelf.map((offer) => ({
              id: offer.id,
              price: offer.price,
              supplyId: offer.supplyId ?? '',
              sold: !!offer.sold
            })),
            refreshCost: this.marketRefreshCost(),
            refreshCount: this.marketRefreshCount,
            message: this.marketMessage,
            backdropAssetKey: marketBackdrop?.key ?? ''
        }
        : undefined,
      nodeChoice: this.nodeChoiceOpen && choiceNode
        ? {
            nodeId: choiceNode.id,
            type: choiceNode.type,
            backdropAssetKey: choiceBackdrop?.key ?? ''
        }
        : undefined,
      bossPrep: this.bossPrepReadiness(),
      inspectedCard: inspected,
      selectableNodeIds: [...this.selectableNodeIds],
      nodes: currentMap().nodes.map((node) => ({
        ...(() => {
          const position = this.nodePosition(node);
          return {
            position,
            visualBounds: this.nodeVisualBounds(node)
          };
        })(),
        id: node.id,
        label: node.label,
        type: node.type,
        risk: node.risk,
        column: node.column,
        lane: node.lane,
        completed: this.runState.completedRouteNodeIds.includes(node.id),
        current: this.runState.currentRouteNodeId === node.id,
        selectable: this.selectableNodeIds.has(node.id),
        rewardBadges: this.routeRewardBadges(node).map((badge) => badge.id)
      })),
      log: this.runState.routeLog.slice(-5)
    });
  }

  private runMaxHp() {
    return BASE_COHESION + (aggregateFlockStats(cardsFromSave(this.runState.deck)).cohesion ?? 0);
  }

  private routeSubtitle() {
    // Surface the district's mechanical thesis (Phase 6 MapDesignProfile).
    const thesis = alphaMapProfileLibrary.get(currentMap().id)?.thesis;
    return thesis ?? 'Choose the next crossing. Completed stops stay dimmed behind the flock.';
  }

  private bossPrepReadiness() {
    const bossNode = currentMap().nodes.find((node) => node.id === currentMap().bossNodeId);
    const encounter = bossNode ? alphaEncounterLibrary.get(bossNode.payloadId) : undefined;
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
    const usefulNodes = currentMap().nodes
      .filter((node) => !this.runState.completedRouteNodeIds.includes(node.id))
      .filter((node) => ['basin', 'nest', 'market', 'rival'].includes(node.type))
      .slice(0, 4)
      .map((node) => routeNodeTypeLabel(node.type).replace(' Workshop', ''));
    return {
      bossName: encounter?.name ?? bossNode?.label ?? 'Boss',
      pressure: encounter?.tags.filter((tag) => ['cover', 'heavy', 'snag', 'openSky', 'multi', 'tempo', 'winded'].includes(tag)).join(', ') || 'unknown',
      readiness,
      usefulNodes
    };
  }

}

class BattleScene extends Phaser.Scene {
  private flock!: Flock;
  private enemies: Enemy[] = [];
  private drawPile: Card[] = [];
  private discardPile: Card[] = [];
  private hand: Card[] = [];
  private selectedInstanceId: string | undefined;
  private selectedEnemyId = 'roof-rat';
  private energy = 3;
  private nextTurnEnergyBonus = 0;
  private nextTurnDrawBonus = 0;
  private pendingNestCoverBonus = 0;
  private pendingRetainHand = 0;
  private pendingSupplyRepeats = 0;
  private spark = 0;
  private turn = 1;
  private encounter = 1;
  private maxEncounters = 2;
  private currentRouteIndex = 0;
  private completedRouteNodeIds: string[] = [];
  private scrap = 0;
  private routeMarks: string[] = [];
  private runSupplies: string[] = [];
  private runSupplyCapacity = BASE_SUPPLY_SLOTS;
  private runLeaderId?: string;
  private runDifficulty = 0;
  private lastRunRewards?: ReturnType<typeof recordRun>;
  private runSignalChoices: SignalChoiceEvent[] = [];
  private runRewardEvents: CardRewardEvent[] = [];
  private runSuppliesUsed: string[] = [];
  private runCombatResults: CombatResultSummary[] = [];
  private freePreenNextDistrict = 0;
  private mode: GameMode = 'battle';
  private combatEconomyAwarded = false;
  private combatScrapAwarded = 0;
  private combatRouteMarkAwarded?: RuntimeRouteMark;
  private combatRouteMarkResolved = false;
  private waymarkChoices: RuntimeRouteMark[] = [];
  private rewardChoices: Card[] = [];
  private upgradeChoices: Card[] = [];
  private log: string[] = [];
  private waymarkFeedback: WaymarkFeedback[] = [];
  private supplyFeedback: SupplyFeedback[] = [];
  private root!: Phaser.GameObjects.Container;
  // Persistent FX layer: renderAll() only clears `root`, so transient juice
  // (floating numbers, bursts) spawned here survives the synchronous redraw.
  private fxLayer!: Phaser.GameObjects.Container;
  private inspectOverlay: InspectOverlay | undefined;
  private inspectedCardId: string | undefined;
  private waymarkDrawerOpen = false;
  private supplyDrawerOpen = false;
  private waymarkDrawerScroll = 0;
  private cardReviewScroll = 0;
  private optionalArtRequested = false;
  private playedCardIdsThisCombat = new Set<string>();
  private playedSuitsThisTurn = new Set<string>();
  // Per-combat tracking for the battle-stats readout (reset each combat in init).
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
  // Last-rendered formation state, so transitions fire a one-shot banner/FX.
  private lastFlockState: FlockState = 'holding';
  // Floating large-card preview shown while hovering a hand card.
  private cardPreview?: Phaser.GameObjects.Container;
  private handCardRects = new Map<string, Phaser.GameObjects.Rectangle>();
  // Quills keystone: the first attack each turn hits harder (consumed on use).
  private firstAttackThisTurn = true;
  // renderAll() rebuilds the board, so one-shot enemy motion is queued here and
  // consumed by the next render instead of trying to animate destroyed objects.
  private enemyMotionCues = new Map<string, EnemyMotionCue>();
  private enemyTextureBoundsCache = new Map<string, TextureVisibleBounds>();
  private flockMotionCue?: 'cast' | 'brace' | 'heal' | 'hit';
  private leaderSignatureUsed = new Set<string>();
  private fledglingSuitRallies = new Set<string>();
  private introPlayed = false;

  constructor() {
    super('BattleScene');
  }

  init(data: BattleSceneData = {}) {
    const runState = cloneRunState(data.runState ?? createInitialRunState());
    this.runLeaderId = runState.leaderId;
    this.runDifficulty = runState.difficulty ?? 0;
    activeSeed = runState.seed ?? 'alpha';
    activeMapIndex = runState.mapIndex ?? 0;
    const initialRouteNode = selectedCombatRouteNode(data.routeNodeId);
    const initialRouteIndex = currentCombatNodes().findIndex((node) => node.id === initialRouteNode.id);
    this.flock = createFlock();
    // Per-leader formation-Flow identity (e.g. Spark-Caller surges sooner, Talon opens near Surge).
    const leader = getLeader(this.runLeaderId);
    this.flock.flowMax = leader.flowMax ?? this.flock.flowMax;
    this.flock.flow = Math.min(this.flock.flowMax, leader.startFlow ?? 0);
    this.enemies = createEncounterEnemiesForRouteNode(initialRouteNode);
    // Ascension: scale enemy Cohesion by the run's difficulty tier.
    const hpMult = difficultyMods(this.runDifficulty).enemyHpMult;
    if (hpMult !== 1) {
      this.enemies.forEach((enemy) => {
        enemy.maxHp = Math.round(enemy.maxHp * hpMult);
        enemy.hp = enemy.maxHp;
      });
    }
    this.drawPile = cardsFromSave(runState.deck);
    this.discardPile = [];
    this.hand = [];
    this.selectedInstanceId = undefined;
    this.selectedEnemyId = this.enemies[0]?.id ?? '';
    this.energy = 3;
    this.nextTurnEnergyBonus = 0;
    this.nextTurnDrawBonus = 0;
    this.pendingNestCoverBonus = 0;
    this.pendingRetainHand = 0;
    this.pendingSupplyRepeats = 0;
    this.spark = 0;
    this.turn = 1;
    this.encounter = initialRouteIndex + 1;
    this.maxEncounters = currentCombatNodes().length;
    this.currentRouteIndex = initialRouteIndex;
    this.completedRouteNodeIds = [...runState.completedRouteNodeIds];
    this.scrap = runState.scrap;
    this.routeMarks = [...runState.routeMarks];
    this.runSupplies = [...(runState.supplies ?? [])];
    this.runSupplyCapacity = runSupplyCapacity(runState);
    this.runSignalChoices = [...(runState.signalChoices ?? [])];
    this.runRewardEvents = [...(runState.rewardEvents ?? [])];
    this.runSuppliesUsed = [...(runState.suppliesUsed ?? [])];
    this.runCombatResults = [...(runState.combatResults ?? [])];
    this.freePreenNextDistrict = runState.freePreenNextDistrict ?? 0;
    this.mode = 'battle';
    this.combatEconomyAwarded = false;
    this.combatScrapAwarded = 0;
    this.combatRouteMarkAwarded = undefined;
    this.combatRouteMarkResolved = false;
    this.waymarkChoices = [];
    this.inspectOverlay = undefined;
    this.inspectedCardId = undefined;
    this.waymarkDrawerOpen = false;
    this.supplyDrawerOpen = false;
    this.waymarkDrawerScroll = 0;
    this.cardReviewScroll = 0;
    this.rewardChoices = [];
    this.upgradeChoices = [];
    this.log = [`${currentMap().name}: ${initialRouteNode.label} begins.`];
    this.waymarkFeedback = [];
    this.supplyFeedback = [];
    this.optionalArtRequested = false;
    this.playedCardIdsThisCombat = new Set();
    this.playedSuitsThisTurn = new Set();
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
    this.zeroCostThisTurn = 0;
    this.roostCards = 0;
    this.roostFree = 0;
    this.roostHeld = 0;
    this.applyFlockStats(true);
    this.flock.hp = Math.min(this.flock.maxHp, Math.max(1, runState.currentHp));
    this.applyNextCombatMods(runState.nextCombat);
    this.firstAttackThisTurn = true;
    this.enemyMotionCues = new Map();
    this.leaderSignatureUsed = new Set();
    this.fledglingSuitRallies = new Set();
    this.introPlayed = false;
    this.drawToHandSize();
    this.lastFlockState = this.flockState();
  }

  // Consume route-granted pending combat modifiers at combat start (Supplies,
  // Signals, and Waymarks that set up the next fight).
  private applyNextCombatMods(pending: NextCombatMods | undefined) {
    if (!pending) return;
    if (pending.openSkyGuard) this.flock.openSkyGuard += pending.openSkyGuard;
    if (pending.reduceNextOpenSky) this.flock.openSkyGuard += pending.reduceNextOpenSky;
    if (pending.startOpenSky) { this.flock.exposed = true; this.flock.exposedTurns = 2; }
    if (pending.enemyCover) this.enemies.forEach((enemy) => { enemy.block += pending.enemyCover ?? 0; });
    if (pending.bossDamageShield && currentCombatNodes()[this.currentRouteIndex]?.type === 'boss') {
      this.flock.block += pending.bossDamageShield;
      this.logEvent(`Boss prep adds ${pending.bossDamageShield} Cover.`);
    }
  }

  // --- Waymarks --------------------------------------------------------------
  // Waymarks are persistent run-long item modifiers. Each owned mark fires its authored
  // `effect` at its `trigger` through resolveMarkEffect, so authored marks
  // actually reshape combat instead of being decorative collectibles.
  private ownedMarkDefs() {
    return this.routeMarks
      .map((id) => alphaRouteMarkLibrary.get(id))
      .filter((mark): mark is NonNullable<typeof mark> => !!mark);
  }

  // The closed mark-effect verb set the runtime honors at a trigger point.
  // Economy/passive verbs (gainScrap/addHeal/reducePreenPrice/reduceOpenSky/
  // gainSupplyChoice) are consumed at their own dedicated sites, not here.
  private resolveMarkEffect(effect: string, markName: string) {
    const parsed = parseEffect(effect);
    if (!parsed) return;
    const value = parseEffectValue(parsed.args[1] ?? parsed.args[0], 0);
    switch (parsed.name) {
      case 'gainCover':
        this.flock.block += value;
        floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y, `+${value} Cover`, '#c9a6ff');
        break;
      case 'gainCoverPerWaymark': {
        const cover = Math.max(0, value * this.routeMarks.length);
        this.flock.block += cover;
        floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y, `+${cover} Cover`, '#c9a6ff');
        break;
      }
      case 'gainWingbeat':
        this.energy += value;
        break;
      case 'gainEnergyNextTurn':
        this.nextTurnEnergyBonus += value;
        break;
      case 'gainResonance':
        this.gainResonance(value);
        break;
      case 'gainScrap':
        this.scrap += value;
        break;
      case 'gainOpenSkyGuard':
        this.flock.openSkyGuard += value;
        break;
      case 'reduceNextOpenSky':
        this.flock.openSkyGuard += value;
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
        break;
      case 'retainHand':
        this.pendingRetainHand += value;
        break;
      case 'nextTurnDraw':
        this.nextTurnDrawBonus += value;
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
          floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 24, `+${value} Boss Cover`, '#ffe1a3');
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

    if (!this.fxLayer?.active) return;
    const accent = this.waymarkAccent(mark);
    const sameTurnIndex = Math.min(
      this.waymarkFeedback.filter((entry) => entry.turn === this.turn).length - 1,
      2
    );
    const x = 178;
    const y = 216 + sameTurnIndex * 58;
    const toast = this.add.container(x, y).setAlpha(0).setScale(0.96);
    const bg = this.add.rectangle(0, 0, 294, 50, 0x07101c, 0.96)
      .setStrokeStyle(2, accent, 0.95);
    toast.add(bg);
    toast.add(this.add.rectangle(-134, 0, 4, 36, accent, 0.95));
    const artAsset = waymarkArtAssets[mark.id];
    if (artAsset && this.textures.exists(artAsset.key)) {
      toast.add(addWaymarkArtImage(this, -108, 0, artAsset.key).setDisplaySize(36, 36));
    } else {
      toast.add(this.add.text(-108, -1, waymarkGlyph(mark), {
        fontFamily: UI_FONT,
        fontSize: '18px',
        fontStyle: UI_BOLD,
        color: '#e7eef7'
      }).setOrigin(0.5));
    }
    toast.add(this.add.text(-78, -15, mark.name, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      fixedWidth: 190,
      maxLines: 1,
    }).setResolution(2));
    toast.add(this.add.text(-78, 3, summary, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      color: UI_BODY,
      fixedWidth: 220,
      maxLines: 1,
    }).setResolution(2));
    this.fxLayer.add(toast);
    this.tweens.add({
      targets: toast,
      alpha: 1,
      scale: 1,
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => this.tweens.add({
        targets: toast,
        y: y - 14,
        alpha: 0,
        delay: 900,
        duration: 360,
        ease: 'Cubic.easeIn',
        onComplete: () => toast.destroy(),
      }),
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

    if (!this.fxLayer?.active) return;
    const accent = 0xffb86b;
    const sameTurnIndex = Math.min(
      this.supplyFeedback.filter((entry) => entry.turn === this.turn).length - 1,
      2
    );
    const x = 194;
    const y = 154 + sameTurnIndex * 54;
    const toast = this.add.container(x, y).setAlpha(0).setScale(0.96);
    toast.add(this.add.rectangle(0, 0, 288, 48, 0x07101c, 0.96)
      .setStrokeStyle(2, accent, 0.94));
    toast.add(this.add.rectangle(-132, 0, 4, 34, accent, 0.95));
    const artAsset = supplyArtAssets[supply.id];
    if (artAsset && this.textures.exists(artAsset.key)) {
      toast.add(addSupplyArtImage(this, -108, 0, artAsset.key).setDisplaySize(36, 36));
    } else {
      toast.add(this.add.text(-108, 0, this.supplyGlyph(supply), {
        fontFamily: UI_FONT,
        fontSize: '18px',
        fontStyle: UI_BOLD,
        color: '#ffe7c9'
      }).setOrigin(0.5));
    }
    toast.add(this.add.text(-78, -15, supply.name, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      fixedWidth: 186,
      maxLines: 1
    }).setResolution(2));
    toast.add(this.add.text(-78, 3, summary, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      color: UI_BODY,
      fixedWidth: 216,
      maxLines: 1
    }).setResolution(2));
    this.fxLayer.add(toast);
    this.tweens.add({
      targets: toast,
      alpha: 1,
      scale: 1,
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => this.tweens.add({
        targets: toast,
        y: y - 14,
        alpha: 0,
        delay: 900,
        duration: 360,
        ease: 'Cubic.easeIn',
        onComplete: () => toast.destroy()
      })
    });
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
      const lowCard = /^onLowCardTurn\((\d+)\)$/.exec(mark.trigger);
      if (mark.trigger === 'onRoostWithWingbeat' && wingbeatAtRoost > 0) {
        this.fireOncePerCombatMark(mark);
      } else if (mark.trigger === 'onRoostWithCardsInHand' && cardsHeldAtRoost > 0) {
        this.fireOncePerCombatMark(mark);
      } else if (mark.trigger === 'onTurnEndNoOverextension' && cardsPlayedAtRoost > 0 && cardsPlayedAtRoost < OVEREXTENSION_CARD_THRESHOLD) {
        this.fireOncePerCombatMark(mark);
      } else if (lowCard && cardsPlayedAtRoost > 0 && cardsPlayedAtRoost <= Number(lowCard[1])) {
        this.fireOncePerCombatMark(mark);
      }
    }
  }

  private checkSupplyUsedMarks() {
    for (const mark of this.ownedMarkDefs()) {
      if (mark.trigger !== 'onSupplyUsed') continue;
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
          const pick = ids[Math.floor(Math.random() * ids.length)];
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
            const pick = ids[Math.floor(Math.random() * ids.length)];
            if (pick) this.runSupplies.push(pick);
          }
          this.logEvent(`${mark.name}: the next district starts with Preen and packed gear.`);
        }
        if (parsed && parsed.name === 'gainScrap') {
          const value = parseEffectValue(parsed.args[1] ?? parsed.args[0], 0);
          this.scrap += value;
          this.logEvent(`${mark.name}: +${value} Scrap waits on the reopened route.`);
        }
      }
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#08101d');
    this.root = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    this.ensureFxTextures();
    this.cameras.main.fadeIn(200);

    this.input.keyboard?.on('keydown-ESC', () => {
      this.selectedInstanceId = undefined;
      this.inspectOverlay = undefined;
      this.inspectedCardId = undefined;
      this.waymarkDrawerOpen = false;
      this.supplyDrawerOpen = false;
      this.renderAll();
    });
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.inspectOverlay || this.waymarkDrawerOpen || this.supplyDrawerOpen) return;
      this.endTurn();
    });
    this.input.keyboard?.on('keydown-F', () => this.scale.toggleFullscreen());
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      if (this.waymarkDrawerOpen) {
        this.scrollWaymarkDrawer(deltaY > 0 ? 1 : -1);
        return;
      }
      if (this.supplyDrawerOpen) return;
      if (!this.inspectOverlay || this.inspectOverlay === 'flock') return;
      this.scrollCardReview(deltaY > 0 ? 1 : -1);
    });

    window.__birdSquadState = () => this.getTextState();
    window.__birdSquadExportRuns = () => window.localStorage.getItem('birdsquad.runs') ?? '[]';
    window.render_game_to_text = () => JSON.stringify(this.getTextState());
    window.advanceTime = (_ms: number) => {
      window.render_game_to_text = () => JSON.stringify(this.getTextState());
    };

    this.applyCombatStartMarks(); // relic effects need fxLayer, so fire after create()
    this.renderAll();
    this.queueOptionalArtLoad();
    this.playBattleIntro();
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

  private playBattleIntro() {
    if (this.introPlayed || prefersReducedMotion()) return;
    this.introPlayed = true;
    const node = currentCombatNodes()[this.currentRouteIndex];
    const c = this.add.container(0, 0);
    const shade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.54);
    const topBand = this.add.rectangle(GAME_WIDTH / 2, 106, GAME_WIDTH, 70, 0x05080e, 0.84);
    const bottomBand = this.add.rectangle(GAME_WIDTH / 2, 610, GAME_WIDTH, 70, 0x05080e, 0.78);
    const line = this.add.rectangle(GAME_WIDTH / 2, 356, 760, 3, 0x8df4ff, 0.85).setAngle(-9);
    const leftLabel = this.add.text(74, 86, 'ROOFLINE CONTACT', {
      fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: UI_CYAN,
    });
    const title = this.add.text(74, 112, currentMap().name, {
      fontFamily: 'Georgia, serif', fontSize: '23px', fontStyle: UI_BOLD, color: UI_GOLD,
      stroke: '#000000', strokeThickness: 4,
    });
    const rightLabel = this.add.text(GAME_WIDTH - 74, 594, node?.label ?? 'Rooftop Fight', {
      fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: '#ffd5cc',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(1, 0);
    const sub = this.add.text(GAME_WIDTH - 74, 620, 'Enemies sighted on the roofline.', {
      fontFamily: UI_FONT, fontSize: '12px', color: UI_SOFT,
    }).setOrigin(1, 0);
    c.add([shade, topBand, bottomBand, line, leftLabel, title, rightLabel, sub]);
    this.fxLayer.add(c);
    c.setAlpha(0);
    this.tweens.add({
      targets: c,
      alpha: 1,
      duration: 180,
      ease: 'Quad.easeOut',
      yoyo: true,
      hold: 660,
      onComplete: () => c.destroy(true),
    });
    this.pulseRing(FLOCK_FX_X, FLOCK_FX_Y, 0x8df4ff, 92, 720);
  }

  private renderAll() {
    if (!this.root?.active) return;
    hideKwTooltip();
    enemyMoveContext = this.enemyContext(); // keep conditional intents live
    this.normalizeSelectedEnemy();
    this.updateFormationFx();
    killTweensForTree(this, this.root);
    this.root.removeAll(true);
    if (this.inspectOverlay || this.waymarkDrawerOpen || this.supplyDrawerOpen) {
      this.fxLayer.removeAll(true);
    }
    this.renderBackdrop();
    this.renderTopBar();
    this.renderEnemyRow();
    this.renderFlockLeader();
    this.renderPiles();
    this.renderHand();
    this.renderSupplyFeedbackStrip();
    this.renderCommandStrip();
    if (this.mode === 'waymarkReward') (this as unknown as { renderWaymarkReward: () => void }).renderWaymarkReward();
    if (this.mode === 'cardReward') this.renderCardReward();
    if (this.mode === 'upgradeReward') this.renderUpgradeReward();
    if (this.mode === 'runComplete' || this.mode === 'defeat') this.renderOutcome();
    if (this.inspectOverlay) this.renderInspectOverlay(this.inspectOverlay);
    if (this.waymarkDrawerOpen) this.renderWaymarkDrawer();
    if (this.supplyDrawerOpen) this.renderSupplyDrawer();
  }

  private renderBackdrop() {
    const battlefield = this.currentBattlefieldAsset();
    if (this.textures.exists(battlefield.key)) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, battlefield.key)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(0.82);
      this.root.add(bg);
    } else {
      this.renderFallbackBackdrop();
    }

    // Vignette: even top shade + darker top/bottom bands + corner darkening for depth.
    const shade = this.add.graphics();
    shade.fillStyle(0x06101d, 0.3);
    shade.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    shade.fillStyle(0x020409, 0.42);
    shade.fillRect(0, 0, GAME_WIDTH, 116);
    shade.fillStyle(0x020409, 0.5);
    shade.fillRect(0, 452, GAME_WIDTH, 268);
    shade.fillStyle(0x02060c, 0.28);
    shade.fillRect(0, 0, 150, GAME_HEIGHT);
    shade.fillRect(GAME_WIDTH - 150, 0, 150, GAME_HEIGHT);
    this.root.add(shade);
    this.renderEncounterBackdropTreatment();
    this.renderAtmosphereOverlay();
  }

  private battlefieldMood(): 'street' | 'rival' | 'boss' {
    const type = this.currentRouteNode()?.type;
    if (type === 'boss') return 'boss';
    if (type === 'rival') return 'rival';
    return 'street';
  }

  private renderEncounterBackdropTreatment() {
    const mood = this.battlefieldMood();
    const treatment = this.add.graphics();

    if (mood === 'boss') {
      treatment.fillStyle(0x2a0808, 0.18);
      treatment.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      treatment.lineStyle(2, 0xff7a6e, 0.22);
      for (let x = 64; x < GAME_WIDTH; x += 176) {
        treatment.lineBetween(x, 0, x + 96, 116);
      }
      treatment.fillStyle(0xff3d3d, 0.34);
      for (let x = 196; x < GAME_WIDTH; x += 196) {
        treatment.fillCircle(x, 18, 4);
        treatment.fillCircle(x, 26, 2);
      }
      treatment.fillStyle(0x020409, 0.34);
      treatment.fillRect(0, 0, GAME_WIDTH, 72);
    } else if (mood === 'rival') {
      treatment.fillStyle(0x241508, 0.13);
      treatment.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      treatment.lineStyle(3, 0xffcf6b, 0.18);
      for (let x = -120; x < GAME_WIDTH + 160; x += 150) {
        treatment.lineBetween(x, 452, x + 280, 248);
      }
      treatment.fillStyle(0xff9d4d, 0.16);
      treatment.fillRect(0, 130, 142, 286);
      treatment.fillRect(GAME_WIDTH - 142, 116, 142, 320);
    } else {
      treatment.lineStyle(1, 0x8df4ff, 0.12);
      for (let x = 160; x < GAME_WIDTH; x += 220) {
        treatment.lineBetween(x, 114, x - 74, 438);
      }
      treatment.fillStyle(0x8df4ff, 0.06);
      treatment.fillRect(150, 116, 3, 324);
      treatment.fillRect(GAME_WIDTH - 153, 116, 3, 324);
    }

    this.root.add(treatment);
  }

  private renderAtmosphereOverlay() {
    if (!this.textures.exists(COMBAT_ATMOSPHERE_TEXTURE)) return;
    const frame = Math.max(0, Math.min(3, activeMapIndex));
    const yRows = activeMapIndex === 1
      ? [160, 252, 344, 414]
      : activeMapIndex === 3
        ? [138, 224, 314]
        : [134, 226, 318];
    const c = this.add.container(0, 0);
    yRows.forEach((y, row) => {
      for (let col = -1; col <= 5; col += 1) {
        const tile = this.add.image(col * 256 + 128 + row * 37, y, COMBAT_ATMOSPHERE_TEXTURE, frame)
          .setAlpha(activeMapIndex === 2 ? 0.42 : 0.34)
          .setScale(1);
        c.add(tile);
      }
    });
    this.root.add(c);

    if (prefersReducedMotion()) return;
    this.tweens.add({
      targets: c,
      x: activeMapIndex === 1 ? -42 : 46,
      alpha: activeMapIndex === 2 ? 0.72 : 0.6,
      duration: 2600 + activeMapIndex * 260,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private playFxAnimation(
    animKey: string,
    x: number,
    y: number,
    options: {
      scale?: number;
      alpha?: number;
      angle?: number;
      flipX?: boolean;
      tint?: number;
      additive?: boolean;
      onComplete?: () => void;
    } = {}
  ) {
    if (!this.textures.exists(COMBAT_FX_TEXTURE) || !this.anims.exists(animKey)) return undefined;
    const sprite = this.add.sprite(x, y, COMBAT_FX_TEXTURE)
      .setOrigin(0.5)
      .setScale(options.scale ?? 1.35)
      .setAlpha(options.alpha ?? 0.96)
      .setAngle(options.angle ?? 0);
    if (options.flipX) sprite.setFlipX(true);
    if (options.tint) sprite.setTint(options.tint);
    if (options.additive) sprite.setBlendMode(Phaser.BlendModes.ADD);
    this.fxLayer.add(sprite);
    sprite.play(animKey);
    sprite.once('animationcomplete', () => {
      options.onComplete?.();
      sprite.destroy();
    });
    return sprite;
  }

  private fxMoteBurst(
    x: number,
    y: number,
    color: number,
    options: {
      count?: number;
      speed?: number;
      lifespan?: number;
      angle?: { min: number; max: number };
      scale?: number;
      gravityY?: number;
      spreadX?: number;
      spreadY?: number;
    } = {}
  ) {
    if (prefersReducedMotion() || !this.textures.exists(COMBAT_FX_PARTICLE_TEXTURE)) return;
    const lifespan = options.lifespan ?? 420;
    const count = options.count ?? 12;
    const speed = options.speed ?? 135;
    const emitter = this.add.particles(x, y, COMBAT_FX_PARTICLE_TEXTURE, {
      emitting: false,
      frequency: -1,
      lifespan: { min: Math.max(140, lifespan * 0.55), max: lifespan },
      speed: { min: speed * 0.22, max: speed },
      angle: options.angle ?? { min: 0, max: 360 },
      x: { min: -(options.spreadX ?? 8), max: options.spreadX ?? 8 },
      y: { min: -(options.spreadY ?? 8), max: options.spreadY ?? 8 },
      scale: { start: (options.scale ?? 0.82) * 0.78, end: 0, ease: 'Cubic.easeOut' },
      alpha: { start: 0.82, end: 0, ease: 'Cubic.easeIn' },
      rotate: { min: -45, max: 45 },
      gravityY: options.gravityY ?? 24,
      tint: { start: 0xffffff, end: color },
      blendMode: Phaser.BlendModes.ADD,
      maxParticles: count,
      reserve: count,
    });
    this.fxLayer.add(emitter);
    emitter.explode(count);
    this.time.delayedCall(lifespan + 120, () => emitter.destroy());
  }

  private fxShardSweep(x: number, y: number, color: number, direction: 1 | -1, count = 10) {
    this.fxMoteBurst(x, y, color, {
      count,
      speed: 180,
      lifespan: 360,
      angle: direction > 0 ? { min: -40, max: 40 } : { min: 140, max: 220 },
      scale: 0.72,
      gravityY: 8,
      spreadX: 4,
      spreadY: 10,
    });
  }

  private fxGlowPulse(x: number, y: number, color: number, radius = 72, duration = 360, alpha = 0.2) {
    if (prefersReducedMotion()) return;
    const glow = this.add.container(x, y);
    const falloff = this.add.ellipse(0, 0, radius * 1.12, radius * 0.56, color, alpha * 0.5)
      .setOrigin(0.5);
    const core = this.add.ellipse(0, 0, radius * 0.5, radius * 0.24, color, Math.min(0.38, alpha * 1.28))
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    glow.add([falloff, core]);
    glow.setScale(0.68).setAlpha(1);
    this.fxLayer.add(glow);
    this.tweens.add({
      targets: glow,
      scaleX: 1.52,
      scaleY: 1.2,
      alpha: 0,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => glow.destroy(true),
    });
  }

  private fxShockwave(x: number, y: number, color: number, radius = 86, duration = 430, tilt = -8) {
    if (prefersReducedMotion()) return;
    const ring = this.add.graphics();
    ring.lineStyle(3, 0x020409, 0.38);
    ring.strokeEllipse(0, 0, radius * 1.03, radius * 0.44);
    ring.lineStyle(2, color, 0.9);
    ring.strokeEllipse(0, 0, radius, radius * 0.42);
    ring.lineStyle(1, 0xffffff, 0.42);
    ring.strokeEllipse(0, 0, radius * 0.66, radius * 0.25);
    ring.setPosition(x, y).setAngle(tilt).setScale(0.68).setBlendMode(Phaser.BlendModes.ADD);
    this.fxLayer.add(ring);
    this.tweens.add({
      targets: ring,
      scaleX: 1.38,
      scaleY: 1.12,
      alpha: 0,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private fxDirectionalStreak(x1: number, y1: number, x2: number, y2: number, color: number, duration = 260) {
    if (prefersReducedMotion()) return;
    const streak = this.add.container(0, 0);
    const shadow = this.add.line(0, 0, x1, y1, x2, y2, 0x020409, 0.36).setOrigin(0);
    shadow.setLineWidth(6, 1);
    const ribbon = this.add.line(0, 0, x1, y1, x2, y2, color, 0.94).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    ribbon.setLineWidth(4, 0.9);
    const glint = this.add.line(0, 0, x1 + 3, y1 - 3, x2 - 6, y2 + 5, 0xffffff, 0.48).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    glint.setLineWidth(1.6, 0.25);
    streak.add([shadow, ribbon, glint]);
    streak.setAlpha(0.96);
    this.fxLayer.add(streak);
    this.tweens.add({
      targets: streak,
      alpha: 0,
      x: (x2 - x1) * 0.018,
      y: (y2 - y1) * 0.018,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => streak.destroy(true),
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
      floatingText(this, this.fxLayer, x, y - 58, label, meta.hex);
    }
  }

  private windedFx(x: number, y: number) {
    this.fxShockwave(x, y - 8, 0xc98bff, 62, 360, -11);
    this.fxGlowPulse(x, y - 10, 0xc98bff, 52, 320, 0.12);
    this.playFxAnimation('fx-winded', x, y - 10, { scale: 1.42, alpha: 0.78, additive: true });
    this.fxMoteBurst(x + 6, y - 8, 0xc98bff, {
      count: 10,
      speed: 92,
      lifespan: 420,
      angle: { min: 178, max: 352 },
      scale: 0.48,
      gravityY: -8,
      spreadX: 18,
      spreadY: 8,
    });
  }

  private coverImpactFx(x: number, y: number, color = 0x7ab8d6) {
    const hostile = color === 0x9fb1c4;
    this.fxGlowPulse(x, y - 8, hostile ? 0xff9d6b : color, hostile ? 48 : 62, 280, hostile ? 0.1 : 0.13);
    this.fxShockwave(x, y - 8, hostile ? 0xff9d6b : color, hostile ? 48 : 66, 320, hostile ? 9 : -8);
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
    this.fxGlowPulse(FLOCK_FX_X, FLOCK_FX_Y + 20, 0x8fd6a0, 90, 440, 0.16);
    this.fxShockwave(FLOCK_FX_X, FLOCK_FX_Y + 24, 0x8fd6a0, 84, 460, -7);
    this.fxSuitSignature('nests', FLOCK_FX_X, FLOCK_FX_Y + 18, 0x8fd6a0, 1.08);
    this.playFxAnimation('fx-nests', FLOCK_FX_X, FLOCK_FX_Y + 20, {
      scale: 1.52,
      alpha: 0.76,
      additive: true,
    });
    this.fxMoteBurst(FLOCK_FX_X, FLOCK_FX_Y + 24, 0x8fd6a0, {
      count: 12,
      speed: 88,
      lifespan: 440,
      scale: 0.52,
      gravityY: -18,
      spreadX: 26,
      spreadY: 10,
    });
    if (suit && suit !== 'nests') {
      this.fxSuitSignature(suit, FLOCK_FX_X + 22, FLOCK_FX_Y - 12, meta.color, 0.82);
      this.playFxAnimation(SUIT_FX_ANIM[suit] ?? this.fxAnimForColor(meta.color), FLOCK_FX_X + 22, FLOCK_FX_Y - 12, {
        scale: 1.1,
        alpha: 0.72,
        additive: true,
      });
      this.fxMoteBurst(FLOCK_FX_X + 22, FLOCK_FX_Y - 12, meta.color, { count: 8, speed: 84, lifespan: 320, scale: 0.48, gravityY: 0 });
    }
  }

  private healFx() {
    this.fxGlowPulse(FLOCK_FX_X, FLOCK_FX_Y + 12, 0x8fd6a0, 88, 520, 0.16);
    this.fxShockwave(FLOCK_FX_X, FLOCK_FX_Y + 12, 0x8fd6a0, 74, 460, -6);
    this.fxSuitSignature('basins', FLOCK_FX_X + 4, FLOCK_FX_Y - 2, 0x8fd6a0, 0.96);
    this.playFxAnimation('fx-heal', FLOCK_FX_X, FLOCK_FX_Y + 12, { scale: 1.42, alpha: 0.78, additive: true });
    this.playFxAnimation('fx-basins', FLOCK_FX_X + 16, FLOCK_FX_Y - 24, { scale: 0.92, alpha: 0.54, additive: true });
    this.fxMoteBurst(FLOCK_FX_X, FLOCK_FX_Y + 14, 0x8fd6a0, {
      count: 14,
      speed: 68,
      lifespan: 560,
      angle: { min: 235, max: 305 },
      scale: 0.52,
      gravityY: -42,
      spreadX: 24,
      spreadY: 12,
    });
  }

  private renderFallbackBackdrop() {
    const bg = this.add.graphics();
    bg.fillStyle(0x0f1b2a, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fillStyle(0x15263a, 0.75);
    for (let i = 0; i < 14; i += 1) {
      const x = i * 96;
      const h = 80 + ((i * 47) % 130);
      bg.fillRect(x, 64 + (i % 3) * 20, 62, h);
    }
    this.root.add(bg);
  }

  private battleArtAssets() {
    return uniqueImageAssets([
      scrapArtAsset,
      ...Object.values(uiIconAssets),
      snagCardBorderAsset,
      this.currentBattlefieldAsset(),
      this.currentFlockLeaderArtAsset(),
      ...this.routeMarks.map((id) => waymarkArtAssets[id]),
      ...this.runSupplies.map((id) => supplyArtAssets[id]),
      ...this.allDeckCards().map((card) => cardCompactArtAsset(card)),
      ...this.enemies
        .map((enemy) => enemyArtAssets[enemy.runtime.id] ?? enemyArtAssets[enemy.id])
        .filter((asset): asset is RuntimeImageAsset => Boolean(asset))
    ]);
  }

  preload() {
    queuePreloadImageAssets(this, this.battleArtAssets(), 'Battle scene art failed to preload');
  }

  private queueOptionalArtLoad() {
    if (this.optionalArtRequested) return;
    this.optionalArtRequested = true;

    this.queueImageAssets(this.battleArtAssets(), 'Optional art failed to load');
  }

  private currentRouteNode() {
    return currentCombatNodes()[this.currentRouteIndex];
  }

  private currentBattlefieldAsset() {
    return currentBattlefieldAsset(this.currentRouteNode());
  }

  private queueCardArtLoad(cards: Card[]) {
    const assets = uniqueImageAssets([
      ...cards.map((card) => cardCompactArtAsset(card)),
      ...(cards.some(isSnagCard) ? [snagCardBorderAsset] : [])
    ]);
    this.queueImageAssets(assets, 'Card art failed to load');
  }

  private queueCurrentWaymarkArtLoad() {
    const assets = uniqueImageAssets(this.routeMarks.map((id) => waymarkArtAssets[id]));
    this.queueImageAssets(assets, 'Waymark art failed to load');
  }

  private queueWaymarkRewardArtLoad() {
    const assets = uniqueImageAssets(this.waymarkChoices.map((mark) => waymarkArtAssets[mark.id]));
    this.queueImageAssets(assets, 'Waymark reward art failed to load');
  }

  private queueImageAssets(assets: RuntimeImageAsset[], warning: string) {
    queueRuntimeImageAssets(this, assets, warning, () => this.renderAll());
  }

  // Per-enemy board placement: a single enemy keeps the classic right-side
  // anchor; larger groups shrink and stagger to keep art, HP, and intent readable.
  // Boss fights keep the boss visually dominant while helpers sit lower/wider.
  private enemyView(enemy: Enemy): { x: number; y: number; scale: number } {
    const index = Math.max(0, this.enemies.indexOf(enemy));
    const count = this.enemies.length;
    const bossIndex = this.enemies.findIndex((candidate) => candidate.runtime.type === 'boss');
    if (bossIndex >= 0 && count > 1) {
      if (index === bossIndex) {
        return { x: 930, y: count >= 4 ? 300 : 314, scale: count >= 4 ? 1 : 1.08 };
      }
      const goonIndex = this.enemies.slice(0, index).filter((candidate) => candidate.runtime.type !== 'boss').length;
      return bossGoonViewAt(goonIndex, count - 1);
    }
    if (enemy.runtime.type === 'boss') return { x: ENEMY_FX_X, y: 342, scale: 1.24 };
    return enemyViewAt(index, count);
  }

  // HP-bar geometry for an enemy, matching renderEnemyRow so the drain animation
  // (damageEnemy) lines up. Identical to ENEMY_HP_BAR for the single-enemy case.
  private enemyHpBar(enemy: Enemy): { x: number; y: number; w: number; h: number } {
    const { x, y, scale } = this.enemyView(enemy);
    return { x, y: y + 68 * scale, w: (enemy.runtime.type === 'boss' ? 250 : ENEMY_HP_BAR.w) * scale, h: ENEMY_HP_BAR.h };
  }

  private queueEnemyMotion(enemyId: string, cue: EnemyMotionCue) {
    if (prefersReducedMotion()) return;
    this.enemyMotionCues.set(enemyId, cue);
  }

  private queueFlockMotion(cue: 'cast' | 'brace' | 'heal' | 'hit') {
    if (prefersReducedMotion()) return;
    this.flockMotionCue = cue;
  }

  private addEnemyBreathing(group: Phaser.GameObjects.Container, enemy: Enemy, scale: number) {
    if (prefersReducedMotion()) return;
    const seed = stableMotionSeed(enemy.id);
    const lift = (3.5 + (seed % 3)) * scale;
    this.tweens.add({
      targets: group,
      y: group.y - lift,
      scaleX: 0.992 - (seed % 2) * 0.002,
      scaleY: 1.024 + (seed % 3) * 0.003,
      duration: 1500 + (seed % 420),
      delay: seed % 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private applyEnemyMotionCue(group: Phaser.GameObjects.Container, enemy: Enemy, scale: number) {
    const cue = this.enemyMotionCues.get(enemy.id);
    if (!cue || prefersReducedMotion()) return;
    this.enemyMotionCues.delete(enemy.id);
    const recoil = cue === 'hit';
    const xShift = (recoil ? 12 : -14) * scale;
    const duration = recoil ? 90 : 120;
    this.tweens.add({
      targets: group,
      x: xShift,
      scaleX: recoil ? 0.985 : 1.018,
      scaleY: recoil ? 1.012 : 0.988,
      duration,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (!group.active) return;
        group.x = 0;
        group.y = 0;
        group.setScale(1);
      },
    });
    if (recoil) {
      this.tweens.add({
        targets: group,
        alpha: 0.68,
        duration: 45,
        yoyo: true,
        ease: 'Linear',
        onComplete: () => {
          if (group.active) group.setAlpha(1);
        },
      });
    }
  }

  private applyFlockMotionCue(group: Phaser.GameObjects.Container) {
    const cue = this.flockMotionCue;
    if (!cue || prefersReducedMotion()) return;
    this.flockMotionCue = undefined;
    const motion = {
      cast: { x: 12, y: -10, scaleX: 1.018, scaleY: 0.99, duration: 120 },
      brace: { x: -4, y: 6, scaleX: 1.028, scaleY: 0.978, duration: 110 },
      heal: { x: 0, y: -8, scaleX: 1.012, scaleY: 1.018, duration: 140 },
      hit: { x: -12, y: 8, scaleX: 0.982, scaleY: 1.018, duration: 90 },
    }[cue];
    this.tweens.add({
      targets: group,
      x: motion.x,
      y: motion.y,
      scaleX: motion.scaleX,
      scaleY: motion.scaleY,
      duration: motion.duration,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (!group.active) return;
        group.x = 0;
        group.y = 0;
        group.setScale(1);
      },
    });
    if (cue === 'hit') {
      this.tweens.add({
        targets: group,
        alpha: 0.7,
        duration: 45,
        yoyo: true,
        ease: 'Linear',
        onComplete: () => {
          if (group.active) group.setAlpha(1);
        },
      });
    }
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
      hitboxY: shadowY - visibleH * 0.48,
      shadowY,
      shadowW: clamp(visibleW * 0.78, 76 * scale, 148 * scale),
      shadowH: clamp(visibleH * 0.12, 13 * scale, 26 * scale),
    };
  }

  private renderEnemyRow() {
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) {
        this.enemyMotionCues.delete(enemy.id);
        continue;
      }
      const selected = enemy.id === this.selectedEnemyId;
      const { x, y, scale: s } = this.enemyView(enemy);
      const elite = enemy.runtime.type === 'elite';
      const boss = enemy.runtime.type === 'boss';
      const move = currentMove(enemy);

      const frameColor = selected ? 0x24d0d6 : elite ? 0xffcf4a : boss ? 0xff6f6f : 0xd8a840;
      const artAsset = enemyArtAssets[enemy.runtime.id] ?? enemyArtAssets[enemy.id];
      const hasEnemyArt = Boolean(artAsset && this.textures.exists(artAsset.key));
      let artFit = 1;
      let artPlacement: ReturnType<BattleScene['combatEnemyArtPlacement']> | undefined;
      if (hasEnemyArt && artAsset) {
        const source = this.textures.get(artAsset.key).getSourceImage() as { width?: number; height?: number };
        const sourceW = Math.max(1, Number(source.width ?? 1));
        const sourceH = Math.max(1, Number(source.height ?? 1));
        artFit = Math.min((236 * s) / sourceW, (214 * s) / sourceH);
        artPlacement = this.combatEnemyArtPlacement(artAsset.key, artFit, s);
      }
      const breathGroup = this.add.container(x, y);
      const poseGroup = this.add.container(0, 0);
      breathGroup.add(poseGroup);
      const shadow = this.add.ellipse(
        0,
        artPlacement?.shadowY ?? 34 * s,
        artPlacement?.shadowW ?? 112 * s,
        artPlacement?.shadowH ?? 22 * s,
        0x020409,
        hasEnemyArt ? 0.38 : 0.26,
      );
      poseGroup.add(shadow);
      const body = hasEnemyArt
        ? this.add.rectangle(0, artPlacement?.hitboxY ?? -18 * s, 248 * s, 236 * s, 0x000000, 0.001)
          .setInteractive({ useHandCursor: true })
        : this.add.ellipse(0, 0, 174 * s, 136 * s, elite ? 0x5b3f6d : 0x6f4b35, 1)
          .setStrokeStyle(selected ? 5 : elite ? 4 : 2, frameColor, 1)
          .setInteractive({ useHandCursor: true });
      body.on('pointerdown', () => this.onEnemyClicked(enemy.id));
      poseGroup.add(body);
      if (hasEnemyArt && artAsset) {
        const art = this.add.image(artPlacement?.artX ?? 0, artPlacement?.artY ?? -22 * s, artAsset.key)
          .setScale(artFit)
          .setAlpha(0.99)
          .setInteractive({ useHandCursor: true });
        art.on('pointerdown', () => this.onEnemyClicked(enemy.id));
        poseGroup.add(art);
      } else {
        poseGroup.add(this.add.triangle(68 * s, -10 * s, 0, 0, 22 * s, 8 * s, 0, 16 * s, 0xe7c36a, 1));
        poseGroup.add(this.add.text(0, -10 * s, enemyInitials(enemy.name), {
          fontFamily: UI_FONT,
          fontSize: `${Math.round(28 * s)}px`,
          fontStyle: UI_BOLD,
          color: '#1b1110'
        }).setOrigin(0.5));
      }
      this.root.add(breathGroup);
      this.addEnemyBreathing(breathGroup, enemy, s);
      this.applyEnemyMotionCue(poseGroup, enemy, s);
      // Elite crest, clear above the intent badge so the tougher tier reads at a glance.
      if (elite) {
        this.root.add(this.add.text(x, y - 140 * s, '✦ ELITE', {
          fontFamily: UI_FONT, fontSize: `${Math.round(13 * s)}px`, fontStyle: UI_BOLD,
          color: '#ffd76a', stroke: '#241433', strokeThickness: 3
        }).setOrigin(0.5));
      }
      // HP bar (track + proportional fill) behind the name/HP label.
      const hp = this.enemyHpBar(enemy);
      const ebFrac = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
      this.root.add(this.add.rectangle(hp.x, hp.y, hp.w, hp.h, 0x140d0d, 0.92)
        .setStrokeStyle(selected ? 3 : elite || boss ? 2 : 1, selected || elite || boss ? frameColor : 0x000000, selected || elite || boss ? 0.95 : 0.55));
      this.root.add(this.add.rectangle(
        hp.x - hp.w / 2 + (hp.w * ebFrac) / 2,
        hp.y,
        Math.max(2, hp.w * ebFrac),
        hp.h - 6,
        ebFrac > 0.34 ? 0xb23b33 : 0xff5247,
        0.95,
      ));
      this.root.add(this.add.text(hp.x, hp.y, `${enemy.name.replace(/^The\s+/, '')}  ${enemy.hp}/${enemy.maxHp}`, {
        fontFamily: UI_FONT,
        fontSize: `${Math.round((boss ? 15 : 18) * s)}px`,
        fontStyle: UI_BOLD,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5));

      // Intent badge: a colored ring you can read in under two seconds — the
      // number is incoming damage, the ring color is danger (next-level §2.2-2.3).
      const dmg = this.incomingAttackDamage(enemy);
      const bracePressure = intentCoverValue(move);
      const isBrace = dmg === 0 && bracePressure > 0;
      const hasDebuff = move.effects.some((effect) => /applyWinded|applyOpenSky|applyPoison|applyFrail|addSnag/.test(effect));
      const hasSupport = move.effects.some((effect) => /healAlly|healAllEnemies|gainCoverAlly|gainCoverAllEnemies|nextAttackBonusAlly/.test(effect));
      const intentIcon: UiIconId = dmg > 0 ? 'release-card' : isBrace ? 'cover-shield' : hasSupport ? 'flock-heart' : 'resonance-battery';
      const ringColor = dmg > 0
        ? (dmg <= 6 ? 0xf5d38a : dmg <= 10 ? 0xff9d4d : 0xff5247)
        : isBrace ? 0xffcf7a : hasSupport ? 0x8fd6a0 : 0xc98bff;
      const badgeValue = dmg > 0 ? `${dmg}` : isBrace ? `+${bracePressure}` : hasSupport ? '+' : '!';
      const bossEnemy = this.enemies.length > 1
        ? this.enemies.find((candidate) => candidate.runtime.type === 'boss')
        : undefined;
      const bossX = bossEnemy ? this.enemyView(bossEnemy).x : ENEMY_FX_X;
      const intentSide = boss
        ? -1
        : bossEnemy && x < bossX
          ? -1
          : x > GAME_WIDTH - 210 * s ? -1 : 1;
      const bx = x + intentSide * (hp.w / 2 + 38 * s);
      const by = hp.y;
      const badge = this.add.circle(bx, by, 24 * s, 0x10171f, 0.96)
        .setStrokeStyle(dmg >= 11 ? 5 : 3, ringColor, 1);
      this.attachTooltip(
        badge,
        move.label,
        dmg > 0
          ? `Incoming attack: ${dmg} damage${hasDebuff ? ' plus a debuff' : ''}.`
          : isBrace
            ? `Enemy winds up: next attack gains +${bracePressure} damage.`
            : 'Applies pressure — a debuff or special move.'
      );
      this.root.add(badge);
      this.root.add(this.add.text(bx, by, badgeValue, {
        fontFamily: UI_FONT, fontSize: `${Math.round(21 * s)}px`, fontStyle: UI_BOLD, color: '#ffffff'
      }).setOrigin(0.5));
      const intentMark = addUiIconImage(this, intentIcon, bx, by + 32 * s, Math.round(13 * s));
      if (intentMark) this.root.add(intentMark.setAlpha(0.92));
      if (hasDebuff && dmg > 0) {
        this.root.add(this.add.circle(bx + 20 * s, by - 17 * s, 7 * s, 0xc98bff, 1));
        this.root.add(this.add.text(bx + 20 * s, by - 17 * s, '!', {
          fontFamily: UI_FONT, fontSize: `${Math.round(12 * s)}px`, fontStyle: UI_BOLD, color: '#170f1e'
        }).setOrigin(0.5));
      }
      if (enemy.block > 0 || enemy.weak > 0) {
        this.root.add(this.add.text(x, y + 95 * s, enemyStatus(enemy), {
          fontFamily: UI_FONT,
          fontSize: `${Math.round(15 * s)}px`,
          color: UI_SOFT
        }).setOrigin(0.5));
      }
    }
  }

  private currentFlockLeaderArtAsset(): { key: string; url: string } | undefined {
    return flockLeaderArtAssets[this.runLeaderId ?? defaultLeaderId];
  }

  private renderFlockLeader() {
    const leader = getLeader(this.runLeaderId);
    const artAsset = this.currentFlockLeaderArtAsset();
    const hasLeaderArt = Boolean(artAsset && this.textures.exists(artAsset.key));
    const fstate = this.flockState();
    const stateAccent = fstate === 'surging' ? 0x8df4ff : fstate === 'scattered' ? 0xff9d6b : 0xd8a840;
    const breathGroup = this.add.container(FLOCK_ART_X, FLOCK_ART_Y);
    const group = this.add.container(0, 0);
    breathGroup.add(group);

    group.add(this.add.ellipse(0, 126, 172, 26, 0x020409, 0.42));

    if (hasLeaderArt && artAsset) {
      const source = this.textures.get(artAsset.key).getSourceImage() as HTMLImageElement;
      const fit = Math.min(230 / source.width, 288 / source.height);
      group.add(this.add.image(0, -18, artAsset.key).setScale(fit).setAlpha(0.99));
    } else {
      group.add(this.add.ellipse(0, -18, 142, 118, 0x6f4b35, 0.96).setStrokeStyle(3, stateAccent, 0.9));
      group.add(this.add.triangle(52, -26, 0, 0, 28, 7, 0, 16, 0x1b1110, 1));
      group.add(this.add.text(0, -18, 'FF', {
        fontFamily: UI_FONT,
        fontSize: '28px',
        fontStyle: UI_BOLD,
        color: UI_GOLD,
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5));
    }

    const hitbox = this.add.rectangle(0, -18, 250, 300, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    hitbox.on('pointerdown', () => this.openOverlay('flock'));
    hitbox.on('pointerover', () => {
      hitbox.setStrokeStyle(2, stateAccent, 0.7);
    });
    hitbox.on('pointerout', () => {
      hitbox.setStrokeStyle();
    });
    this.attachTooltip(hitbox, leader.name, `${leader.bird} leader. ${this.leaderSignatureLabel()} Click for Flock Stats.`);
    group.add(hitbox);

    this.root.add(breathGroup);
    this.applyFlockMotionCue(group);

    if (!prefersReducedMotion()) {
      this.tweens.add({
        targets: breathGroup,
        y: FLOCK_ART_Y - 4,
        scaleX: 0.994,
        scaleY: 1.012,
        duration: 1700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // Single compact top status bar: the flock's Cohesion + formation + suit
  // keystones, plus the run resources and map info — so the whole left-mid board
  // is free for the fight and the hand.
  private renderCombatStatusRail() {
    const fstate = this.flockState();
    const stateAccent = fstate === 'surging' ? 0x8df4ff : fstate === 'scattered' ? 0xff9d6b : 0xd8a840;
    const highlight = this.flock.molt || fstate !== 'holding';
    const stroke = this.flock.molt ? 0xc56cff : highlight ? stateAccent : 0x2a3a4d;
    const rowY = 116;
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, rowY, GAME_WIDTH - 64, 34, 0x070b12, 0.62)
      .setStrokeStyle(1, stroke, highlight ? 0.78 : 0.26));

    const stateLabel = fstate === 'surging' ? 'SURGING' : fstate === 'scattered' ? 'SCATTERED' : 'HOLDING';
    const left = 78;
    this.root.add(this.add.text(left, rowY, stateLabel, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: fstate === 'surging' ? '#8df4ff' : fstate === 'scattered' ? '#ff9d6b' : '#ffe1a3'
    }).setOrigin(0, 0.5));
    const flowX0 = left + 94;
    for (let i = 0; i < this.flock.flowMax; i += 1) {
      this.root.add(this.add.circle(flowX0 + i * 15, rowY, 5, i < this.flock.flow ? stateAccent : 0x26333f, i < this.flock.flow ? 1 : 0.85)
        .setStrokeStyle(1, 0x0a1410, 0.6));
    }
    this.root.add(this.add.text(flowX0 + this.flock.flowMax * 15 + 6, rowY, 'Flow', {
      fontFamily: UI_FONT,
      fontSize: '10px',
      color: '#7f93a6'
    }).setOrigin(0, 0.5));

    const coverX = 336;
    const cover = this.flock.block;
    this.root.add(this.add.rectangle(coverX, rowY, 92, 24, 0x10202c, cover > 0 ? 0.97 : 0.5)
      .setStrokeStyle(1.5, cover > 0 ? 0x7ab8d6 : 0x2a3a4d, cover > 0 ? 1 : 0.6));
    this.root.add(this.add.text(coverX, rowY, `${cover} Cover`, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: cover > 0 ? '#9fdcf0' : '#5f7488'
    }).setOrigin(0.5));
    let stx = coverX + 58;
    for (const entry of flockStatusEntries(this.flock)) {
      const t = this.add.text(stx, rowY, entry.label, {
        fontFamily: UI_FONT,
        fontSize: '12px',
        fontStyle: UI_BOLD,
        color: entry.kind === 'debuff' ? '#ff9d4d' : '#8fd6a0'
      }).setOrigin(0, 0.5);
      this.attachTooltip(t, entry.label, STATUS_TOOLTIPS[entry.id] ?? 'A status affecting the flock.');
      this.root.add(t);
      stx += entry.label.length * 7 + 18;
    }

    const suitMeta: Array<[string, string, string]> = [['plumes', 'Plumes', '#ffcf6b'], ['quills', 'Quills', '#c9a6ff'], ['basins', 'Basins', '#6fd0e6'], ['nests', 'Nests', '#8fd6a0']];
    const suitCounts = this.flockSuitCounts();
    let chipX = 560;
    for (const [suit, label, hex] of suitMeta) {
      const n = suitCounts[suit] ?? 0;
      const on = n >= KEYSTONE_AT;
      const txt = this.add.text(chipX, rowY, `${on ? '*' : ''}${label} ${n}`, {
        fontFamily: UI_FONT,
        fontSize: on ? '12px' : '11px',
        fontStyle: on ? 'bold' : 'normal',
        color: on ? hex : '#74879a'
      }).setOrigin(0, 0.5);
      this.root.add(txt);
      chipX += txt.width + 14;
    }

    this.renderChip(1030, rowY, 118, 'Resonance', `${this.spark}/5`, 0x8df4ff, 'Plumes tempo resource.');
    this.root.add(this.add.text(1244, rowY, `Beat ${this.turn}`, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: '#f5d38a'
    }).setOrigin(1, 0.5));
  }

  private renderTopBar() {
    const combatNode = currentCombatNodes()[this.currentRouteIndex];
    const fullDeckSize = this.allDeckCards().length;
    const hudObjects: Phaser.GameObjects.GameObject[] = [];
    renderUnifiedRunHud(this, (obj) => hudObjects.push(obj), {
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
      cover: this.flock.block,
      wingbeats: `${this.energy}/${3 + this.nextTurnEnergyBonus}`,
      resonance: `${this.spark}/5`,
      onWaymarks: () => {
        const nextOpen = !this.waymarkDrawerOpen;
        this.waymarkDrawerOpen = nextOpen;
        if (nextOpen) this.waymarkDrawerScroll = 0;
        this.inspectOverlay = undefined;
        this.supplyDrawerOpen = false;
        this.renderAll();
      },
      onSupplies: () => {
        const nextOpen = !this.supplyDrawerOpen;
        this.supplyDrawerOpen = nextOpen;
        this.inspectOverlay = undefined;
        this.waymarkDrawerOpen = false;
        this.renderAll();
      },
      onDeck: () => {
        this.openOverlay('deck');
      }
    });
    this.root.add(hudObjects);
    return;
    const fstate = this.flockState();
    const stateAccent = fstate === 'surging' ? 0x8df4ff : fstate === 'scattered' ? 0xff9d6b : 0xd8a840;
    const highlight = this.flock.molt || fstate !== 'holding';
    const stroke = this.flock.molt ? 0xc56cff : highlight ? stateAccent : 0x2a3a4d;
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, 52, GAME_WIDTH - 28, 76, 0x070b12, 0.78)
      .setStrokeStyle(1, stroke, highlight ? 0.78 : 0.26));
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, 16, GAME_WIDTH - 62, 2, stroke, highlight ? 0.82 : 0.32));
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, 88, GAME_WIDTH - 62, 1, 0xffffff, 0.08));

    const row2 = 74;
    const left = FLOCK_HP_BAR.x - FLOCK_HP_BAR.w / 2;

    // Cohesion bar (click → full Flock Stats overlay).
    const fbFrac = Math.max(0, Math.min(1, this.flock.hp / this.flock.maxHp));
    const incoming = this.incomingFlockDamagePreview();
    const barBg = this.add.rectangle(FLOCK_HP_BAR.x, FLOCK_HP_BAR.y, FLOCK_HP_BAR.w, FLOCK_HP_BAR.h, 0x0e1a12, 0.95)
      .setStrokeStyle(1, 0x000000, 0.5).setInteractive({ useHandCursor: true });
    barBg.on('pointerdown', () => this.openOverlay('flock'));
    this.attachTooltip(barBg, 'Cohesion', 'Flock survival — reach 0 and the run ends. Click for full Flock Stats.');
    this.root.add(barBg);
    this.root.add(this.add.rectangle(left + (FLOCK_HP_BAR.w * fbFrac) / 2, FLOCK_HP_BAR.y, Math.max(2, FLOCK_HP_BAR.w * fbFrac), FLOCK_HP_BAR.h - 6, fbFrac > 0.34 ? 0x4fa777 : 0xe2b24a, 0.95));
    if (incoming.hpLoss > 0) {
      const afterFrac = Math.max(0, Math.min(1, incoming.afterHp / this.flock.maxHp));
      const currentX = left + FLOCK_HP_BAR.w * fbFrac;
      const afterX = left + FLOCK_HP_BAR.w * afterFrac;
      const riskW = Math.max(2, currentX - afterX);
      this.root.add(this.add.rectangle(afterX + riskW / 2, FLOCK_HP_BAR.y, riskW, FLOCK_HP_BAR.h - 6, 0xff5247, 0.82));
      this.root.add(this.add.rectangle(afterX, FLOCK_HP_BAR.y, 2, FLOCK_HP_BAR.h + 4, 0xffd0c9, 0.9));
      this.root.add(this.add.text(Math.min(left + FLOCK_HP_BAR.w - 6, currentX - 4), FLOCK_HP_BAR.y + 19, `-${incoming.hpLoss} / After ${incoming.afterHp}`, {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: '#ffd0c9',
        stroke: '#180807',
        strokeThickness: 2,
      }).setOrigin(1, 0.5));
    }
    this.root.add(this.add.text(FLOCK_HP_BAR.x, FLOCK_HP_BAR.y, `Cohesion  ${this.flock.hp}/${this.flock.maxHp}`, { fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: '#eaf6ee', stroke: '#0a1410', strokeThickness: 3 }).setOrigin(0.5));

    // Formation badge + Flow pips (row 2, under the bar).
    const stateLabel = fstate === 'surging' ? 'SURGING' : fstate === 'scattered' ? 'SCATTERED' : 'HOLDING';
    this.root.add(this.add.text(left, row2, stateLabel, { fontFamily: UI_FONT, fontSize: '12px', fontStyle: UI_BOLD, color: fstate === 'surging' ? '#8df4ff' : fstate === 'scattered' ? '#ff9d6b' : '#ffe1a3' }).setOrigin(0, 0.5));
    const flowX0 = left + 94;
    for (let i = 0; i < this.flock.flowMax; i += 1) {
      this.root.add(this.add.circle(flowX0 + i * 15, row2, 5, i < this.flock.flow ? stateAccent : 0x26333f, i < this.flock.flow ? 1 : 0.85).setStrokeStyle(1, 0x0a1410, 0.6));
    }
    this.root.add(this.add.text(flowX0 + this.flock.flowMax * 15 + 6, row2, 'Flow', { fontFamily: UI_FONT, fontSize: '10px', color: '#7f93a6' }).setOrigin(0, 0.5));

    // Cover badge + statuses (row 1, right of the bar).
    const coverX = left + FLOCK_HP_BAR.w + 70;
    const cover = this.flock.block;
    this.root.add(this.add.rectangle(coverX, FLOCK_HP_BAR.y, 92, 28, 0x10202c, cover > 0 ? 0.97 : 0.5).setStrokeStyle(2, cover > 0 ? 0x7ab8d6 : 0x2a3a4d, cover > 0 ? 1 : 0.6));
    this.root.add(this.add.text(coverX, FLOCK_HP_BAR.y, `◈ ${cover} Cover`, { fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: cover > 0 ? '#9fdcf0' : '#5f7488' }).setOrigin(0.5));
    let stx = coverX + 58;
    for (const entry of flockStatusEntries(this.flock)) {
      const t = this.add.text(stx, FLOCK_HP_BAR.y, entry.label, { fontFamily: UI_FONT, fontSize: '12px', fontStyle: UI_BOLD, color: entry.kind === 'debuff' ? '#ff9d4d' : '#8fd6a0' }).setOrigin(0, 0.5);
      this.attachTooltip(t, entry.label, STATUS_TOOLTIPS[entry.id] ?? 'A status affecting the flock.');
      this.root.add(t);
      stx += entry.label.length * 7 + 18;
    }

    // Suit keystone tally (row 2).
    const suitMeta: Array<[string, string, string]> = [['plumes', 'Plumes', '#ffcf6b'], ['quills', 'Quills', '#c9a6ff'], ['basins', 'Basins', '#6fd0e6'], ['nests', 'Nests', '#8fd6a0']];
    const suitCounts = this.flockSuitCounts();
    let chipX = coverX - 26;
    for (const [suit, label, hex] of suitMeta) {
      const n = suitCounts[suit] ?? 0;
      const on = n >= KEYSTONE_AT;
      const txt = this.add.text(chipX, row2, `${on ? '★' : ''}${label} ${n}`, { fontFamily: UI_FONT, fontSize: on ? '12px' : '11px', fontStyle: on ? 'bold' : 'normal', color: on ? hex : '#74879a' }).setOrigin(0, 0.5);
      this.root.add(txt);
      chipX += txt.width + 14;
    }

    // Run resources (row 1, mid-right).
    this.renderChip(792, FLOCK_HP_BAR.y + 1, 118, 'Resonance', `${this.spark}/5`, 0x8df4ff, 'Plumes tempo resource, capped at 5.');
    this.renderChip(916, FLOCK_HP_BAR.y + 1, 96, 'Scrap', `${this.scrap}`, 0x8df4ff, 'Currency for Markets and services.');
    this.renderChip(1024, FLOCK_HP_BAR.y + 1, 120, 'Waymarks', `${this.routeMarks.length}`, 0xc9a6ff, 'Click to inspect found artifact items.', () => {
      this.waymarkDrawerOpen = !this.waymarkDrawerOpen;
      this.inspectOverlay = undefined;
      this.renderAll();
    });

    // Map info (far right).
    const routeNode = currentCombatNodes()[this.currentRouteIndex];
    this.root.add(this.add.text(1262, 36, `Rooftop ${this.encounter}/${this.maxEncounters} · Beat ${this.turn}`, { fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: '#f5d38a' }).setOrigin(1, 0.5));
    this.root.add(this.add.text(1262, 58, `${currentMap().name}: ${routeNode.label}`, { fontFamily: UI_FONT, fontSize: '12px', color: UI_SOFT }).setOrigin(1, 0.5));
  }


  private renderChip(cx: number, cy: number, width: number, label: string, value: string, accent: number, tip?: string, onClick?: () => void) {
    const rect = renderHudMetricChip(this, (obj) => this.root.add(obj), cx, cy, width, label, value, accent);
    if (onClick) {
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerdown', onClick);
    }
    if (tip) this.attachTooltip(rect, label, tip);
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
    const width = 224;
    const clampedX = Math.max(width / 2 + 8, Math.min(GAME_WIDTH - width / 2 - 8, x));
    const top = y + 30;
    const container = this.add.container(0, 0);
    const titleText = this.add.text(clampedX - width / 2 + 12, top + 8, title, {
      fontFamily: UI_FONT, fontSize: '12px', fontStyle: UI_BOLD, color: UI_GOLD
    });
    const bodyText = this.add.text(clampedX - width / 2 + 12, top + 26, body, {
      fontFamily: UI_FONT, fontSize: '11px', color: UI_BODY, wordWrap: { width: width - 24 }
    });
    // Size the panel to its content so longer flavor text is not clipped.
    const height = 34 + bodyText.height + 10;
    const bg = this.add.rectangle(clampedX, top + height / 2, width, height, 0x05161f, 0.98)
      .setStrokeStyle(1, 0x7ab8d6, 0.95);
    container.add(bg);
    container.add(titleText);
    container.add(bodyText);
    this.root.add(container);
    return container;
  }

  // Compact combat controls live near the piles; permanent text stays out of
  // the playfield so the hand and enemy stage carry the player's attention.
  private renderCommandStrip() {
    // Roost / End Turn — lower-right, above the discard pile.
    const bx = 1192;
    const by = 470;
    const endTurnHit = this.add.rectangle(bx, by, 104, 104, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    endTurnHit.on('pointerdown', () => this.endTurn());
    this.attachTooltip(endTurnHit, 'End Turn', 'Roost and let enemies act.');
    this.root.add(endTurnHit);
    const roostIconSize = 74;
    const roostIcon = addUiIconImage(this, 'roost-nest', bx, by, roostIconSize / UI_ICON_PREVIEW_SCALE);
    if (roostIcon) {
      const lockRoostIconSize = () => roostIcon.setDisplaySize(roostIconSize, roostIconSize);
      lockRoostIconSize();
      roostIcon.setAlpha(0.95);
      endTurnHit.on('pointerover', () => lockRoostIconSize().setAlpha(1));
      endTurnHit.on('pointerout', () => lockRoostIconSize().setAlpha(0.95));
      this.root.add(roostIcon);
    }
  }

  // Draw and discard render as real stacks of card-backs in the bottom corners.
  private renderPiles() {
    this.renderPile(this.drawPilePos(), this.drawPile.length, 'DRAW', 0x24d0d6, () => this.openOverlay('draw'));
    this.renderPile(this.discardPilePos(), this.discardPile.length, 'DISCARD', 0xd8a840, () => this.openOverlay('discard'));
  }

  private renderPile(pos: { x: number; y: number }, count: number, label: string, accent: number, onClick: () => void) {
    const { x, y } = pos;
    const has = count > 0;
    const hit = this.add.rectangle(x, y, 104, 132, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', onClick);
    this.attachTooltip(
      hit,
      label === 'DRAW' ? 'Draw Pile' : 'Discard Pile',
      label === 'DRAW' ? 'Cards left to draw. Click to inspect them.' : 'Cards already discarded. Click to inspect them.'
    );
    this.root.add(hit);
    const iconId: UiIconId = label === 'DRAW' ? 'draw-stack' : 'discard-basket';
    const pileIcon = addUiIconImage(this, iconId, x, y - 16, 58);
    if (pileIcon) {
      pileIcon.setAlpha(has ? 0.95 : 0.36);
      this.root.add(pileIcon);
    }
    // Count badge.
    const countY = y + 64;
    this.root.add(this.add.circle(x, countY, 18, 0x07101c, 1).setStrokeStyle(2, accent, 1));
    this.root.add(this.add.text(x, countY, `${count}`, { fontFamily: UI_FONT, fontSize: '18px', fontStyle: UI_BOLD, color: '#ffffff' }).setOrigin(0.5));
  }

  private renderHand() {
    this.hideCardPreview(); // a redraw destroys the hovered rect; drop its stale preview
    hideKwTooltip();
    this.handCardRects.clear();
    const n = this.hand.length;
    if (n === 0) return;

    this.hand.forEach((card, index) => {
      const x = this.handCardLeft(index, n);
      this.renderHandCard(card, x);
    });
  }

  private activeCardContract(card: Card): ActiveCardContract {
    return activeCardContract(card, this.flock.molt);
  }

  private handCardLeft(index: number, handSize = this.hand.length) {
    const minLeft = 142;
    const maxRight = 1140;
    const avail = maxRight - minLeft;
    const spacing = handSize > 1 ? Math.min(CARD_W + 12, (avail - CARD_W) / (handSize - 1)) : 0;
    const totalW = (handSize - 1) * spacing + CARD_W;
    const startX = minLeft + Math.max(0, (avail - totalW) / 2);
    return Math.round(startX + index * spacing);
  }

  private renderHandCard(card: Card, x: number) {
    const cx = x + CARD_W / 2;
    const top = HAND_Y - CARD_H / 2;
    const bottom = HAND_Y + CARD_H / 2;
    const selected = this.selectedInstanceId === card.instanceId;
    const canPay = this.effectiveCost(card) <= this.energy;
    const accent = card.type === 'major' ? 0xd8a840 : card.type === 'molt' ? 0xc56cff : suitAccentColor(card);
    const contract = this.activeCardContract(card);

    const rect = this.add.rectangle(cx, HAND_Y, CARD_W, CARD_H, 0x0a0f18, 1)
      .setStrokeStyle(selected ? 5 : 2, selected ? 0x24d0d6 : accent, 1)
      .setInteractive({ useHandCursor: canPay && this.mode === 'battle' });
    rect.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event?: Phaser.Types.Input.EventData) => {
      event?.stopPropagation();
      this.onCardClicked(card.instanceId);
    });
    this.root.add(rect);
    this.handCardRects.set(card.instanceId, rect);

    // Full card illustration shown at its true 2:3 aspect (no stretching).
    const key = compactCardArtKey(card);
    if (key && this.textures.exists(key)) {
      this.root.add(this.add.image(cx, HAND_Y, key).setDisplaySize(CARD_W - 4, CARD_H - 4).setAlpha(canPay ? 1 : 0.55));
    } else if (!renderSnagCardBorder(this, (obj) => this.root.add(obj), card, cx, HAND_Y, CARD_W - 4, CARD_H - 4, canPay ? 1 : 0.55)) {
      this.root.add(this.add.rectangle(cx, HAND_Y, CARD_W - 4, CARD_H - 4, 0x141d2b, 0.92));
    } else {
      this.root.add(this.add.rectangle(cx, HAND_Y, CARD_W - 4, CARD_H - 4, 0x05101a, 0.12));
    }

    // Name banner (top) over a scrim so it reads against the art.
    this.root.add(this.add.rectangle(cx, top + 16, CARD_W - 4, 26, 0x05080e, 0.66));
    this.root.add(this.add.text(x + 34, top + 8, displayName(card), {
      fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: canPay ? '#ffe7b0' : '#9aa7b6', wordWrap: { width: CARD_W - 44 }
    }));
    if (contract.usesMolt) {
      this.root.add(this.add.rectangle(x + CARD_W - 43, top + 16, 70, 18, 0x2a1208, 0.88).setStrokeStyle(1, 0xff9d4d, 0.78));
      this.root.add(this.add.text(x + CARD_W - 43, top + 9, 'MOLT', {
        fontFamily: UI_FONT, fontSize: '10px', fontStyle: UI_BOLD, color: '#ffc78f', align: 'center'
      }).setOrigin(0.5, 0));
    }

    // Cost badge (top-left).
    this.root.add(this.add.circle(x + 16, top + 16, 14, this.effectiveCost(card) === 0 ? 0x24d0d6 : 0xe8b830, 1).setStrokeStyle(2, 0x05080e, 0.9));
    this.root.add(this.add.text(x + 16, top + 16, `${this.effectiveCost(card)}`, {
      fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: '#06101c'
    }).setOrigin(0.5));

    // Effect text in a translucent panel over the lower third (readable in-hand,
    // art stays undistorted above it).
    const panelH = 72;
    this.root.add(this.add.rectangle(cx, bottom - panelH / 2 - 3, CARD_W - 6, panelH, 0x05080e, 0.82));
    this.root.add(this.add.rectangle(cx, bottom - panelH - 3, CARD_W - 6, 2, accent, 0.85));
    // Mechanical keywords are highlighted in their color (hover one for its meaning).
    renderRichText(this, this.root, cx, bottom - panelH + 8, compactCardEffectSummary(contract.effects), {
      wrap: CARD_W - 16, fontSize: 12, align: 'center', lineSpacing: 3, tooltips: this.mode === 'battle',
    });

    // Hovering a hand card shows a big floating preview (art + full info).
    rect.on('pointerover', () => this.showCardPreview(card));
    rect.on('pointerout', () => this.hideCardPreview());
  }

  private refreshHandCardSelection() {
    this.hand.forEach((card) => {
      const rect = this.handCardRects.get(card.instanceId);
      if (!rect?.scene) return;
      const selected = this.selectedInstanceId === card.instanceId;
      const accent = card.type === 'major' ? 0xd8a840 : card.type === 'molt' ? 0xc56cff : suitAccentColor(card);
      rect.setStrokeStyle(selected ? 5 : 2, selected ? 0x24d0d6 : accent, 1);
    });
  }

  private hideCardPreview() {
    this.cardPreview?.destroy(true);
    this.cardPreview = undefined;
  }

  // A large, readable floating preview of a hand card: big 2:3 art + name + cost
  // + effect text + the Flock Stats it grants. Lives in fxLayer so it survives a
  // redraw and overlays the board above the hand.
  private showCardPreview(card: Card) {
    this.hideCardPreview();
    const contract = this.activeCardContract(card);
    const w = 300;
    const h = Math.round(w * 1.5);
    const cx = GAME_WIDTH / 2;
    const cy = Math.max(h / 2 + 8, HAND_Y - CARD_H / 2 - h / 2 - 2);
    const accent = card.type === 'major' ? 0xd8a840 : card.type === 'molt' ? 0xc56cff : suitAccentColor(card);
    const top = cy - h / 2;
    const bottom = cy + h / 2;
    const c = this.add.container(0, 0);

    c.add(this.add.rectangle(cx, cy, w + 8, h + 8, 0x06090f, 0.99).setStrokeStyle(3, accent, 1));
    const key = loadedCardArtKey(this, card);
    if (key && this.textures.exists(key)) c.add(this.add.image(cx, cy, key).setDisplaySize(w, h));
    else if (!renderSnagCardBorder(this, (obj) => c.add(obj), card, cx, cy, w, h)) c.add(this.add.rectangle(cx, cy, w, h, 0x141d2b, 0.95));
    else c.add(this.add.rectangle(cx, cy, w, h, 0x05101a, 0.12));

    // Name banner + cost.
    c.add(this.add.rectangle(cx, top + 22, w - 4, 40, 0x05080e, 0.72));
    c.add(this.add.text(cx - w / 2 + 52, top + 9, displayName(card), { fontFamily: UI_FONT, fontSize: '21px', fontStyle: UI_BOLD, color: '#ffe7b0', wordWrap: { width: w - 72 } }));
    c.add(this.add.circle(cx - w / 2 + 26, top + 24, 20, this.effectiveCost(card) === 0 ? 0x24d0d6 : 0xe8b830, 1).setStrokeStyle(2, 0x05080e, 0.9));
    c.add(this.add.text(cx - w / 2 + 26, top + 24, `${this.effectiveCost(card)}`, { fontFamily: UI_FONT, fontSize: '23px', fontStyle: UI_BOLD, color: '#06101c' }).setOrigin(0.5));

    // Info panel (effect + Molt ability + Flock Stats) over the lower portion.
    const panelH = card.moltText ? 152 : 118;
    c.add(this.add.rectangle(cx, bottom - panelH / 2 - 4, w - 4, panelH, 0x05080e, 0.92));
    c.add(this.add.rectangle(cx, bottom - panelH - 4, w - 4, 2, accent, 0.85));
    let py = bottom - panelH + 6;
    if (contract.usesMolt) {
      c.add(this.add.text(cx, py, 'MOLT ACTIVE', {
        fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: '#ffc78f'
      }).setOrigin(0.5, 0));
      py += 14;
    }
    py += renderRichText(this, c, cx, py, contract.text, { wrap: w - 24, fontSize: 15, align: 'center', lineSpacing: 2 }) + 6;
    if (contract.usesMolt) {
      renderRichText(this, c, cx, py, `NORMAL: ${displayText(card)}`, { wrap: w - 24, fontSize: 12, align: 'center', baseColor: '#b9c7d6', bold: true, lineSpacing: 2 });
    } else if (card.moltText) {
      renderRichText(this, c, cx, py, `MOLT: ${card.moltText}`, { wrap: w - 24, fontSize: 12, align: 'center', baseColor: '#ff9d4d', bold: true, lineSpacing: 2 });
    }
    const statLabels: Record<string, string> = {
      cohesion: 'Cohesion', damage: 'Damage', cover: 'Cover', draw: 'Hand', resonance: 'Res/turn', regen: 'Regen', moltPower: 'Molt', openSkyGuard: 'Sky Guard',
    };
    const statStr = Object.entries(card.runtime.flockStats).map(([k, v]) => `${statLabels[k] ?? k} +${v}`).join('   ·   ') || 'No Flock Stats';
    c.add(this.add.text(cx, bottom - 12, statStr, { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: UI_CYAN, align: 'center', wordWrap: { width: w - 20 } }).setOrigin(0.5, 1));

    this.fxLayer.add(c);
    this.cardPreview = c;
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
    const x = 300;
    const y = 162;
    const icon = addUiIconImage(this, 'supply-pouch', x - 110, y - 16, 26)?.setAlpha(0.84);
    if (icon) this.root.add(icon);
    this.root.add(this.add.rectangle(x, y, 252, 50, 0x07101c, 0.86)
      .setStrokeStyle(1, 0xffb86b, 0.72));
    this.root.add(this.add.text(x - 82, y - 19, latest.name, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      fixedWidth: 192,
      maxLines: 1
    }).setResolution(2));
    this.root.add(this.add.text(x - 82, y - 2, latest.summary, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      color: UI_BODY,
      fixedWidth: 192,
      maxLines: 2
    }).setResolution(2));
  }

  private renderSupplyMenuIcon(supply: RuntimeSupply, x: number, y: number, size: number, usable: boolean) {
    const accent = supplyAccent(supply);
    const artAsset = supplyArtAssets[supply.id];
    this.root.add(this.add.rectangle(x, y, size, size, 0x07101c, usable ? 0.97 : 0.72)
      .setStrokeStyle(2, usable ? accent : 0x49606d, usable ? 0.95 : 0.62));
    if (artAsset && this.textures.exists(artAsset.key)) {
      this.root.add(addSupplyArtImage(this, x, y, artAsset.key).setDisplaySize(size - 8, size - 8).setAlpha(usable ? 1 : 0.58));
      return;
    }
    this.root.add(this.add.text(x, y - 1, this.supplyGlyph(supply), {
      fontFamily: UI_FONT,
      fontSize: `${Math.round(size * 0.44)}px`,
      fontStyle: UI_BOLD,
      color: usable ? '#ffe7c9' : '#7f93a8'
    }).setOrigin(0.5));
  }

  private renderSupplyDrawer() {
    const capacity = this.runSupplyCapacity;
    const supplies = Array.from({ length: capacity }, (_entry, index) => this.runSupplies[index]);
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.76)
      .setInteractive({ useHandCursor: false }));
    const frame = renderFieldPanel(this, (obj) => this.root.add(obj), HUD_MENU_PANEL.cx, HUD_MENU_PANEL.cy, HUD_MENU_PANEL.w, HUD_MENU_PANEL.h, {
      eyebrow: 'Run Kit',
      title: 'Packed Supplies',
      subtitle: `${this.runSupplies.length}/${capacity} supply slot${capacity === 1 ? '' : 's'} filled`,
      accent: 0xffb86b
    });
    addUiIconImage(this, 'supply-pouch', frame.left + HUD_MENU_PANEL.headerIconX, frame.top + HUD_MENU_PANEL.headerIconY, 28)?.setAlpha(0.92);
    renderCloseControl(this, (obj) => this.root.add(obj), frame.right - HUD_MENU_PANEL.closeX, frame.top + HUD_MENU_PANEL.closeY, () => {
      this.supplyDrawerOpen = false;
      this.renderAll();
    });

    if (capacity === 0) {
      const icon = addUiIconImage(this, 'supply-pouch', frame.left + 88, frame.top + 160, 34);
      if (icon) this.root.add(icon.setAlpha(0.32));
      this.root.add(this.add.text(frame.left + 126, frame.top + 150, '0 slots', {
        fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: UI_MUTED, wordWrap: { width: frame.w - 108 }
      }));
      return;
    }

    const columns = 3;
    const tileW = 252;
    const tileH = 104;
    const startX = frame.left + 64;
    const startY = frame.top + 128;
    supplies.forEach((supplyId, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + col * 272;
      const y = startY + row * 112;
      const supply = supplyId ? alphaSupplyLibrary.get(supplyId) : undefined;
      if (!supply) {
        this.root.add(this.add.rectangle(x + tileW / 2, y + tileH / 2, tileW, tileH, 0x07101c, 0.42)
          .setStrokeStyle(1.2, 0x263b52, 0.56));
        const icon = addUiIconImage(this, 'supply-pouch', x + tileW / 2, y + tileH / 2, 25);
        if (icon) this.root.add(icon.setAlpha(0.2));
        return;
      }
      const usable = this.mode === 'battle' && supply.timing !== 'route';
      const bg = renderCompactItemTile(this, (obj) => this.root.add(obj), x, y, tileW, tileH, {
        kind: 'supply',
        id: supply.id,
        glyph: this.supplyGlyph(supply),
        accent: supplyAccent(supply),
        name: supply.name,
        summary: compactEffectGrammar(supply.effects, 72, 2),
        enabled: usable,
        actionLabel: usable ? 'USE' : 'ROUTE'
      });
      if (usable) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => this.useSupply(index));
      }
    });
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

  private waymarkTooltip(mark: RuntimeRouteMark) {
    return `${this.waymarkFamilyLabel(mark)} / ${mark.rarity}\n${mark.description}\n${mark.trigger} -> ${routeMarkEffectGrammar(mark)}${mark.flavorText ? `\n${mark.flavorText}` : ''}`;
  }

  private renderWaymarkIconButton(mark: RuntimeRouteMark, x: number, y: number, size: number, onClick?: () => void) {
    const accent = this.waymarkAccent(mark);
    const artAsset = waymarkArtAssets[mark.id];
    this.root.add(this.add.rectangle(x, y, size, size, 0x07101c, 0.97).setStrokeStyle(2, accent, 0.95));
    if (artAsset && this.textures.exists(artAsset.key)) {
      this.root.add(addWaymarkArtImage(this, x, y, artAsset.key).setDisplaySize(size - 8, size - 8));
    } else {
      this.root.add(this.add.text(x, y - 1, waymarkGlyph(mark), {
        fontFamily: UI_FONT, fontSize: `${Math.round(size * 0.48)}px`, fontStyle: UI_BOLD, color: '#e7eef7'
      }).setOrigin(0.5));
    }
    const hitbox = this.add.rectangle(x, y, size, size, 0x000000, 0.001)
      .setInteractive({ useHandCursor: Boolean(onClick) });
    if (onClick) hitbox.on('pointerdown', onClick);
    this.attachTooltip(hitbox, mark.name, this.waymarkTooltip(mark));
    this.root.add(hitbox);
  }

  private renderWaymarkDrawer() {
    const marks = this.ownedMarkDefs();
    this.queueCurrentWaymarkArtLoad();
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.76)
      .setInteractive({ useHandCursor: false }));
    const frame = renderFieldPanel(this, (obj) => this.root.add(obj), HUD_MENU_PANEL.cx, HUD_MENU_PANEL.cy, HUD_MENU_PANEL.w, HUD_MENU_PANEL.h, {
      eyebrow: 'Route Kit',
      title: 'Found Waymarks',
      subtitle: `${marks.length} artifact item${marks.length === 1 ? '' : 's'} carried this run`,
      accent: UI_FIELD.violet
    });
    addUiIconImage(this, 'waymark-compass', frame.left + HUD_MENU_PANEL.headerIconX, frame.top + HUD_MENU_PANEL.headerIconY, 28)?.setAlpha(0.92);
    renderCloseControl(this, (obj) => this.root.add(obj), frame.right - HUD_MENU_PANEL.closeX, frame.top + HUD_MENU_PANEL.closeY, () => {
      this.waymarkDrawerOpen = false;
      this.renderAll();
    });

    if (marks.length === 0) {
      const icon = addUiIconImage(this, 'waymark-compass', frame.left + 88, frame.top + 160, 34);
      if (icon) this.root.add(icon.setAlpha(0.32));
      this.root.add(this.add.text(frame.left + 126, frame.top + 150, '0 found', {
        fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: UI_MUTED, wordWrap: { width: frame.w - 108 }
      }));
      return;
    }

    const columns = 3;
    const visibleRows = 3;
    const tileW = 252;
    const tileH = 104;
    const startX = frame.left + 64;
    const startY = frame.top + 128;
    const totalRows = Math.ceil(marks.length / columns);
    const maxScrollRows = Math.max(0, totalRows - visibleRows);
    this.waymarkDrawerScroll = clamp(Math.round(this.waymarkDrawerScroll), 0, maxScrollRows);
    const visible = marks.slice(this.waymarkDrawerScroll * columns, (this.waymarkDrawerScroll + visibleRows) * columns);
    visible.forEach((mark, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + col * 272;
      const y = startY + row * 112;
      const bg = renderCompactItemTile(this, (obj) => this.root.add(obj), x, y, tileW, tileH, {
        kind: 'waymark',
        id: mark.id,
        glyph: waymarkGlyph(mark),
        accent: this.waymarkAccent(mark),
        name: mark.name,
        summary: compactEffectGrammar(routeMarkEffects(mark), 72, 2)
      });
      this.attachTooltip(bg, mark.name, this.waymarkTooltip(mark));
    });

    if (maxScrollRows > 0) {
      const trackH = visibleRows * 112 - 8;
      const trackX = frame.right - 38;
      const trackY = startY + trackH / 2;
      const thumbH = Math.max(34, trackH * (visibleRows / totalRows));
      const thumbTravel = trackH - thumbH;
      const thumbY = trackY - trackH / 2 + thumbH / 2 + (this.waymarkDrawerScroll / maxScrollRows) * thumbTravel;
      this.root.add(this.add.rectangle(trackX, trackY, 5, trackH, 0x1a2435, 0.9));
      this.root.add(this.add.rectangle(trackX, thumbY, 8, thumbH, 0xc9a6ff, 0.95));
    }
  }

  private scrollWaymarkDrawer(deltaRows: number) {
    const maxScrollRows = Math.max(0, Math.ceil(this.ownedMarkDefs().length / 3) - 3);
    const next = clamp(this.waymarkDrawerScroll + deltaRows, 0, maxScrollRows);
    if (next === this.waymarkDrawerScroll) return;
    this.waymarkDrawerScroll = next;
    this.renderAll();
  }

  private useSupply(index: number) {
    if (this.mode !== 'battle') return;
    const id = this.runSupplies[index];
    const supply = id ? alphaSupplyLibrary.get(id) : undefined;
    if (!supply || supply.timing === 'route') return;
    const repeats = this.pendingSupplyRepeats > 0 ? 1 + this.pendingSupplyRepeats : 1;
    this.pendingSupplyRepeats = 0;
    for (let i = 0; i < repeats; i += 1) {
    supply.effects.forEach((effect) => this.applySupplyEffect(effect, supply.name));
    }
    this.runSupplies.splice(index, 1);
    this.runSuppliesUsed.push(id);
    this.showSupplyFeedback(supply, repeats);
    this.checkSupplyUsedMarks();
    this.logEvent(`Used ${supply.name}.`);
    this.renderAll();
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
        this.logEvent(`${source} gives ${n} Wingbeat.`);
        break;
      case 'loseCohesion':
        this.flock.hp = Math.max(1, this.flock.hp - n);
        this.logEvent(`${source} costs ${n} Cohesion.`);
        floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 8, `-${n}`, '#ff7a6e');
        break;
      case 'reduceNextOpenSky': case 'gainOpenSkyGuard': this.flock.openSkyGuard += n; break;
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
        floatingText(this, this.fxLayer, view.x, view.y - 84, `-${removed} Cover`, '#8df4ff');
        this.coverImpactFx(view.x, view.y, 0x8df4ff);
        if (hadCover && enemy.block <= 0) this.checkEnemyCoverBrokenMarks();
        break;
      }
      case 'applyWinded': {
        const enemy = target();
        if (!enemy) break;
        enemy.weak += n;
        this.logEvent(`${source} leaves ${enemy.name} Winded.`);
        const view = this.enemyView(enemy);
        floatingText(this, this.fxLayer, view.x, view.y - 70, 'Winded', '#c98bff');
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
        break;
      case 'gainEnergyNextTurn':
        this.nextTurnEnergyBonus += n;
        this.logEvent(`${source} banks +${n} Wingbeat for next turn.`);
        break;
      case 'gainScrap':
        this.scrap += n;
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
          floatingText(this, this.fxLayer, view.x, view.y - 90, 'Resonance Burst!', '#8df4ff');
          this.sparkBurst(view.x, view.y - 22, 0x8df4ff, 30, 210);
        }
        this.spark = 0;
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
        break;
      case 'retainHand':
        this.pendingRetainHand += n;
        this.logEvent(`${source} retains ${n} card${n === 1 ? '' : 's'} for next turn.`);
        break;
      default: break;
    }
  }

  private cleanseFlock(amount: number, source = 'Cleanse') {
    const before = this.flock.weak + this.flock.frail + this.flock.fouled;
    this.flock.weak = Math.max(0, this.flock.weak - amount);
    this.flock.frail = Math.max(0, this.flock.frail - amount);
    this.flock.fouled = Math.max(0, this.flock.fouled - amount);
    const after = this.flock.weak + this.flock.frail + this.flock.fouled;
    const cleared = before - after;
    if (cleared > 0) {
      this.logEvent(`${source} clears ${cleared} pressure.`);
      floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 38, 'Cleanse', '#8fd6a0');
      this.healFx();
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
      moltSafety: rate(count((card) => card.type === 'molt' || has(card, 'molt') || has(card, 'openSky')))
    };
  }

  private cardNeedTags(card: Card): string[] {
    const summary = this.deckNeedSummary();
    const tags: string[] = [];
    const has = (tag: string) => card.runtime.tags.includes(tag);
    if ((card.role === 'attack' || has('attack')) && summary.damage === 'low') tags.push('fills damage');
    if (has('cover') && summary.cover === 'low') tags.push('fills Cover');
    if ((has('heal') || has('regen')) && summary.recovery === 'low') tags.push('fills recovery');
    if ((has('draw') || has('draw-next')) && summary.draw === 'low') tags.push('fills draw');
    if ((card.type === 'molt' || has('molt') || has('openSky')) && summary.moltSafety === 'low') tags.push('Molt help');
    if (card.moltText) tags.push('alternate Molt line');
    return tags.slice(0, 2);
  }

  private renderDeckNeeds(y: number) {
    const summary = this.deckNeedSummary();
    const entries: Array<[string, 'low' | 'steady' | 'strong']> = [
      ['Damage', summary.damage], ['Cover', summary.cover], ['Recovery', summary.recovery],
      ['Draw', summary.draw], ['Molt safety', summary.moltSafety]
    ];
    const tone = (rank: string) => (rank === 'low' ? '#ff9d4d' : rank === 'strong' ? '#8fd6a0' : '#dce8f2');
    this.root.add(this.add.text(GAME_WIDTH / 2, y - 22, 'WHAT THE DECK NEEDS  (orange = thin)', {
      fontFamily: UI_FONT, fontSize: '12px', fontStyle: UI_BOLD, color: '#7f93a8'
    }).setOrigin(0.5));
    const iconForNeed: Record<string, UiIconId> = {
      Damage: 'release-card',
      Cover: 'cover-shield',
      Recovery: 'flock-heart',
      Draw: 'draw-stack',
      'Molt safety': 'preen-kit'
    };
    const labels = entries.map(([label, rank]) => `${label}: ${rank}`);
    const widths = labels.map((label) => label.length * 8 + 42);
    let sx = GAME_WIDTH / 2 - widths.reduce((a, b) => a + b, 0) / 2;
    entries.forEach(([label, rank], index) => {
      const icon = addUiIconImage(this, iconForNeed[label], sx + 12, y, 24);
      if (icon) {
        icon.setAlpha(0.92);
        this.root.add(icon);
      }
      this.root.add(this.add.text(sx + 28, y, `${label}: ${rank}`, {
        fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: tone(rank)
      }).setOrigin(0, 0.5));
      sx += widths[index];
    });
  }

  private renderCardReward() {
    this.queueCardArtLoad(this.rewardChoices);
    this.renderRewardBackdrop('Add to the Flock', 'Pick a card or take Scrap.');
    this.renderDeckNeeds(182);
    this.rewardChoices.forEach((card, index) => {
      this.renderChoiceCard(card, 336 + index * 304, 402, () => this.chooseRewardCard(card.id));
    });
    const skip = this.add.rectangle(GAME_WIDTH / 2, 652, 324, 48, 0x2a2320, 0.96)
      .setStrokeStyle(2, 0xd8a840, 0.9)
      .setInteractive({ useHandCursor: true });
    skip.on('pointerdown', () => this.skipCardReward());
    this.root.add(skip);
    const skipIcon = addUiIconImage(this, 'scrap-gear', GAME_WIDTH / 2 - 132, 652, 30);
    if (skipIcon) this.root.add(skipIcon.setAlpha(0.95));
    this.root.add(this.add.text(GAME_WIDTH / 2 + 10, 652, `Skip  +${this.currentSkipScrapReward()}`, {
      fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: UI_GOLD
    }).setOrigin(0.5));
  }

  private addRewardTagRow(x: number, y: number, tags: string[], accent: number, maxWidth: number) {
    let cursor = x;
    tags.slice(0, 3).forEach((tag) => {
      const w = clamp(tag.length * 7 + 24, 70, 132);
      if (cursor + w > x + maxWidth) return;
      this.root.add(this.add.rectangle(cursor + w / 2, y, w, 22, 0x1d3047, 0.98)
        .setStrokeStyle(1, accent, 0.95));
      this.root.add(this.add.text(cursor + w / 2, y, tag, {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: UI_GOLD,
        align: 'center',
        fixedWidth: w - 8,
      }).setResolution(2).setOrigin(0.5));
      cursor += w + 8;
    });
  }

  private renderWaymarkReward() {
    this.queueWaymarkRewardArtLoad();
    this.renderRewardBackdrop('Claim a Waymark', 'Pick one route artifact.');
    this.waymarkChoices.forEach((mark, index) => {
      const x = 336 + index * 304;
      const y = 404;
      const accent = mark.family === 'bossPrep' ? 0xff6b57 : mark.family === 'molt' ? 0xc9a6ff : 0xd8a840;
      const cardW = 248;
      const cardH = 306;
      const card = this.add.rectangle(x, y, cardW, cardH, 0x07101c, 0.98)
        .setStrokeStyle(3, accent, 0.95)
        .setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.chooseWaymarkReward(mark.id));
      this.root.add(this.add.rectangle(x + 8, y + 10, cardW, cardH, 0x020409, 0.42));
      this.root.add(card);
      const artAsset = waymarkArtAssets[mark.id];
      if (artAsset && this.textures.exists(artAsset.key)) {
        this.root.add(addWaymarkArtImage(this, x, y - 84, artAsset.key).setDisplaySize(86, 86));
      } else {
        this.root.add(this.add.text(x, y - 84, waymarkGlyph(mark), {
          fontFamily: 'Georgia, serif',
          fontSize: '32px',
          fontStyle: UI_BOLD,
          color: '#fff1c7'
        }).setOrigin(0.5));
      }
      this.root.add(this.add.text(x, y - 30, mark.name, {
        fontFamily: UI_FONT,
        fontSize: '20px',
        fontStyle: UI_BOLD,
        color: UI_GOLD,
        align: 'center',
        wordWrap: { width: 202 },
        maxLines: 2
      }).setOrigin(0.5));
      this.root.add(this.add.text(x, y + 24, `${routeMarkFamilyLabel(mark.family)} / ${mark.source}`, {
        fontFamily: UI_FONT,
        fontSize: '12px',
        fontStyle: UI_BOLD,
        color: UI_CYAN,
        align: 'center'
      }).setOrigin(0.5));
      this.root.add(this.add.text(x, y + 48, mark.rarity.toUpperCase(), {
        fontFamily: UI_FONT,
        fontSize: '11px',
        fontStyle: UI_BOLD,
        color: mark.rarity === 'boss' ? '#ffb1a4' : '#ffcf6b',
        align: 'center',
      }).setOrigin(0.5));
      this.addRewardTagRow(x - 102, y + 76, waymarkSynergyTags(mark), accent, 204);
      this.root.add(this.add.text(x, y + 112, mark.description, {
        fontFamily: UI_FONT,
        fontSize: '13px',
        color: '#d7c5a6',
        align: 'center',
        wordWrap: { width: 204 },
        maxLines: 3
      }).setOrigin(0.5));
    });
  }

  private renderUpgradeReward() {
    this.queueCardArtLoad(this.upgradeChoices);
    this.renderRewardBackdrop('Preen a Card', 'Pick one owned card.');
    this.upgradeChoices.forEach((card, index) => {
      this.renderChoiceCard(card, 336 + index * 304, 402, () => this.chooseUpgradeCard(card.id));
    });
  }

  private renderRewardBackdrop(title: string, subtitle: string) {
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.58);
    this.root.add(overlay);
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, 92, GAME_WIDTH - 116, 120, 0x020409, 0.66).setStrokeStyle(1, 0xd8a840, 0.35));
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, 632, GAME_WIDTH - 170, 112, 0x020409, 0.38));
    this.root.add(this.add.text(GAME_WIDTH / 2, 62, 'ROOFTOP LANDMARK', {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: UI_CYAN
    }).setOrigin(0.5));
    this.root.add(this.add.text(GAME_WIDTH / 2, 92, title, {
      fontFamily: UI_FONT,
      fontSize: '42px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5));
    this.root.add(this.add.text(GAME_WIDTH / 2, 136, subtitle, {
      fontFamily: UI_FONT,
      fontSize: '18px',
      color: UI_SOFT
    }).setOrigin(0.5));
  }

  private renderChoiceCard(card: Card, x: number, y: number, onClick: () => void) {
    const cardW = 228;
    const cardH = 312;
    const top = y - cardH / 2;
    const bottom = y + cardH / 2;
    const accent = card.upgraded ? 0x24d0d6 : card.type === 'major' ? 0xd8a840 : card.type === 'molt' ? 0xc56cff : suitAccentColor(card);
    const accentText = card.type === 'major' ? '#ffe1a3' : card.type === 'molt' ? '#e6c4ff' : '#8df4ff';
    const rect = this.add.rectangle(x, y, cardW, cardH, 0x07101c, 0.98)
      .setStrokeStyle(3, accent, 1)
      .setInteractive({ useHandCursor: true });
    rect.on('pointerdown', onClick);
    rect.on('pointerover', () => this.showChoiceCardDetail(card, x, y));
    rect.on('pointerout', () => this.hideCardPreview());
    this.root.add(this.add.rectangle(x + 8, y + 10, cardW, cardH, 0x020409, 0.42));
    this.root.add(rect);
    this.renderChoiceCardArt(card, x, y);

    this.root.add(this.add.rectangle(x, top + 18, cardW - 18, 2, accent, 0.78));
    this.root.add(this.add.rectangle(x, bottom - 18, cardW - 18, 2, accent, 0.55));
    this.root.add(this.add.circle(x - cardW / 2 + 24, top + 28, 19, card.cost === 0 ? 0x24d0d6 : 0xd8a840, 1)
      .setStrokeStyle(2, 0x05080e, 0.95));
    this.root.add(this.add.text(x - cardW / 2 + 24, top + 28, `${card.cost}`, {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: '#07101c'
    }).setOrigin(0.5));

    this.root.add(this.add.rectangle(x, top + 43, cardW - 18, 56, 0x05080e, 0.58));
    this.root.add(this.add.text(x - cardW / 2 + 50, top + 24, displayName(card), {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      stroke: '#020409',
      strokeThickness: 3,
      wordWrap: { width: cardW - 66 },
      maxLines: 2
    }));
    this.root.add(this.add.text(x - cardW / 2 + 50, top + 68, card.bird, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: UI_SOFT,
      stroke: '#020409',
      strokeThickness: 3,
      wordWrap: { width: cardW - 66 },
      maxLines: 1
    }));

    this.root.add(this.add.rectangle(x, bottom - 57, cardW - 18, 96, 0x05080e, 0.78)
      .setStrokeStyle(1, accent, 0.28));
    const choiceSummary = compactSentenceText(displayText(card), 112, 1);
    this.root.add(this.add.text(x - cardW / 2 + 16, bottom - 94, choiceSummary, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      color: '#dce8f2',
      stroke: '#020409',
      strokeThickness: 2,
      lineSpacing: 1,
      wordWrap: { width: cardW - 32 },
      maxLines: 3
    }));
    if (card.moltText) {
      this.root.add(this.add.rectangle(x + cardW / 2 - 48, bottom - 82, 62, 18, 0x2a1208, 0.9)
        .setStrokeStyle(1, 0xff9d4d, 0.72));
      this.root.add(this.add.text(x + cardW / 2 - 48, bottom - 88, 'MOLT', {
        fontFamily: UI_FONT,
        fontSize: '9px',
        fontStyle: UI_BOLD,
        color: '#ffc78f',
        align: 'center',
        fixedWidth: 52
      }).setOrigin(0.5, 0));
    }
    this.root.add(this.add.text(x - cardW / 2 + 16, bottom - 30, cardLabel(card), {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: accentText,
      stroke: '#020409',
      strokeThickness: 2
    }));
    const needTags = this.cardNeedTags(card);
    const stats = cardStatRows(card).slice(0, 2);
    const footer = needTags.length > 0 ? needTags.join(' / ') : stats.join(' / ');
    this.root.add(this.add.text(x + cardW / 2 - 16, bottom - 30, footer, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: needTags.length > 0 ? '#ffcf6b' : '#91a6b8',
      stroke: '#020409',
      strokeThickness: 2,
      align: 'right',
      wordWrap: { width: 116 },
      maxLines: 2
    }).setOrigin(1, 0));
  }

  private showChoiceCardDetail(card: Card, anchorX: number, anchorY: number) {
    this.hideCardPreview();
    const detail = renderFloatingCardDetail(this, card, card.upgraded ? 'Preen choice' : 'Reward choice', card.cost, anchorX, anchorY);
    this.fxLayer.add(detail);
    this.cardPreview = detail;
  }

  private renderChoiceCardArt(card: Card, x: number, y: number) {
    const key = compactCardArtKey(card);
    const artW = 208;
    const artH = Math.round(artW * 1.5);
    if (key && this.textures.exists(key)) {
      const art = this.add.image(x, y, key)
        .setDisplaySize(artW, artH)
        .setAlpha(0.98);
      this.root.add(art);
    } else if (!renderSnagCardBorder(this, (obj) => this.root.add(obj), card, x, y, artW, artH, 0.98)) {
      this.root.add(this.add.rectangle(x, y, artW, artH, 0x141f2f, 0.94)
        .setStrokeStyle(1, 0x49606d, 0.8));
      this.root.add(this.add.text(x, y - 20, cardLabel(card), {
        fontFamily: UI_FONT,
        fontSize: '18px',
        fontStyle: UI_BOLD,
        color: '#7ab8d6',
        align: 'center',
        wordWrap: { width: artW - 40 }
      }).setOrigin(0.5));
    } else {
      this.root.add(this.add.rectangle(x, y, artW, artH, 0x05101a, 0.12));
    }
    this.root.add(this.add.rectangle(x, y, artW, artH, 0x05101a, 0.16));
  }

  private openOverlay(overlay: InspectOverlay) {
    this.inspectOverlay = overlay;
    this.selectedInstanceId = undefined;
    this.inspectedCardId = undefined;
    this.supplyDrawerOpen = false;
    this.waymarkDrawerOpen = false;
    this.cardReviewScroll = 0;
    this.renderAll();
  }

  private closeOverlay() {
    this.inspectOverlay = undefined;
    this.inspectedCardId = undefined;
    this.cardReviewScroll = 0;
    this.renderAll();
  }

  private renderInspectOverlay(overlay: InspectOverlay) {
    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.76)
      .setInteractive({ useHandCursor: false });
    this.root.add(scrim);

    const frame = renderFieldPanel(this, (obj) => this.root.add(obj), HUD_MENU_PANEL.cx, HUD_MENU_PANEL.cy, HUD_MENU_PANEL.w, HUD_MENU_PANEL.h, {
      accent: overlay === 'flock' ? UI_FIELD.cyan : UI_FIELD.gold
    });
    renderCloseControl(this, (obj) => this.root.add(obj), frame.right - HUD_MENU_PANEL.closeX, frame.top + HUD_MENU_PANEL.closeY, () => this.closeOverlay());

    if (overlay === 'flock') {
      this.renderFlockStatsOverlay();
      return;
    }

    const cards = overlay === 'deck'
      ? this.deckReviewCards()
      : overlay === 'draw'
        ? this.drawPile.map((card) => ({ card, zone: 'Draw' }))
        : this.discardPile.map((card) => ({ card, zone: 'Discard' }));
    const title = overlay === 'deck'
      ? `Deck Review (${this.allDeckCards().length})`
      : overlay === 'draw'
        ? `Draw Pile (${cards.length})`
        : `Discard (${cards.length})`;
    const headerIcon = overlay === 'discard' ? 'discard-basket' : overlay === 'draw' ? 'draw-stack' : 'deck-stack';
    addUiIconImage(this, headerIcon, frame.left + HUD_MENU_PANEL.headerIconX, frame.top + HUD_MENU_PANEL.headerIconY, 28)?.setAlpha(0.9);
    this.renderCardReviewOverlay(title, cards);
  }

  private renderCardReviewOverlay(title: string, cards: Array<{ card: Card; zone: string }>) {
    this.root.add(this.add.text(140, 86, title, {
      fontFamily: UI_FONT,
      fontSize: '32px',
      fontStyle: UI_BOLD,
      color: UI_GOLD
    }));

    const zoneY = 146;
    const renderZoneCount = (iconId: UiIconId, value: number, x: number, accent: number) => {
      const icon = addUiIconImage(this, iconId, x, zoneY, 14);
      if (icon) this.root.add(icon.setAlpha(0.92));
      this.root.add(this.add.circle(x + 25, zoneY, 13, 0x07101c, 0.98).setStrokeStyle(1.5, accent, 0.9));
      this.root.add(this.add.text(x + 25, zoneY, `${value}`, {
        fontFamily: UI_FONT,
        fontSize: '13px',
        fontStyle: UI_BOLD,
        color: '#ffffff'
      }).setOrigin(0.5));
    };
    renderZoneCount('draw-stack', this.drawPile.length, 146, 0x8df4ff);
    renderZoneCount('deck-stack', this.hand.length, 202, 0xd8a840);
    renderZoneCount('discard-basket', this.discardPile.length, 258, 0xffb86b);

    const sorted = [...cards].sort((a, b) => {
      const zoneOrder = zoneRank(a.zone) - zoneRank(b.zone);
      if (zoneOrder !== 0) return zoneOrder;
      return a.card.name.localeCompare(b.card.name);
    });

    const selectedEntry = this.getInspectedCardEntry(sorted);
    this.cardReviewScroll = clamp(this.cardReviewScroll, 0, Math.max(0, sorted.length - CARD_REVIEW_VISIBLE_ROWS));

    sorted.slice(this.cardReviewScroll, this.cardReviewScroll + CARD_REVIEW_VISIBLE_ROWS).forEach(({ card, zone }, index) => {
      const x = 140;
      const y = 198 + index * CARD_REVIEW_ROW_H;
      const selected = selectedEntry?.card.id === card.id;
      const rowBg = this.add.rectangle(x + 150, y + 15, 312, 34, selected ? 0x1d2224 : 0x0f151d, selected ? 0.96 : 0.44)
        .setStrokeStyle(selected ? 1.5 : 1, selected ? 0xd8a840 : card.upgraded ? 0x24d0d6 : 0xffffff, selected ? 0.95 : 0.08)
        .setInteractive({ useHandCursor: true });
      rowBg.on('pointerdown', () => this.inspectCard(card.id));
      this.root.add(rowBg);
      this.root.add(this.add.rectangle(x + 150, y + 31, 280, 1, card.upgraded ? 0x24d0d6 : 0xd8a840, selected ? 0.6 : 0.18));
      this.root.add(this.add.circle(x + 14, y + 15, 13, this.effectiveCost(card) === 0 ? 0x24d0d6 : 0xd8a840, 1));
      this.root.add(this.add.text(x + 14, y + 15, `${this.effectiveCost(card)}`, {
        fontFamily: UI_FONT,
        fontSize: '13px',
        fontStyle: UI_BOLD,
        color: '#07101c'
      }).setOrigin(0.5));
      this.root.add(this.add.text(x + 36, y + 5, displayName(card), {
        fontFamily: UI_FONT,
        fontSize: '13px',
        fontStyle: UI_BOLD,
        color: UI_GOLD,
        wordWrap: { width: 170 }
      }));
      this.root.add(this.add.text(x + 222, y + 6, cardLabel(card), {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: '#7ab8d6'
      }));
      const zoneIcon = addUiIconImage(this, zoneIconForLabel(zone), x + 414, y + 16, 14);
      if (zoneIcon) this.root.add(zoneIcon.setAlpha(0.9));
    });

    this.renderCardReviewScrollButton(472, 214, 'up', this.cardReviewScroll > 0, () => this.scrollCardReview(-1));
    this.renderCardReviewScrollButton(
      472,
      610,
      'down',
      this.cardReviewScroll < Math.max(0, sorted.length - CARD_REVIEW_VISIBLE_ROWS),
      () => this.scrollCardReview(1)
    );
    this.root.add(this.add.text(424, 632, `${this.cardReviewScroll + 1}-${this.cardReviewScroll + Math.min(CARD_REVIEW_VISIBLE_ROWS, sorted.length - this.cardReviewScroll)} / ${sorted.length}`, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      color: '#91a6b8'
    }));

    if (selectedEntry) {
      this.renderCardDetailPanel(selectedEntry.card, selectedEntry.zone);
    } else {
      this.root.add(this.add.text(662, 190, 'Select a card to examine it.', {
        fontFamily: UI_FONT,
        fontSize: '20px',
        fontStyle: UI_BOLD,
        color: '#91a6b8'
      }));
    }
  }

  private inspectCard(cardId: string) {
    this.inspectedCardId = cardId;
    this.renderAll();
  }

  private scrollCardReview(delta: number) {
    if (!this.inspectOverlay || this.inspectOverlay === 'flock') return;
    const cards = this.inspectOverlay === 'deck'
      ? this.deckReviewCards()
      : this.inspectOverlay === 'draw'
        ? this.drawPile.map((card) => ({ card, zone: 'Draw' }))
        : this.discardPile.map((card) => ({ card, zone: 'Discard' }));
    this.cardReviewScroll = clamp(this.cardReviewScroll + delta, 0, Math.max(0, cards.length - CARD_REVIEW_VISIBLE_ROWS));
    this.renderAll();
  }

  private renderCardReviewScrollButton(x: number, y: number, direction: 'up' | 'down', enabled: boolean, onClick: () => void) {
    const accent = enabled ? UI_FIELD.gold : 0x3f4c58;
    const button = this.add.rectangle(x, y, 40, 32, enabled ? 0x0d1420 : 0x0a0e15, enabled ? 0.94 : 0.7)
      .setStrokeStyle(1.5, accent, enabled ? 0.82 : 0.46);
    this.root.add(button);
    const icon = addUiIconImage(this, direction === 'up' ? 'scroll-up-chevron' : 'scroll-down-chevron', x, y, 13);
    if (icon) this.root.add(icon.setAlpha(enabled ? 0.9 : 0.38));
    if (!enabled) return;
    button.setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => {
      playUiSound('confirm');
      onClick();
    });
  }

  private getInspectedCardEntry(cards: Array<{ card: Card; zone: string }>) {
    return cards.find(({ card }) => card.id === this.inspectedCardId) ?? cards[0];
  }

  private renderCardDetailPanel(card: Card, zone: string) {
    const accent = card.upgraded ? 0x24d0d6 : card.type === 'major' ? 0xd8a840 : 0x7ab8d6;
    const contract = this.activeCardContract(card);
    renderFieldPanel(this, (obj) => this.root.add(obj), DECK_DETAIL_LAYOUT.panelCx, DECK_DETAIL_LAYOUT.panelCy, DECK_DETAIL_LAYOUT.panelW, DECK_DETAIL_LAYOUT.panelH, { accent, fill: UI_FIELD.ink });

    this.renderDetailCardArt(card);

    this.root.add(this.add.circle(DECK_DETAIL_LAYOUT.costX, DECK_DETAIL_LAYOUT.costY, 18, this.effectiveCost(card) === 0 ? 0x24d0d6 : 0xd8a840, 1));
    this.root.add(this.add.text(DECK_DETAIL_LAYOUT.costX, DECK_DETAIL_LAYOUT.costY, `${this.effectiveCost(card)}`, {
      fontFamily: UI_FONT,
      fontSize: '17px',
      fontStyle: UI_BOLD,
      color: '#07101c'
    }).setOrigin(0.5));

    this.root.add(this.add.text(DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.titleY, displayName(card), {
      fontFamily: UI_FONT,
      fontSize: '26px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      wordWrap: { width: DECK_DETAIL_LAYOUT.textW }
    }));
    this.root.add(this.add.text(DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.metaY, `${card.bird} / ${cardLabel(card)} / ${zone}`, {
      fontFamily: UI_FONT,
      fontSize: '15px',
      fontStyle: UI_BOLD,
      color: '#7ab8d6',
      wordWrap: { width: DECK_DETAIL_LAYOUT.textW }
    }));
    this.renderCardDetailChip(DECK_DETAIL_LAYOUT.textX + 56, DECK_DETAIL_LAYOUT.targetY + 8, 112, targetIconForTarget(contract.target), targetLabel(contract.target), contract.usesMolt ? 0xff9d4d : 0x7ab8d6);
    this.renderCardDetailChip(DECK_DETAIL_LAYOUT.textX + 186, DECK_DETAIL_LAYOUT.targetY + 8, 112, roleIconForCard(contract), contract.role.toUpperCase(), contract.usesMolt ? 0xff9d4d : 0xd8a840);
    if (contract.usesMolt) {
      this.root.add(this.add.rectangle(DECK_DETAIL_LAYOUT.textX + 40, DECK_DETAIL_LAYOUT.statusY + 9, 80, 22, 0x2a1208, 0.96)
        .setStrokeStyle(1, 0xff9d4d, 0.82));
      this.root.add(this.add.text(DECK_DETAIL_LAYOUT.textX + 40, DECK_DETAIL_LAYOUT.statusY, 'MOLT', {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: '#ffc78f',
        align: 'center',
        fixedWidth: 72
      }).setOrigin(0.5, 0));
    }

    this.root.add(this.add.text(DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.currentHeaderY, contract.usesMolt ? 'Now (Molt)' : 'Now', detailHeaderStyle()));
    this.root.add(this.add.text(DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.currentBodyY, contract.text, detailBodyStyle(DECK_DETAIL_LAYOUT.textW, 3)));

    this.root.add(this.add.text(DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.alternateHeaderY, contract.usesMolt ? 'Base' : 'Preen', detailHeaderStyle()));
    this.root.add(this.add.text(DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.alternateBodyY, contract.usesMolt ? displayText(card) : card.upgraded ? 'Already preened.' : card.upgradedText, detailBodyStyle(DECK_DETAIL_LAYOUT.textW, 2)));

    this.renderCardStatIconRow(card, DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.statsHeaderY + 6, DECK_DETAIL_LAYOUT.textW);
  }

  private renderCardDetailChip(cx: number, cy: number, w: number, iconId: UiIconId, text: string, accent: number) {
    this.root.add(this.add.rectangle(cx, cy, w, 26, 0x0b1017, 0.9).setStrokeStyle(1, accent, 0.62));
    const icon = addUiIconImage(this, iconId, cx - w / 2 + 16, cy, 8);
    if (icon) this.root.add(icon.setAlpha(0.86));
    this.root.add(this.add.text(cx + 10, cy - 7, text, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: '#dce8f2',
      fixedWidth: w - 42,
      maxLines: 1
    }).setOrigin(0.5, 0));
  }

  private renderCardStatIconRow(card: Card, x: number, y: number, maxW: number) {
    const entries = cardStatEntries(card);
    if (entries.length === 0) {
      this.root.add(this.add.text(x, y, 'No flock bonuses', {
        fontFamily: UI_FONT,
        fontSize: '12px',
        color: '#91a6b8'
      }));
      return;
    }
    let cx = x;
    entries.slice(0, 5).forEach((entry) => {
      const chipW = 54;
      if (cx + chipW > x + maxW) return;
      this.root.add(this.add.rectangle(cx + chipW / 2, y + 10, chipW, 24, 0x0b1017, 0.9).setStrokeStyle(1, 0x8df4ff, 0.52));
      const iconId = statIconForKey(entry.key);
      if (iconId) {
        const icon = addUiIconImage(this, iconId, cx + 14, y + 10, 8);
        if (icon) this.root.add(icon.setAlpha(0.82));
      }
      this.root.add(this.add.text(cx + 35, y + 3, `+${entry.value}`, {
        fontFamily: UI_FONT,
        fontSize: '12px',
        fontStyle: UI_BOLD,
        color: UI_CYAN
      }).setOrigin(0.5, 0));
      cx += chipW + 6;
    });
  }

  private renderDetailCardArt(card: Card) {
    const key = loadedCardArtKey(this, card);
    if (!key || !this.textures.exists(key)) {
      if (renderSnagCardBorder(this, (obj) => this.root.add(obj), card, DECK_DETAIL_LAYOUT.artX, DECK_DETAIL_LAYOUT.artY, DECK_DETAIL_LAYOUT.artW, DECK_DETAIL_LAYOUT.artH, 0.92)) {
        this.root.add(this.add.rectangle(DECK_DETAIL_LAYOUT.artX, DECK_DETAIL_LAYOUT.artY, DECK_DETAIL_LAYOUT.artW, DECK_DETAIL_LAYOUT.artH, 0x05101a, 0.12));
        return;
      }
      this.root.add(this.add.rectangle(DECK_DETAIL_LAYOUT.artX, DECK_DETAIL_LAYOUT.artY, DECK_DETAIL_LAYOUT.artW, DECK_DETAIL_LAYOUT.artH, 0x141f2f, 0.95)
        .setStrokeStyle(1, 0x49606d, 0.8));
      this.root.add(this.add.text(DECK_DETAIL_LAYOUT.artX, DECK_DETAIL_LAYOUT.artY, cardLabel(card), {
        fontFamily: UI_FONT,
        fontSize: '18px',
        fontStyle: UI_BOLD,
        color: '#7ab8d6',
        wordWrap: { width: 190 },
        align: 'center'
      }).setOrigin(0.5));
      return;
    }

    const art = this.add.image(DECK_DETAIL_LAYOUT.artX, DECK_DETAIL_LAYOUT.artY, key)
      .setDisplaySize(DECK_DETAIL_LAYOUT.artW, DECK_DETAIL_LAYOUT.artH)
      .setAlpha(0.92);
    this.root.add(art);
  }

  private renderFlockStatsOverlay() {
    this.root.add(this.add.text(140, 86, 'Flock Stats', {
      fontFamily: UI_FONT, fontSize: '32px', fontStyle: UI_BOLD, color: UI_GOLD
    }));
    this.root.add(this.add.text(140, 126, 'Base values plus passive stats from owned cards.', {
      fontFamily: UI_FONT, fontSize: '16px', color: UI_SOFT
    }));
    renderFlockStatTable(this, (obj) => this.root.add(obj), this.flockStatRows(), 140, 168);
    this.root.add(this.add.text(140, 558, 'Flock Stats update when cards join, leave, or are preened.', {
      fontFamily: UI_FONT, fontSize: '15px', color: '#91a6b8'
    }));

    // This Combat — live per-fight tracking (right column).
    const rx = 720;
    this.root.add(this.add.text(rx, 168, 'This Combat', tableHeaderStyle()));
    const battleRows: Array<[string, string]> = [
      ['Beat', `${this.turn}`],
      ['Damage dealt', `${this.statDealt}`],
      ['Damage taken', `${this.statTaken}`],
      ['Damage blocked', `${this.statBlocked}`],
      ['Cards played', `${this.statCardsPlayed}`],
      ['Enemies down', `${this.statDefeated}`],
    ];
    battleRows.forEach((row, index) => {
      const y = 215 + index * 36;
      this.root.add(this.add.rectangle(rx + 132, y + 29, 300, 1, 0xffffff, index % 2 === 0 ? 0.08 : 0.04));
      this.root.add(this.add.text(rx, y, row[0], tableCellStyle('#cdd9e6')));
      this.root.add(this.add.text(rx + 260, y, row[1], { ...tableCellStyle('#ffffff'), align: 'right' }).setOrigin(1, 0));
    });
  }

  private deckReviewCards() {
    return [
      ...this.drawPile.map((card) => ({ card, zone: 'Deck' })),
      ...this.hand.map((card) => ({ card, zone: 'Hand' })),
      ...this.discardPile.map((card) => ({ card, zone: 'Discard' }))
    ];
  }

  private renderOutcome() {
    const win = this.mode === 'runComplete';
    const killedBy = win ? '' : (this.enemies.find((enemy) => enemy.hp > 0)?.name ?? '');
    const cx = GAME_WIDTH / 2;
    this.root.add(this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.82));
    this.root.add(this.add.rectangle(cx, 360, 600, 470, 0x0d1420, 0.98)
      .setStrokeStyle(3, win ? 0xe8b830 : 0xff7a6e, 0.95));

    this.root.add(this.add.text(cx, 170, win ? 'Run Complete' : 'Flock Scattered', {
      fontFamily: 'Georgia, serif', fontSize: '44px', fontStyle: UI_BOLD,
      color: win ? '#ffe1a3' : '#ffb2a4', stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5));
    this.root.add(this.add.text(cx, 212, win
      ? 'The flyway is restored — every district answers to the flock.'
      : `Scattered at ${currentMap().name}${killedBy ? ` by ${killedBy}` : ''}.`, {
      fontFamily: UI_FONT, fontSize: '16px', color: UI_SOFT, align: 'center', wordWrap: { width: 540 }
    }).setOrigin(0.5));

    // Recap stats, drawn from the same run state RunSummary captures.
    const districts = win ? alphaMaps.length : activeMapIndex + 1;
    const summary = window.__birdSquadLastRun;
    const totalTaken = summary?.combatResults.reduce((sum, combat) => sum + combat.cohesionLost, 0) ?? this.statTaken;
    const totalDealt = summary?.combatResults.reduce((sum, combat) => sum + combat.damageDealt, 0) ?? this.statDealt;
    const stats: Array<[string, string]> = [
      ['Flock Leader', getLeader(this.runLeaderId).name],
      ['Difficulty', difficultyLabel(this.runDifficulty)],
      ['Districts', `${districts} / ${alphaMaps.length}  ·  ${currentMap().name}`],
      ['Encounters cleared', `${this.completedRouteNodeIds.length}`],
      ['Final Cohesion', `${this.flock.hp} / ${this.flock.maxHp}`],
      ['Damage dealt / taken', `${totalDealt} / ${totalTaken}`],
      ['Scrap on hand', `${this.scrap}`],
      ['Deck size', `${this.allDeckCards().length} cards`],
      ['Supplies used', `${summary?.suppliesUsed.length ?? this.runSuppliesUsed.length}`],
      ['Waymarks', `${this.routeMarks.length}`],
    ];
    stats.forEach((row, index) => {
      const ry = 258 + index * 30;
      this.root.add(this.add.text(cx - 250, ry, row[0], {
        fontFamily: UI_FONT, fontSize: '16px', color: UI_MUTED
      }).setOrigin(0, 0.5));
      this.root.add(this.add.text(cx + 250, ry, row[1], {
        fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: '#eaf1f8'
      }).setOrigin(1, 0.5));
    });

    const rewards = this.lastRunRewards;
    if (rewards && (rewards.newLeaders.length || rewards.newAchievements.length)) {
      const parts: string[] = [];
      if (rewards.newLeaders.length) parts.push(`New Leader — ${rewards.newLeaders.map((id) => getLeader(id).name).join(', ')}`);
      if (rewards.newAchievements.length) parts.push(`Achievement — ${rewards.newAchievements.map((id) => achievements.find((a) => a.id === id)?.name ?? id).join(', ')}`);
      this.root.add(this.add.text(cx, 240, `★ ${parts.join('    ·    ')}`, {
        fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: '#ffe07a', align: 'center', wordWrap: { width: 540 }
      }).setOrigin(0.5));
    }

    const runBack = this.add.rectangle(cx - 130, 552, 236, 52, 0x122235, 0.98)
      .setStrokeStyle(2, 0xd8a840, 1).setInteractive({ useHandCursor: true });
    runBack.on('pointerdown', () => this.scene.start('RouteScene'));
    this.root.add(runBack);
    this.root.add(this.add.text(cx - 130, 552, 'Run It Back', {
      fontFamily: UI_FONT, fontSize: '20px', fontStyle: UI_BOLD, color: UI_GOLD
    }).setOrigin(0.5));

    const toMenu = this.add.rectangle(cx + 130, 552, 236, 52, 0x141d2b, 0.98)
      .setStrokeStyle(2, 0x7ab8d6, 0.95).setInteractive({ useHandCursor: true });
    toMenu.on('pointerdown', () => this.scene.start('MenuScene'));
    this.root.add(toMenu);
    this.root.add(this.add.text(cx + 130, 552, 'Main Menu', {
      fontFamily: UI_FONT, fontSize: '20px', fontStyle: UI_BOLD, color: '#dbe6f0'
    }).setOrigin(0.5));
  }

  private onCardClicked(instanceId: string) {
    if (this.mode !== 'battle') return;
    const card = this.hand.find((candidate) => candidate.instanceId === instanceId);
    if (!card || this.effectiveCost(card) > this.energy) return;
    this.normalizeSelectedEnemy();
    const contract = this.activeCardContract(card);

    if (contract.target === 'none' || contract.target === 'self' || contract.target === 'allEnemies' || contract.target === 'choice') {
      this.playCard(card);
      return;
    }

    this.selectedInstanceId = this.selectedInstanceId === instanceId ? undefined : instanceId;
    this.hideCardPreview();
    hideKwTooltip();
    this.refreshHandCardSelection();
  }

  private onEnemyClicked(enemyId: string) {
    if (!this.getLivingEnemy(enemyId)) {
      this.normalizeSelectedEnemy();
      this.renderAll();
      return;
    }
    this.selectedEnemyId = enemyId;
    const card = this.getSelectedCard();
    if (card && this.activeCardContract(card).target === 'enemy') {
      this.playCard(card, enemyId);
      return;
    }
    this.renderAll();
  }

  private playCard(card: Card, enemyId = this.selectedEnemyId) {
    if (this.mode !== 'battle') return;
    const contract = this.activeCardContract(card);
    const targetEnemy = this.resolvePlayableEnemyTarget(enemyId);
    if (contract.target === 'enemy' && !targetEnemy) return;
    enemyId = targetEnemy?.id ?? enemyId;
    const cost = this.effectiveCost(card);
    if (cost > this.energy) return;
    const handSizeBeforePlay = this.hand.length;
    const handIndexBeforePlay = Math.max(0, this.hand.findIndex((candidate) => candidate.instanceId === card.instanceId));
    const playedCard = this.removeCardFromHand(card.instanceId);
    if (!playedCard) return;
    this.energy -= cost;
    this.statCardsPlayed += 1;
    this.cardsPlayedThisTurn += 1;
    if (cost === 0) this.zeroCostThisTurn += 1;
    this.statMaxCardsPlayedTurn = Math.max(this.statMaxCardsPlayedTurn, this.cardsPlayedThisTurn);
    this.playCardCastFx(playedCard, enemyId, handIndexBeforePlay, handSizeBeforePlay, contract);

    const outcome = this.resolveCardEffects(playedCard, enemyId, contract);
    if (playedCard.runtime.suit) {
      this.playedSuitsThisTurn.add(playedCard.runtime.suit);
      this.triggerFledglingSuitRally(playedCard);
      this.checkSuitPlayedMarks(playedCard.runtime.suit);
    }
    this.playedCardIdsThisCombat.add(playedCard.id);
    this.checkNthCardMarks(); // rooftop_shortcut-style Waymarks that trigger on the Nth card

    // (Molt is now a whole-turn transform stance — it no longer breaks on the
    // next card. It ends in endTurn, leaving the flock briefly Open Sky.)

    // A snag like Bad Directions shuffles itself back into the draw pile instead
    // of discarding, so it keeps clogging the hand until removed at a deck node.
    if (outcome.exhaustSelf) this.logEvent(`${displayName(playedCard)} is cleared for this combat.`);
    else if (outcome.returnSelfToDraw) this.addCardToDrawRandom(playedCard);
    else this.discardPile.push(playedCard);
    this.selectedInstanceId = undefined;
    this.checkOutcome();
    this.renderAll();
  }

  private addCastCardGhost(card: Card, x: number, y: number) {
    const accent = card.type === 'major' ? 0xd8a840 : card.type === 'molt' ? 0xc56cff : suitAccentColor(card);
    const c = this.add.container(x, y);
    c.add(this.add.rectangle(4, 6, CARD_W, CARD_H, 0x020409, 0.42));
    c.add(this.add.rectangle(0, 0, CARD_W, CARD_H, 0x07101c, 0.98).setStrokeStyle(3, accent, 1));
    const key = loadedCardArtKey(this, card);
    if (key && this.textures.exists(key)) {
      c.add(this.add.image(0, 0, key).setDisplaySize(CARD_W - 6, CARD_H - 6));
    } else if (!renderSnagCardBorder(this, (obj) => c.add(obj), card, 0, 0, CARD_W - 6, CARD_H - 6, 0.96)) {
      c.add(this.add.rectangle(0, 0, CARD_W - 6, CARD_H - 6, 0x141d2b, 0.96));
    } else {
      c.add(this.add.rectangle(0, 0, CARD_W - 6, CARD_H - 6, 0x05101a, 0.12));
    }
    c.add(this.add.rectangle(0, -CARD_H / 2 + 16, CARD_W - 6, 26, 0x05080e, 0.72));
    c.add(this.add.text(-CARD_W / 2 + 34, -CARD_H / 2 + 8, displayName(card), {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: '#ffe7b0',
      wordWrap: { width: CARD_W - 44 },
    }));
    c.add(this.add.circle(-CARD_W / 2 + 16, -CARD_H / 2 + 16, 14, this.effectiveCost(card) === 0 ? 0x24d0d6 : 0xe8b830, 1)
      .setStrokeStyle(2, 0x05080e, 0.9));
    c.add(this.add.text(-CARD_W / 2 + 16, -CARD_H / 2 + 16, `${this.effectiveCost(card)}`, {
      fontFamily: UI_FONT,
      fontSize: '16px',
      fontStyle: UI_BOLD,
      color: '#06101c',
    }).setOrigin(0.5));
    this.fxLayer.add(c);
    return c;
  }

  private playCardCastFx(card: Card, enemyId: string, handIndex = 0, handSize = this.hand.length + 1, contract = this.activeCardContract(card)) {
    if (prefersReducedMotion()) return;
    const meta = suitFxMeta(card.runtime.suit);
    const activeTarget = contract.target;
    const target = activeTarget === 'enemy'
      ? this.enemyView(this.getEnemy(enemyId))
      : activeTarget === 'allEnemies'
        ? { x: ENEMY_FX_X, y: ENEMY_FX_Y, scale: 1 }
        : { x: FLOCK_FX_X, y: FLOCK_FX_Y, scale: 1 };
    const animKey = SUIT_FX_ANIM[card.runtime.suit ?? ''] ?? this.fxAnimForColor(meta.color);
    this.queueFlockMotion('cast');
    const travelDirection = target.x >= FLOCK_FX_X ? 1 : -1;

    const fromX = this.handCardLeft(handIndex, handSize) + CARD_W / 2;
    const ghost = this.addCastCardGhost(card, fromX, HAND_Y);
    ghost.setDepth(40);
    this.fxShardSweep(fromX, HAND_Y - 18, meta.color, travelDirection, 7);
    this.fxDirectionalStreak(fromX, HAND_Y - 34, FLOCK_FX_X + 18, FLOCK_FX_Y - 82, meta.color, 300);

    this.tweens.chain({
      targets: ghost,
      tweens: [
        {
          x: FLOCK_FX_X + 22,
          y: FLOCK_FX_Y - 120,
          scale: 0.78,
          angle: target.x > FLOCK_FX_X ? -7 : 7,
          duration: 170,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            this.fxGlowPulse(FLOCK_FX_X + 10, FLOCK_FX_Y - 42, meta.color, 64, 360, 0.16);
            this.fxSuitSignature(card.runtime.suit, FLOCK_FX_X + 10, FLOCK_FX_Y - 42, meta.color, 0.82);
            this.playFxAnimation(animKey, FLOCK_FX_X + 10, FLOCK_FX_Y - 42, { scale: 1.18, alpha: 0.8, additive: true });
            this.fxShardSweep(FLOCK_FX_X + 18, FLOCK_FX_Y - 62, meta.color, travelDirection, 7);
            if (activeTarget === 'enemy' || activeTarget === 'allEnemies') {
              this.fxDirectionalStreak(FLOCK_FX_X + 18, FLOCK_FX_Y - 72, target.x, target.y - 68, meta.color, 340);
            }
          },
        },
        {
          x: target.x,
          y: target.y - 86,
          scale: 0.52,
          angle: target.x > FLOCK_FX_X ? 6 : -6,
          alpha: 0.82,
          duration: activeTarget === 'self' || activeTarget === 'none' || activeTarget === 'choice' ? 120 : 230,
          ease: 'Quad.easeInOut',
          onComplete: () => {
            ghost.destroy(true);
            const selfTarget = activeTarget === 'self' || activeTarget === 'none' || activeTarget === 'choice';
            this.fxGlowPulse(target.x, target.y - 18, meta.color, selfTarget ? 68 : 86, 440, 0.2);
            this.fxShockwave(target.x, target.y - 18, meta.color, selfTarget ? 62 : 82, 460, selfTarget ? -6 : 8);
            this.fxSuitSignature(card.runtime.suit, target.x, target.y - 18, meta.color, selfTarget ? 0.82 : 1.02);
            this.fxImpactBurst(target.x, target.y - 18, meta.color, card.runtime.suit, selfTarget ? 0.78 : 1.08);
            this.playFxAnimation(animKey, target.x, target.y - 18, { scale: 1.38, alpha: 0.88, additive: true });
            this.fxMoteBurst(target.x, target.y - 18, meta.color, {
              count: selfTarget ? 9 : 15,
              speed: selfTarget ? 84 : 142,
              lifespan: 420,
              scale: 0.56,
              gravityY: selfTarget ? -16 : 16,
            });
          },
        },
      ],
    });
  }

  private resolveCardEffects(card: Card, enemyId: string, contract = this.activeCardContract(card)): EffectResolutionState {
    // While Molting, a card resolves its unique Molt ability (do-different)
    // instead of its normal effect. Cards without one fall back to normal.
    const molting = contract.usesMolt;
    const effects = contract.effects;
    if (molting) {
      const moltLabel = contract.text;
      this.logEvent(`${displayName(card)} molts — ${moltLabel}`);
      floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 40, 'Molt!', '#ff9d4d');
    }
    const state: EffectResolutionState = {
      previousDiscarded: 0,
      previousDamageDefeated: false,
      spentResonance: false,
      returnSelfToDraw: false,
      exhaustSelf: false,
      builtFlow: false,
      flockDamageBonusUsed: false
    };
    for (const effect of effects) {
      this.resolveCardEffect(effect, card, enemyId, state);
    }
    return state;
  }

  private resolveHeldSnagEffects() {
    const heldSnags = this.hand.filter((card) => isSnagCard(card) && card.runtime.heldEffects?.length);
    for (const card of heldSnags) {
      const state: EffectResolutionState = {
        previousDiscarded: 0,
        previousDamageDefeated: false,
        spentResonance: false,
        returnSelfToDraw: false,
        exhaustSelf: false,
        builtFlow: false,
        flockDamageBonusUsed: false
      };
      this.logEvent(`${displayName(card)} catches at Roost.`);
      floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 72, 'Snag!', '#ff6b57');
      for (const effect of card.runtime.heldEffects ?? []) {
        this.resolveCardEffect(effect, card, '', state);
      }
      if (state.returnSelfToDraw) {
        this.hand = this.hand.filter((candidate) => candidate.instanceId !== card.instanceId);
        this.addCardToDrawRandom(card);
      }
    }
  }

  private resolveCardEffect(
    effectText: string,
    card: Card,
    enemyId: string,
    state: EffectResolutionState
  ) {
    const conditional = effectText.match(/^if ([a-zA-Z][a-zA-Z0-9]*(?:\([a-zA-Z0-9_,-]+\))?) then (.+)$/);
    if (conditional) {
      if (!this.checkCardCondition(conditional[1], card, enemyId, state)) return;
      this.resolveCardEffect(conditional[2], card, enemyId, state);
      return;
    }

    const parsed = parseEffect(effectText);
    if (!parsed) {
      this.logEvent(`${displayName(card)} fizzles: ${effectText}`);
      return;
    }

    const targetWinded = this.getLivingEnemy(enemyId)?.weak ?? 0;
    const value = parseEffectValue(parsed.args[1] ?? parsed.args[0], state.previousDiscarded, targetWinded, this.flock.block);
    switch (parsed.name) {
      case 'damage':
        state.previousDamageDefeated = this.damageEnemy(enemyId, value, displayName(card), card, false, this.spendFlockDamageBonus(state));
        this.buildFlow(state);
        break;
      case 'damagePierce':
        state.previousDamageDefeated = this.damageEnemy(enemyId, value, displayName(card), card, true, this.spendFlockDamageBonus(state));
        this.buildFlow(state);
        break;
      case 'damageAll':
        state.previousDamageDefeated = false;
        {
          const bonus = this.spendFlockDamageBonus(state, true);
          this.enemies
            .filter((enemy) => enemy.hp > 0)
            .forEach((enemy) => {
              if (this.damageEnemy(enemy.id, value, displayName(card), card, false, bonus)) state.previousDamageDefeated = true;
            });
        }
        this.buildFlow(state);
        break;
      case 'gainCover':
        this.gainBlock(value, displayName(card), card);
        this.buildFlow(state);
        break;
      case 'applyOpenSky':
        this.flock.exposed = true;
        this.flock.exposedTurns = Math.max(this.flock.exposedTurns, value);
        this.logEvent(`${displayName(card)} leaves the flock in Open Sky.`);
        floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 50, 'Open Sky!', '#ff9d4d');
        this.pulseRing(FLOCK_FX_X, FLOCK_FX_Y - 20, 0xff9d4d, 92, 580);
        this.sparkBurst(FLOCK_FX_X, FLOCK_FX_Y - 20, 0xff9d4d, 20, 155);
        break;
      case 'loseCover': {
        const removed = Math.min(this.flock.block, value);
        this.flock.block = Math.max(0, this.flock.block - removed);
        this.logEvent(`${displayName(card)} shakes loose ${removed} Cover.`);
        floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 42, `-${removed} Cover`, '#8df4ff');
        this.coverImpactFx(FLOCK_FX_X, FLOCK_FX_Y, 0x8df4ff);
        break;
      }
      case 'damageFlock': {
        const damage = Math.max(0, value);
        this.flock.hp = Math.max(0, this.flock.hp - damage);
        this.statTaken += damage;
        if (damage > 0) this.flock.flow = 0;
        this.logEvent(`${displayName(card)} hurts the flock for ${damage}.`);
        if (damage > 0) {
          this.queueFlockMotion('hit');
          floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 8, `-${damage}`, '#ff7a6e');
          this.sparkBurst(FLOCK_FX_X, FLOCK_FX_Y + 32, 0xff9d6b, 16, 155);
          shakeCamera(this, 0.004);
        }
        break;
      }
      case 'heal':
        this.healFlock(value, displayName(card));
        break;
      case 'overhealCover':
        // Heal, and any Cohesion past full overflows into Cover (signature mend).
        this.healFlock(value, displayName(card), true);
        this.buildFlow(state);
        break;
      case 'loseCohesion':
        // A self-cost: sacrifice Cohesion (never below 1) to fuel a payoff.
        this.flock.hp = Math.max(1, this.flock.hp - value);
        this.logEvent(`${displayName(card)} spends ${value} Cohesion.`);
        floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 8, `-${value}`, '#ff7a6e');
        break;
      case 'draw':
        this.drawCards(value);
        this.logEvent(`${displayName(card)} draws ${value}.`);
        break;
      case 'discard':
        state.previousDiscarded = this.discardCards(value);
        break;
      case 'discardUpTo':
        state.previousDiscarded = this.discardCards(value);
        break;
      case 'gainWingbeat':
        this.energy += value;
        this.logEvent(`${displayName(card)} gains ${value} Wingbeat.`);
        break;
      case 'loseWingbeat':
        this.energy = Math.max(0, this.energy - value);
        this.logEvent(`${displayName(card)} drains ${value} Wingbeat.`);
        break;
      case 'gainResonance':
        this.gainResonance(value);
        break;
      case 'spendResonance':
        state.spentResonance = this.spendResonance(value);
        break;
      case 'resonanceBurst': {
        // Spend ALL banked Resonance for `value` damage per point, then empty the pool.
        const spent = this.spark;
        const burst = spent * value;
        if (burst > 0) {
          state.previousDamageDefeated = this.damageEnemy(enemyId, burst, displayName(card), card, false, 0);
          this.logEvent(`${displayName(card)} releases ${spent} Resonance for ${burst} damage.`);
          const rbView = this.enemyView(this.getEnemy(enemyId));
          floatingText(this, this.fxLayer, rbView.x, rbView.y - 90, 'Resonance Burst!', '#8df4ff');
          this.sparkBurst(rbView.x, rbView.y - 22, 0x8df4ff, 30, 210);
        }
        this.spark = 0;
        state.spentResonance = spent > 0;
        if (spent > 0) this.checkResonanceSpentMarks();
        this.buildFlow(state);
        break;
      }
      case 'windedBurst': {
        // Consume ALL Winded on the target for `value` damage per stack.
        const enemy = this.getLivingEnemy(enemyId);
        if (!enemy) break;
        const stacks = enemy.weak;
        const burst = stacks * value;
        if (burst > 0) {
          state.previousDamageDefeated = this.damageEnemy(enemyId, burst, displayName(card), card, false, 0);
          this.logEvent(`${displayName(card)} bursts ${stacks} Winded for ${burst} damage.`);
          const wbView = this.enemyView(enemy);
          floatingText(this, this.fxLayer, wbView.x, wbView.y - 90, 'Winded Burst!', '#c98bff');
          this.sparkBurst(wbView.x, wbView.y - 22, 0xc98bff, 24, 190);
        }
        enemy.weak = 0;
        this.buildFlow(state);
        break;
      }
      case 'applyWinded': {
        if (parsed.args[0] === 'flock') {
          this.flock.weak += value;
          this.logEvent(`${displayName(card)} leaves the flock Winded.`);
          floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 46, 'Winded', '#c98bff');
          this.windedFx(FLOCK_FX_X, FLOCK_FX_Y);
          break;
        }
        const enemy = this.getLivingEnemy(enemyId);
        if (!enemy) break;
        enemy.weak += value;
        this.logEvent(`${enemy.name} is Winded.`);
        const awView = this.enemyView(enemy);
        floatingText(this, this.fxLayer, awView.x, awView.y - 70, 'Winded', '#c98bff');
        this.windedFx(awView.x, awView.y);
        this.triggerTalonPinnedOpening(enemy);
        break;
      }
      case 'removeCover': {
        const enemy = this.getLivingEnemy(enemyId);
        if (!enemy) break;
        const hadCover = enemy.block > 0;
        const removed = Math.min(enemy.block, value);
        enemy.block -= removed;
        this.logEvent(`${displayName(card)} strips ${removed} Cover from ${enemy.name}.`);
        const rcView = this.enemyView(enemy);
        floatingText(this, this.fxLayer, rcView.x, rcView.y - 84, `-${removed} Cover`, '#8df4ff');
        this.coverImpactFx(rcView.x, rcView.y, 0x8df4ff);
        if (hadCover && enemy.block <= 0) this.checkEnemyCoverBrokenMarks();
        break;
      }
      case 'enterMolt':
        this.enterMolt(displayName(card));
        break;
      case 'gainOpenSkyGuard':
        this.flock.openSkyGuard += value;
        this.logEvent(`Open Sky Guard rises by ${value}.`);
        break;
      case 'returnDiscard':
        this.returnDiscardToHand(parsed.args[0], parseEffectValue(parsed.args[1], 0));
        break;
      case 'nextCoverBonus':
        this.pendingNestCoverBonus += value;
        this.logEvent(`Next Nest Cover gains +${value}.`);
        break;
      case 'retainHand':
        this.pendingRetainHand += value;
        this.logEvent(`${displayName(card)} retains ${value} card${value === 1 ? '' : 's'} for next turn.`);
        break;
      case 'nextTurnDraw':
        this.nextTurnDrawBonus += value;
        this.logEvent(value >= 0
          ? `Next turn draw gains +${value}.`
          : `Next turn draw loses ${Math.abs(value)}.`);
        break;
      case 'gainEnergyNextTurn':
        this.nextTurnEnergyBonus += value;
        this.logEvent(`${displayName(card)} banks +${value} Wingbeat for next turn.`);
        break;
      case 'enemyNextAttackBonus': {
        const enemy = this.enemies.find((candidate) => candidate.hp > 0);
        if (!enemy) break;
        enemy.nextAttackBonus += value;
        this.logEvent(`${displayName(card)} gives ${enemy.name} +${value} next damage.`);
        const view = this.enemyView(enemy);
        floatingText(this, this.fxLayer, view.x, view.y - 92, `+${value} dmg`, '#ff9d6b');
        this.sparkBurst(view.x, view.y - 28, 0xff9d6b, 12, 130);
        break;
      }
      case 'enemyGainCover': {
        const enemy = this.enemies.find((candidate) => candidate.hp > 0);
        if (!enemy) break;
        this.giveEnemyCover(enemy, value, displayName(card), 'shields');
        break;
      }
      case 'shuffleSelfToDraw':
        state.returnSelfToDraw = true;
        this.logEvent(`${displayName(card)} tangles back into the draw pile.`);
        break;
      case 'exhaustSelf':
        state.exhaustSelf = true;
        break;
    }
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
    if (this.flock.flow < this.flock.flowMax) this.flock.flow += 1;
    this.logEvent(`Four-Suit Rally: ${suit} adds +1 Flow.`);
    floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 54, '+1 Flow', '#ffe1a3');
  }

  private triggerTalonPinnedOpening(enemy: Enemy) {
    if (!this.leaderSignatureAvailable('talon', 'firstWinded')) return;
    this.markLeaderSignature('firstWinded');
    const damage = Math.min(2, enemy.hp);
    enemy.hp = Math.max(0, enemy.hp - damage);
    this.statDealt += damage;
    this.logEvent(`Pinned Opening hits ${enemy.name} for ${damage}.`);
    const view = this.enemyView(enemy);
    floatingText(this, this.fxLayer, view.x, view.y - 92, `+${damage}`, '#ffce6b');
    if (enemy.hp <= 0) {
      this.statDefeated += 1;
      this.normalizeSelectedEnemy();
    }
  }

  private triggerRoostkeeperPerfectBrace(blocked: number, damage: number) {
    if (!this.leaderSignatureAvailable('roostkeeper', 'perfectBrace') || blocked <= 0 || damage > 0) return;
    this.markLeaderSignature('perfectBrace');
    if (this.flock.flow < this.flock.flowMax) this.flock.flow += 1;
    const counterDamage = 3;
    this.enemies
      .filter((enemy) => enemy.hp > 0)
      .forEach((enemy) => this.damageEnemy(enemy.id, counterDamage, 'Perfect Brace'));
    this.logEvent('Perfect Brace: +1 Flow and a counterstrike.');
    floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 54, '+1 Flow', '#8fd6a0');
  }

  // --- Formation state (Scatter / Hold / Surge) ------------------------------
  private flockState(): FlockState {
    return flockStateOf(this.flock);
  }

  // Press the attack: build Flow toward Surge, capped, at most once per card.
  private buildFlow(state: EffectResolutionState) {
    if (state.builtFlow) return;
    state.builtFlow = true;
    if (this.flock.flow < this.flock.flowMax) this.flock.flow += 1;
  }

  private scaledFlockStatBonus(kind: 'damage' | 'cover', area = false) {
    const raw = this.flockStats()[kind] ?? 0;
    if (raw <= 0) return 0;
    const softened = Math.ceil(raw * (area ? 0.4 : 0.65));
    return Math.max(1, softened);
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
    if (now === 'surging') {
      banner(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 64, 'Surge!', '#8df4ff');
      burst(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y, 0x8df4ff, 12);
    } else if (now === 'scattered') {
      banner(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 64, 'Scattered!', '#ff7a6e');
    } else if (prev === 'scattered') {
      this.regroupRecovery(); // Scattered → Holding/Surging: the flock pulls back together
    }
  }

  private regroupRecovery() {
    banner(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 64, 'Regroup!', '#8fd6a0');
    this.healFlock(4, 'Regroup');
  }

  private damageEnemy(enemyId: string, amount: number, source: string, card?: Card, pierceCover = false, flockDamageBonus = 0) {
    const enemy = this.getLivingEnemy(enemyId);
    if (!enemy) return false;
    let damage = amount + flockDamageBonus;
    if (this.flock.weak > 0) damage = Math.floor(damage * 0.75);
    // Formation state: Surging birds press harder, Scattered birds flail.
    const formation = this.flockState();
    if (formation === 'surging') damage += SURGE_STAT_BONUS;
    else if (formation === 'scattered') damage = Math.max(0, Math.floor(damage * 0.75));
    // Quills keystone: the first attack each turn lands +2.
    if (this.firstAttackThisTurn && this.keystoneActive('quills')) damage += 2;
    this.firstAttackThisTurn = false;
    const hadCover = enemy.block > 0;
    const blocked = pierceCover ? 0 : Math.min(enemy.block, damage);
    if (!pierceCover) {
      enemy.block -= blocked;
      damage -= blocked;
    }
    if (hadCover && enemy.block <= 0) this.checkEnemyCoverBrokenMarks();
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.hitThisTurn = true;
    this.statDealt += damage;
    if (enemy.hp <= 0) this.statDefeated += 1;
    this.logEvent(`${source} hits ${enemy.name} for ${damage}${pierceCover ? ' through Cover' : ''}.`);
    const view = this.enemyView(enemy);
    const bar = this.enemyHpBar(enemy);
    const meta = suitFxMeta(card?.runtime.suit);
    if (damage > 0) {
      this.queueEnemyMotion(enemy.id, 'hit');
      strike(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y, view.x, view.y, meta.color);
      floatingText(this, this.fxLayer, view.x, view.y - 40, `${damage}`, meta.hex);
      burst(this, this.fxLayer, view.x, view.y, meta.color, 8);
      this.sparkBurst(view.x, view.y - 18, meta.color, card ? 18 : 10, damage >= 8 ? 210 : 150);
      this.pulseRing(view.x, view.y - 18, meta.color, damage >= 8 ? 88 : 58, 420);
      if (damage >= 8) shakeCamera(this, 0.004);
      // Drain the lost segment of the enemy HP bar.
      const left = bar.x - bar.w / 2;
      const xNew = left + bar.w * Math.max(0, enemy.hp / enemy.maxHp);
      const xOld = left + bar.w * Math.min(1, (enemy.hp + damage) / enemy.maxHp);
      fadeRect(this, this.fxLayer, (xNew + xOld) / 2, bar.y, xOld - xNew, bar.h - 6, 0xffd0c9);
    } else {
      floatingText(this, this.fxLayer, view.x, view.y - 40, 'Blocked', '#9fb1c4');
      this.coverImpactFx(view.x, view.y, 0x9fb1c4);
    }
    if (enemy.hp <= 0) {
      burst(this, this.fxLayer, view.x, view.y, 0xffe1a3, 16);
      floatingText(this, this.fxLayer, view.x, view.y + 8, 'Down!', '#ffe1a3');
      this.normalizeSelectedEnemy();
    }
    return enemy.hp <= 0;
  }

  private gainBlock(amount: number, source: string, card?: Card) {
    let block = amount + this.scaledFlockStatBonus('cover');
    if (card?.runtime.suit === 'nests' && this.pendingNestCoverBonus > 0) {
      block += this.pendingNestCoverBonus;
      this.pendingNestCoverBonus = 0;
    }
    const formation = this.flockState();
    if (formation === 'surging') block += SURGE_STAT_BONUS;
    else if (formation === 'scattered') block = Math.floor(block * 0.75);
    if (this.flock.frail > 0) block = Math.max(0, Math.floor(block * 0.75));
    this.flock.block += block;
    this.logEvent(`${source} gives ${block} Cover.`);
    if (block > 0) {
      this.queueFlockMotion('brace');
      floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y, `+${block} Cover`, '#7ab8d6');
      this.coverBuildFx(card?.runtime.suit);
    }
  }

  // Plain heal restores Cohesion and is WASTED past full (Cover and Heal are
  // distinct axes). `overflowToCover` is opt-in for the one card that converts
  // overheal into Cover — it isn't the default.
  private healFlock(amount: number, source: string, overflowToCover = false) {
    const healing = amount;
    const before = this.flock.hp;
    this.flock.hp = Math.min(this.flock.maxHp, this.flock.hp + healing);
    const healed = this.flock.hp - before;
    if (healed > 0) {
      this.logEvent(`${source} restores ${healed} Cohesion.`);
      this.queueFlockMotion('heal');
      floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y, `+${healed}`, '#8fd6a0');
      this.healFx();
      this.checkHealFlockMarks();
    }
    const overheal = healing - healed;
    const signatureOverflow = !overflowToCover
      && overheal > 0
      && this.leaderSignatureAvailable('tidewarden', 'firstOverheal');
    if (signatureOverflow) this.markLeaderSignature('firstOverheal');
    if ((overflowToCover || signatureOverflow) && overheal > 0) {
      this.flock.block += overheal;
      this.logEvent(signatureOverflow
        ? `Overflow Shelter turns ${overheal} wasted healing into Cover.`
        : `${source} overflows into ${overheal} Cover.`);
      this.queueFlockMotion('brace');
      floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 22, `+${overheal} Cover`, '#7ab8d6');
      this.coverBuildFx('nests');
    }
  }

  private gainResonance(amount: number) {
    this.spark = Math.min(BASE_RESONANCE_CAP, this.spark + amount);
    this.logEvent(`The flock gains ${amount} Resonance.`);
    this.suitPulseAt(FLOCK_FX_X + 18, FLOCK_FX_Y - 38, 'plumes', `+${amount} Resonance`);
  }

  private spendResonance(amount: number) {
    if (this.spark < amount) {
      this.logEvent(`The flock needs ${amount} Resonance.`);
      return false;
    }
    this.spark -= amount;
    this.logEvent(`The flock spends ${amount} Resonance.`);
    if (this.leaderSignatureAvailable('spark_caller', 'firstResonanceSpend')) {
      this.markLeaderSignature('firstResonanceSpend');
      this.drawCards(1);
      this.logEvent('Spark Echo draws 1 card.');
      floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 54, 'Spark Echo', '#8df4ff');
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
    floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 30, 'Molt!', '#ff9d4d');
    burst(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y, 0xff9d4d, 10);
    if (!wasMolting) this.checkEnterMoltMarks();
  }

  private endTurn() {
    if (this.mode !== 'battle') {
      return;
    }

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
    if (cardsPlayedAtRoost > 0 && cardsPlayedAtRoost < OVEREXTENSION_CARD_THRESHOLD) this.statNoOverextensionTurns += 1;

    this.resolveHeldSnagEffects();

    const retainCount = Math.min(Math.max(0, this.pendingRetainHand), this.hand.length);
    const retained = retainCount > 0 ? this.hand.splice(this.hand.length - retainCount, retainCount) : [];
    this.pendingRetainHand = 0;
    while (this.hand.length > 0) {
      const card = this.hand.pop();
      if (card) this.discardPile.push(card);
    }
    if (retained.length > 0) {
      this.hand = retained;
      this.logEvent(`Retained ${retained.length} card${retained.length === 1 ? '' : 's'} for next turn.`);
    }
    this.selectedInstanceId = undefined;
    // Molting is a one-turn transform stance: it ends now, leaving the flock
    // briefly Open Sky (the cost of shedding into Molt) for the enemy's swing.
    if (this.flock.molt) {
      this.flock.molt = false;
      this.flock.exposed = true;
      this.flock.exposedTurns = 1;
      this.logEvent('The flock sheds out of Molt - Open Sky.');
    }
    this.checkRoostRestraintMarks(cardsHeldAtRoost, wingbeatAtRoost, cardsPlayedAtRoost);
    this.applyOverextensionPenalty();
    const hpBeforeEnemyTurn = this.flock.hp;
    this.resolveEnemyTurn();
    if (this.flock.hp >= hpBeforeEnemyTurn) this.checkNoDamageTurnMarks();
    this.checkOutcome();
    if (this.mode === 'battle') this.startPlayerTurn();
    this.renderAll();
  }

  private startPlayerTurn() {
    this.turn += 1;
    this.energy = 3 + this.nextTurnEnergyBonus;
    this.nextTurnEnergyBonus = 0;
    // Nests keystone: Cover carries between turns (capped) instead of fully clearing.
    this.flock.block = this.keystoneActive('nests') ? Math.min(this.flock.block, NESTS_COVER_CARRY_CAP) : 0;
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
    if ((this.flockStats().resonance ?? 0) > 0) this.gainResonance(this.flockStats().resonance ?? 0);
    this.logEvent(`Turn ${this.turn} starts.`);
    // Staggered so it follows the fading "Enemy Turn" banner rather than overlapping it.
    this.time.delayedCall(900, () => {
      if (this.mode === 'battle') banner(this, this.fxLayer, GAME_WIDTH / 2, 140, 'Your Turn', '#8fd6a0');
    });
  }

  private applyOverextensionPenalty() {
    if (this.cardsPlayedThisTurn < OVEREXTENSION_CARD_THRESHOLD || this.flock.exposed) return;
    this.flock.exposed = true;
    this.flock.exposedTurns = Math.max(this.flock.exposedTurns, 1);
    this.statOverextensions += 1;
    this.logEvent(`${this.cardsPlayedThisTurn} cards overextend the formation - Open Sky.`);
    if (this.fxLayer?.active) {
      floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 50, 'Overextended!', '#ff9d4d');
      this.pulseRing(FLOCK_FX_X, FLOCK_FX_Y - 20, 0xff9d4d, 92, 580);
    }
  }

  private resolveEnemyTurn() {
    const attackers = this.enemies.filter((candidate) => candidate.hp > 0);
    if (attackers.length === 0) return;

    banner(this, this.fxLayer, GAME_WIDTH / 2, 140, 'Enemy Turn', '#ff9d6b');
    this.enemies.forEach((enemy) => { enemy.block = 0; });

    // Each living enemy telegraphs and resolves its own move, in board order.
    for (const enemy of attackers) {
      if (enemy.hp <= 0 || this.flock.hp <= 0) continue;
      enemyMoveContext = this.enemyContext(); // branch on live state per attacker
      const move = currentMove(enemy);
      for (const effect of move.effects) {
        if (this.flock.hp <= 0) break;
        this.resolveEnemyEffect(enemy, effect);
      }
      // Advance the move counter; currentMove() maps it through the attack pattern.
      enemy.intentIndex += 1;
      if (this.flock.hp <= 0) break;
    }

    // Open Sky ticks down once per enemy phase, after every attacker resolves.
    if (this.flock.exposed && this.flock.exposedTurns > 0) {
      this.flock.exposedTurns -= 1;
      if (this.flock.exposedTurns <= 0) this.flock.exposed = false;
    }
  }

  private resolveEnemyEffect(enemy: Enemy, effectText: string) {
    // Capture the full condition expression (lazily, up to the first " then ")
    // so the `turn >= N` comparison form is honored, not just bare names.
    const conditional = effectText.match(/^if (.+?) then (.+)$/);
    if (conditional) {
      if (!this.checkEnemyCondition(conditional[1], enemy)) return;
      this.resolveEnemyEffect(enemy, conditional[2]);
      return;
    }

    const parsed = parseEffect(effectText);
    if (!parsed) return;

    const value = parseEffectValue(parsed.args[1] ?? parsed.args[0], 0);
    switch (parsed.name) {
      case 'damage':
        this.damageFlock(enemy, value);
        break;
      case 'gainCover':
        this.boostEnemyAttack(enemy, value, enemy.name);
        break;
      case 'heal':
        this.healEnemy(enemy, value, enemy.name, 'scavenges');
        break;
      case 'healAlly':
        this.healEnemy(this.supportTargetEnemy(enemy, parsed.args[0]) ?? enemy, value, enemy.name, 'patches');
        break;
      case 'healAllEnemies':
        for (const target of this.enemies.filter((candidate) => candidate.hp > 0)) {
          this.healEnemy(target, value, enemy.name, 'rallies');
        }
        break;
      case 'gainCoverAlly':
        this.giveEnemyCover(this.supportTargetEnemy(enemy, parsed.args[0]) ?? enemy, value, enemy.name, 'screens');
        break;
      case 'gainCoverAllEnemies':
        for (const target of this.enemies.filter((candidate) => candidate.hp > 0)) {
          this.giveEnemyCover(target, value, enemy.name, 'screens');
        }
        break;
      case 'nextAttackBonusAlly':
        this.boostEnemyAttack(this.supportTargetEnemy(enemy, parsed.args[0]) ?? enemy, value, enemy.name);
        break;
      case 'applyWinded':
        this.flock.weak += value;
        this.logEvent(`${enemy.name} knocks the flock Winded.`);
        floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 30, 'Winded', '#c98bff');
        this.windedFx(FLOCK_FX_X, FLOCK_FX_Y);
        break;
      case 'loseWingbeat':
        this.energy = Math.max(0, this.energy - value);
        this.logEvent(`${enemy.name} taxes ${value} Wingbeat.`);
        floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 44, `-${value} Wingbeat`, '#ffcf7a');
        this.sparkBurst(FLOCK_FX_X, FLOCK_FX_Y - 14, 0xffcf7a, 10, 110);
        break;
      case 'applyFrail':
        this.flock.frail += value;
        this.logEvent(`${enemy.name} ruffles the flock — Cover weakened.`);
        floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 30, 'Ruffled', '#ff9d6b');
        this.sparkBurst(FLOCK_FX_X, FLOCK_FX_Y - 10, 0xff9d6b, 12, 120);
        break;
      case 'applyOpenSky':
        this.flock.exposed = true;
        this.flock.exposedTurns = Math.max(this.flock.exposedTurns, value);
        this.logEvent(`${enemy.name} throws the flock into Open Sky.`);
        floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 50, 'Open Sky!', '#ff9d4d');
        this.pulseRing(FLOCK_FX_X, FLOCK_FX_Y - 20, 0xff9d4d, 92, 580);
        this.sparkBurst(FLOCK_FX_X, FLOCK_FX_Y - 20, 0xff9d4d, 20, 155);
        break;
      case 'applyPoison':
        this.flock.fouled += value;
        this.logEvent(`${enemy.name} fouls the flock for ${value}.`);
        floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 58, `Fouled ${value}`, '#8bd2a0');
        this.sparkBurst(FLOCK_FX_X, FLOCK_FX_Y - 8, 0x8bd2a0, 14, 130);
        break;
      case 'addSnagToDiscard': {
        const snagId = parsed.args[0];
        if (snagId && cardLibrary[snagId]) {
          discoverCards([snagId]);
          this.discardPile.push(cloneCard(snagId));
          this.logEvent(`${enemy.name} tangles the route — ${cardLibrary[snagId].runtime.displayName} drops into your discard.`);
        }
        break;
      }
      case 'addSnagToDraw': {
        const snagId = parsed.args[0];
        if (snagId && cardLibrary[snagId]) {
          discoverCards([snagId]);
          const at = Math.floor(Math.random() * (this.drawPile.length + 1));
          this.drawPile.splice(at, 0, cloneCard(snagId));
          this.logEvent(`${enemy.name} fouls your draw with ${cardLibrary[snagId].runtime.displayName}.`);
        }
        break;
      }
      case 'nextAttackBonus':
        enemy.nextAttackBonus += value;
        this.logEvent(`${enemy.name} lines up +${value} damage.`);
        break;
    }
  }

  // The closed enemy/pattern condition set (next-level-data-contracts §1.3),
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
        return allies[Math.floor(Math.random() * allies.length)];
      case 'lowest':
      default:
        return [...allies].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    }
  }

  private healEnemy(target: Enemy, amount: number, sourceName: string, verb: string) {
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    const healed = target.hp - before;
    this.logEvent(`${sourceName} ${verb} ${target.name} for ${healed} health.`);
    if (healed <= 0) return;
    const view = this.enemyView(target);
    this.pulseRing(view.x, view.y - 12, 0x8fd6a0, 58, 440);
    this.sparkBurst(view.x, view.y - 12, 0x8fd6a0, 10, 95);
    floatingText(this, this.fxLayer, view.x, view.y - 74, `+${healed}`, '#8fd6a0');
  }

  private giveEnemyCover(target: Enemy, amount: number, sourceName: string, verb: string) {
    target.block += amount;
    this.logEvent(`${sourceName} ${verb} ${target.name} for ${amount} Cover.`);
    const view = this.enemyView(target);
    this.coverImpactFx(view.x, view.y, 0x7ab8d6);
    floatingText(this, this.fxLayer, view.x, view.y - 74, `+${amount} Cover`, '#7ab8d6');
  }

  private boostEnemyAttack(target: Enemy, amount: number, sourceName: string) {
    target.nextAttackBonus += amount;
    this.logEvent(`${sourceName} marks ${target.name} for +${amount} damage.`);
    const view = this.enemyView(target);
    floatingText(this, this.fxLayer, view.x, view.y - 84, `+${amount} damage`, '#ffcf7a');
    this.sparkBurst(view.x, view.y - 20, 0xffcf7a, 10, 120);
  }

  private tickFouled() {
    if (this.flock.fouled <= 0) return;
    const damage = this.flock.fouled;
    this.flock.hp = Math.max(0, this.flock.hp - damage);
    this.flock.fouled = Math.max(0, this.flock.fouled - 1);
    this.statTaken += damage;
    this.flock.flow = 0;
    this.logEvent(`Fouled pressure costs ${damage} Cohesion.`);
    this.queueFlockMotion('hit');
    floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 8, `-${damage} Fouled`, '#8bd2a0');
    this.sparkBurst(FLOCK_FX_X, FLOCK_FX_Y + 18, 0x8bd2a0, 14, 130);
    this.checkOutcome();
  }

  private checkEnemyCondition(condition: string, enemy: Enemy) {
    return evaluateEnemyCondition(condition, enemy, this.enemyContext());
  }

  private enemyContext(): EnemyMoveContext {
    return { flock: this.flock, turn: this.turn, c: this.roostCards, z: this.roostFree, h: this.roostHeld };
  }

  private incomingAttackDamage(enemy: Enemy) {
    // Incoming damage is the sum of the current move's damage(flock, N) effects.
    return currentMove(enemy).effects.reduce((total, effect) => {
      const parsed = parseEffect(effect);
      if (!parsed || parsed.name !== 'damage') return total;
      return total + parseEffectValue(parsed.args[1] ?? parsed.args[0], 0) + enemy.nextAttackBonus + enemy.damageBonus;
    }, 0);
  }

  private incomingFlockDamagePreview() {
    const damages = this.enemies
      .filter((enemy) => enemy.hp > 0)
      .map((enemy) => this.incomingAttackDamage(enemy))
      .filter((damage) => damage > 0);
    const total = damages.reduce((sum, damage) => sum + damage, 0);
    const blocked = Math.min(this.flock.block, total);
    const hpLoss = Math.max(0, total - blocked);
    return {
      total,
      blocked,
      hpLoss,
      afterHp: Math.max(0, this.flock.hp - hpLoss),
      attackers: damages.length,
    };
  }

  private incomingNextAttackDamage() {
    const nextAttacker = this.enemies
      .filter((enemy) => enemy.hp > 0)
      .find((enemy) => moveDealsDamage(currentMove(enemy)));
    return nextAttacker ? this.incomingAttackDamage(nextAttacker) : 0;
  }

  private damageFlock(enemy: Enemy, amount: number) {
    this.queueEnemyMotion(enemy.id, 'attack');
    const mods = difficultyMods(this.runDifficulty);
    let damage = amount + enemy.nextAttackBonus + enemy.damageBonus + mods.enemyDamageBonus;
    enemy.nextAttackBonus = 0;
    if (enemy.weak > 0) damage = Math.floor(damage * 0.75);
    if (this.flock.exposed) {
      const guarded = this.flock.openSkyGuard > 0;
      if (guarded) {
        this.flock.openSkyGuard -= 1;
      } else {
        let openSky = mods.openSkyBonus;
        // quiet_landing Waymark: soften the first Open Sky increase each combat.
        if (!this.markFirstOpenSkyConsumed) {
          const reduce = this.markValue('firstOpenSkyIncrease', 'reduceOpenSky');
          if (reduce > 0) {
            openSky = Math.max(0, openSky - reduce);
            this.markFirstOpenSkyConsumed = true;
            this.logEvent('Quiet Landing softens the open sky.');
            this.applyMarkTrigger('firstOpenSkyIncrease');
          }
        }
        damage += openSky;
      }
    }
    const blocked = Math.min(this.flock.block, damage);
    this.flock.block -= blocked;
    damage -= blocked;
    this.flock.hp = Math.max(0, this.flock.hp - damage);
    this.statBlocked += blocked;
    this.statTaken += damage;
    this.logEvent(`${enemy.name} hits the flock for ${damage}.`);
    this.triggerRoostkeeperPerfectBrace(blocked, damage);
    // An unblocked hit shatters formation Flow; damage fully absorbed by Cover
    // keeps the flock together (Cover earns a second job: holding formation).
    if (damage > 0) this.flock.flow = 0;
    if (damage > 0) {
      this.queueFlockMotion('hit');
      const from = this.enemyView(enemy);
      strike(this, this.fxLayer, from.x, from.y, FLOCK_FX_X, FLOCK_FX_Y, 0xff7a6e);
      floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 8, `-${damage}`, '#ff7a6e');
      this.sparkBurst(FLOCK_FX_X, FLOCK_FX_Y + 32, 0xff9d6b, 16, 155);
      shakeCamera(this, 0.005);
      // Drain the lost segment of the Cohesion bar.
      const left = FLOCK_HP_BAR.x - FLOCK_HP_BAR.w / 2;
      const xNew = left + FLOCK_HP_BAR.w * Math.max(0, this.flock.hp / this.flock.maxHp);
      const xOld = left + FLOCK_HP_BAR.w * Math.min(1, (this.flock.hp + damage) / this.flock.maxHp);
      fadeRect(this, this.fxLayer, (xNew + xOld) / 2, FLOCK_HP_BAR.y, xOld - xNew, FLOCK_HP_BAR.h - 6, 0xffd0c9);
    } else {
      this.queueFlockMotion('brace');
      floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 8, 'Blocked', '#7ab8d6');
      this.coverImpactFx(FLOCK_FX_X, FLOCK_FX_Y, 0x7ab8d6);
    }
  }

  private chooseRewardCard(cardId: string) {
    const reward = this.rewardChoices.find((card) => card.id === cardId);
    if (!reward) return;
    if (this.hasCardInDeck(reward.id)) {
      this.logEvent(`${displayName(reward)} is already in the deck.`);
      this.rewardChoices = [];
      this.resolvePostCardReward();
      return;
    }
    this.discardPile.push(cloneCard(reward.id));
    this.logEvent(`${displayName(reward)} joins the flock.`);
    this.applyFlockStats(false);
    this.runRewardEvents.push({ offered: this.rewardChoices.map((card) => card.id), picked: reward.id, skipped: false });
    this.rewardChoices = [];
    this.resolvePostCardReward();
  }

  // Decline the card reward intentionally; take a small Scrap fallback instead
  // (next-level-implementation-spec "rewards support skip or fallback decisions").
  private skipCardReward() {
    const skipScrap = this.currentSkipScrapReward();
    this.runRewardEvents.push({ offered: this.rewardChoices.map((card) => card.id), skipped: true, fallback: 'scrap' });
    this.scrap += skipScrap;
    this.logEvent(`Skipped the card reward for +${skipScrap} Scrap.`);
    this.rewardChoices = [];
    this.resolvePostCardReward();
  }

  private currentSkipScrapReward() {
    return getMapBalanceProfile(currentMap().id, currentMap().index).economy.skipScrap ?? DEFAULT_REWARD_SKIP_SCRAP;
  }

  private beginPostCombatRewards() {
    this.fxLayer.removeAll(true);
    this.applyCombatEconomyRewards();
    this.waymarkChoices = this.createWaymarkRewardChoices();
    if (this.waymarkChoices.length > 1) {
      this.mode = 'waymarkReward';
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
    this.rewardChoices = this.createRewardChoices();
    if (this.rewardChoices.length > 0) {
      this.mode = 'cardReward';
    } else {
      this.logEvent('No new crew cards remain.');
      this.resolvePostCardReward();
      return;
    }
    this.renderAll();
  }

  private chooseWaymarkReward(markId: string) {
    this.claimWaymarkReward(markId);
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
    this.upgradeChoices = this.shouldOfferUpgradeReward() ? this.createUpgradeChoices() : [];
    if (this.upgradeChoices.length > 0) {
      this.mode = 'upgradeReward';
      this.renderAll();
      return;
    }
    this.logEvent('No Preen window at this crossing.');
    this.returnToRouteMap();
  }

  private chooseUpgradeCard(cardId: string) {
    const card = this.allDeckCards().find((candidate) => candidate.id === cardId && !candidate.upgraded);
    if (card) {
      card.upgraded = true;
      this.logEvent(`${displayName(card)} is preened.`);
    }
    this.upgradeChoices = [];
    this.returnToRouteMap();
  }

  private returnToRouteMap() {
    const completedNodeId = currentCombatNodes()[this.currentRouteIndex]?.id;
    if (completedNodeId && !this.completedRouteNodeIds.includes(completedNodeId)) {
      this.completedRouteNodeIds.push(completedNodeId);
    }

    if (completedNodeId === currentMap().bossNodeId) {
      // Final district boss → run complete; otherwise advance to the next district.
      if (activeMapIndex >= alphaMaps.length - 1) {
        this.mode = 'runComplete';
        this.emitRunSummary('win');
        this.renderAll();
        return;
      }
      const advanceState = this.createRouteReturnState(completedNodeId);
      this.applyMapStartMarks(); // reopened_roofline-style Waymarks stock the next district
      advanceState.supplies = [...this.runSupplies];
      advanceState.freePreenNextDistrict = this.freePreenNextDistrict;
      advanceState.mapIndex = activeMapIndex + 1;
      advanceState.currentRouteNodeId = undefined;
      this.logEvent(`${currentMap().name} cleared — onward to ${alphaMaps[activeMapIndex + 1].name}.`);
      this.scene.start('RouteScene', { runState: advanceState });
      return;
    }

    const runState = this.createRouteReturnState(completedNodeId);
    this.scene.start('RouteScene', { runState });
  }

  private createRouteReturnState(completedNodeId: string | undefined): RunState {
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
    if (!this.combatRouteMarkResolved) {
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
      leaderId: this.runLeaderId,
      difficulty: this.runDifficulty,
      seed: activeSeed,
      currentHp: Math.min(this.flock.maxHp, this.flock.hp + POST_COMBAT_RECOVERY),
      scrap: this.scrap,
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
    return Object.keys(mods).length > 0 ? mods : undefined;
  }

  private currentCombatResult(routeNode: RouteNode | undefined, nodeId: string): CombatResultSummary {
    const isBossEntry = routeNode?.type === 'boss';
    return {
      encounterId: routeNode?.payloadId ?? '',
      nodeId,
      nodeType: routeNode?.type ?? 'street',
      enemyIds: this.enemies.map((enemy) => enemy.runtime.id),
      turnsTaken: this.turn,
      damageDealt: this.statDealt,
      cohesionLost: this.statTaken,
      killedByMove: this.flock.hp <= 0 ? this.enemies.find((enemy) => enemy.hp > 0)?.name : undefined,
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
    this.combatScrapAwarded = scrapReward + streetBonus - overextensionTax;
    this.scrap += this.combatScrapAwarded;
    this.combatEconomyAwarded = true;
    this.logEvent(`Recovered +${this.combatScrapAwarded} Scrap.`);
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

  private drawToHandSize() {
    const plumesKeystone = this.keystoneActive('plumes') && this.runLeaderId !== 'spark_caller' ? 1 : 0; // Spark gets its draw from Spark Echo instead.
    this.drawCards(Math.max(0, BASE_HAND_TARGET + plumesKeystone + (this.flockStats().draw ?? 0) + this.nextTurnDrawBonus - this.hand.length));
    this.nextTurnDrawBonus = 0;
  }

  private drawCards(count: number) {
    let drawn = 0;
    for (let i = 0; i < count; i += 1) {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break;
        this.reshuffleDiscardIntoDraw();
      }
      const card = this.drawPile.shift();
      if (card) { this.hand.push(card); drawn += 1; }
    }
    if (drawn > 0) this.animateDraw(drawn);
  }

  private reshuffleDiscardIntoDraw() {
    this.drawPile = this.discardPile.splice(0);
    shuffle(this.drawPile);
    this.animateShuffle();
  }

  // Pile anchor positions (Draw = ribbon chip 1, Discard = chip 2).
  private drawPilePos() { return { x: 88, y: 600 }; }     // lower-left
  private discardPilePos() { return { x: 1192, y: 600 }; } // lower-right

  // Center-x of a hand slot, matching renderHand's dynamic layout.
  private handSlotCenterX(index: number) {
    const n = this.hand.length;
    const minLeft = 142;
    const maxRight = 1140;
    const avail = maxRight - minLeft;
    const spacing = n > 1 ? Math.min(CARD_W + 12, (avail - CARD_W) / (n - 1)) : 0;
    const totalW = (n - 1) * spacing + CARD_W;
    const startX = minLeft + Math.max(0, (avail - totalW) / 2);
    return Math.round(startX + index * spacing) + CARD_W / 2;
  }

  // Cards flick from the draw pile to their new hand slots.
  private animateDraw(count: number) {
    if (!this.fxLayer) return; // init draws before create() — no FX yet
    const from = this.drawPilePos();
    const handN = this.hand.length;
    for (let i = 0; i < count; i += 1) {
      const slot = handN - count + i;
      const targetX = this.handSlotCenterX(slot);
      const back = this.add.rectangle(from.x, from.y, CARD_W * 0.42, CARD_H * 0.42, 0x16243c, 0.96).setStrokeStyle(2, 0x7ab8d6, 1);
      this.fxLayer.add(back);
      this.tweens.add({
        targets: back, x: targetX, y: HAND_Y, scaleX: 2.4, scaleY: 2.4, alpha: 0,
        duration: 260, delay: i * 65, ease: 'Cubic.easeOut', onComplete: () => back.destroy(),
      });
    }
  }

  // A flurry of cards sweeps from the discard pile back into the draw pile.
  private animateShuffle() {
    if (!this.fxLayer) return;
    banner(this, this.fxLayer, 360, 122, 'Shuffle!', '#7ab8d6');
    const from = this.discardPilePos();
    const to = this.drawPilePos();
    for (let i = 0; i < 6; i += 1) {
      const b = this.add.rectangle(from.x, from.y, 30, 42, 0x16243c, 0.92).setStrokeStyle(1, 0x7ab8d6, 0.9);
      this.fxLayer.add(b);
      this.tweens.add({
        targets: b, x: to.x, y: to.y, angle: 200, alpha: 0,
        duration: 340, delay: i * 45, ease: 'Cubic.easeInOut', onComplete: () => b.destroy(),
      });
    }
  }

  private discardRightmostCard() {
    const card = this.hand.pop();
    if (card) {
      this.discardPile.push(card);
      this.logEvent(`${displayName(card)} discarded.`);
    }
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
    return discarded;
  }

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
  }

  private moveCardFromHandToDiscard(instanceId: string) {
    const index = this.hand.findIndex((card) => card.instanceId === instanceId);
    if (index >= 0) {
      const [card] = this.hand.splice(index, 1);
      this.discardPile.push(card);
    }
  }

  private moveCardFromHandToDraw(instanceId: string) {
    const index = this.hand.findIndex((card) => card.instanceId === instanceId);
    if (index >= 0) {
      const [card] = this.hand.splice(index, 1);
      this.addCardToDrawRandom(card);
    }
  }

  private removeCardFromHand(instanceId: string) {
    const index = this.hand.findIndex((card) => card.instanceId === instanceId);
    if (index < 0) return undefined;
    const [card] = this.hand.splice(index, 1);
    return card;
  }

  private addCardToDrawRandom(card: Card) {
    const at = Math.floor(Math.random() * (this.drawPile.length + 1));
    this.drawPile.splice(at, 0, card);
  }

  private effectiveCost(card: Card) {
    if (this.flock.molt && card.type !== 'molt') {
      return Math.max(0, card.cost - 1);
    }
    return card.cost;
  }

  private checkOutcome() {
    if (this.enemies.every((enemy) => enemy.hp <= 0)) {
      if (this.mode === 'battle') {
        this.beginPostCombatRewards();
        this.logEvent('The rooftop is clear.');
        return;
      }
    } else if (this.flock.hp <= 0) {
      this.mode = 'defeat';
      this.emitRunSummary('loss');
      this.logEvent('The flock scatters.');
    }
  }

  // Emit a local run-summary artifact (localStorage + window) so playtests are
  // observable (next-level-implementation-spec Phase 5).
  private emitRunSummary(result: 'win' | 'loss') {
    const currentNode = currentCombatNodes()[this.currentRouteIndex];
    const finalNodeId =
      this.completedRouteNodeIds[this.completedRouteNodeIds.length - 1] ??
      currentNode?.id ??
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
      bossEntryCohesion: undefined as number | undefined,
      bossEntryScrap: undefined as number | undefined
    });
    const summary: RunSummary = {
      id: `run-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      seed: activeSeed,
      result,
      leaderId: this.runLeaderId,
      difficulty: this.runDifficulty,
      mapId: currentMap().id,
      finalNodeId,
      killedBy: result === 'loss' ? this.enemies.find((enemy) => enemy.hp > 0)?.name : undefined,
      turnsTaken: this.turn,
      currentCohesion: this.flock.hp,
      maxCohesion: this.flock.maxHp,
      scrapEarned: this.scrap,
      scrapSpent: 0,
      path: [...this.completedRouteNodeIds],
      deck: saveCards(this.allDeckCards()),
      routeMarks: [...this.routeMarks],
      suppliesUsed: [...this.runSuppliesUsed],
      signals: [...this.runSignalChoices],
      cardRewards: [...this.runRewardEvents],
      combatResults,
      decisionStats
    };
    window.__birdSquadLastRun = summary;
    clearActiveRun(); // the run is over — no longer resumable
    if (result === 'win') unlockTier(this.runDifficulty + 1); // clearing tier N unlocks N+1
    // Meta-progression: record the run, unlock Leaders / achievements.
    this.lastRunRewards = recordRun({
      result,
      leaderId: this.runLeaderId ?? 'fledgling',
      difficulty: this.runDifficulty,
      cohesion: this.flock.hp,
      maxCohesion: this.flock.maxHp,
      turns: this.turn,
      deckSize: this.allDeckCards().filter((card) => card.runtime.kind !== 'snag').length,
    });
    try {
      const key = 'birdsquad.runs';
      const prior = JSON.parse(window.localStorage.getItem(key) ?? '[]') as RunSummary[];
      prior.push(summary);
      window.localStorage.setItem(key, JSON.stringify(prior.slice(-50)));
    } catch {
      // localStorage may be unavailable (private mode / headless); window copy still set.
    }
  }

  private createRewardChoices() {
    const owned = new Set(this.allDeckCards().map((card) => card.id));
    const remaining = arcanaRewardPool.filter((id) => !owned.has(id));
    // Rarity-weighted draw without replacement: legendaries/rares appear, but
    // commons/uncommons dominate the offered choices (count narrows at higher tiers).
    const maxChoices = difficultyMods(this.runDifficulty).rewardChoices;
    const weightOf = (id: string) => REWARD_RARITY_WEIGHT[cardLibrary[id]?.runtime.rarity ?? 'common'] ?? 50;
    const chosen: string[] = [];
    while (chosen.length < maxChoices && remaining.length > 0) {
      const total = remaining.reduce((sum, id) => sum + weightOf(id), 0);
      let roll = Math.random() * total;
      let index = 0;
      for (; index < remaining.length - 1; index += 1) {
        roll -= weightOf(remaining[index]);
        if (roll <= 0) break;
      }
      chosen.push(remaining.splice(index, 1)[0]);
    }
    discoverCards(chosen); // offered cards count as "found" in the Codex
    return chosen.map((id) => cloneCard(id));
  }

  private createUpgradeChoices() {
    const candidates = this.allDeckCards().filter((card) => !card.upgraded);
    shuffle(candidates);
    return candidates.slice(0, 3);
  }

  private shouldOfferUpgradeReward() {
    const routeNode = currentCombatNodes()[this.currentRouteIndex];
    const profile = rewardProfileForRouteNode(routeNode);
    if (!profile || this.allDeckCards().every((card) => card.upgraded)) return false;
    if (routeNode?.type === 'rival' || routeNode?.type === 'boss') return true;
    if (profile.preenGuaranteed || (profile.preen ?? 0) > 0) return true;
    if (!profile.preenChance) return false;
    return deterministicChance(`${activeSeed}:${routeNode?.id ?? 'combat'}:preen`, profile.preenChance);
  }

  private allDeckCards() {
    return [...this.drawPile, ...this.discardPile, ...this.hand];
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
    this.log.push(message);
    this.log = this.log.slice(-8);
  }

  private getTextState(): RenderPayload {
    const battlefield = this.currentBattlefieldAsset();
    const districtBattlefield = BATTLEFIELD_ASSETS[currentMap().id] ?? DEFAULT_BATTLEFIELD_ASSET;
    return {
      mode: this.mode,
      scene: 'BattleScene',
      encounter: this.encounter,
      turn: this.turn,
      energy: this.energy,
      resonance: this.spark,
      overextension: {
        cardsPlayedThisTurn: this.cardsPlayedThisTurn,
        threshold: OVEREXTENSION_CARD_THRESHOLD,
        safeCardsRemaining: Math.max(0, OVEREXTENSION_CARD_THRESHOLD - 1 - this.cardsPlayedThisTurn),
        currentlyExposed: this.flock.exposed
      },
      selectedCard: this.selectedInstanceId,
      inspectedCard: this.getInspectedCardPayload(),
      selectedEnemy: this.selectedEnemyId,
      deckIds: this.allDeckCards().map((card) => card.id),
      drawPile: this.drawPile.length,
      discardPile: this.discardPile.length,
      deckSize: this.allDeckCards().length,
      flock: {
        hp: this.flock.hp,
        maxHp: this.flock.maxHp,
        block: this.flock.block,
        fouled: this.flock.fouled,
        incoming: this.incomingFlockDamagePreview(),
        statuses: flockStatuses(this.flock)
      },
      hand: this.hand.map((card) => {
        const contract = this.activeCardContract(card);
        return {
          instanceId: card.instanceId,
          id: card.id,
          name: displayName(card),
          bird: card.bird,
          cost: this.effectiveCost(card),
          type: card.type,
          role: card.role,
          target: card.target,
          activeTarget: contract.target,
          activeRole: contract.role,
          activeText: contract.text,
          usesMolt: contract.usesMolt
        };
      }),
      waymarkChoices: this.waymarkChoices.map((mark) => ({
        id: mark.id,
        name: mark.name,
        family: mark.family,
        rarity: mark.rarity,
        source: mark.source,
        description: mark.description,
        tags: waymarkSynergyTags(mark)
      })),
      rewardChoices: this.rewardChoices.map((card) => ({
        id: card.id,
        name: displayName(card),
        bird: card.bird,
        cost: card.cost,
        type: card.type,
        target: card.target
      })),
      upgradeChoices: this.upgradeChoices.map((card) => ({
        id: card.id,
        name: displayName(card),
        bird: card.bird,
        cost: card.cost,
        type: card.type,
        target: card.target
      })),
      enemies: this.enemies.map((enemy) => ({
        id: enemy.id,
        name: enemy.name,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        block: enemy.block,
        weak: enemy.weak,
        roles: enemy.roles,
        solo: enemy.solo,
        damageBonus: enemy.damageBonus,
        intent: currentMove(enemy).label
      })),
      route: {
        mapId: currentMap().id,
        mapName: currentMap().name,
        currentNodeId: currentCombatNodes()[this.currentRouteIndex]?.id ?? '',
        currentPayloadId: currentCombatNodes()[this.currentRouteIndex]?.payloadId ?? '',
        completedNodeIds: [...this.completedRouteNodeIds],
        scrap: this.scrap,
        routeMarks: [...this.routeMarks],
        supplies: [...this.runSupplies],
        battlefieldAssetKey: battlefield.key,
        battlefieldVariant: battlefield.key !== districtBattlefield.key,
        battlefieldMood: this.battlefieldMood()
      },
      inspectOverlay: this.inspectOverlay,
      waymarkDrawerOpen: this.waymarkDrawerOpen,
      supplyDrawerOpen: this.supplyDrawerOpen,
      waymarkFeedback: [...this.waymarkFeedback],
      supplyFeedback: [...this.supplyFeedback],
      piles: {
        deck: this.drawPile.length,
        hand: this.hand.length,
        discard: this.discardPile.length
      },
      flockStats: this.flockStatRows().map((row) => ({
        label: row.label,
        base: row.base,
        flock: row.bonus,
        current: row.total
      })),
      log: this.log.slice(-5)
    };
  }

  private getInspectedCardPayload() {
    if (!this.inspectOverlay || this.inspectOverlay === 'flock') return undefined;
    const entry = this.getInspectedCardEntry(
      this.inspectOverlay === 'deck'
        ? this.deckReviewCards()
        : this.inspectOverlay === 'draw'
          ? this.drawPile.map((card) => ({ card, zone: 'Deck' }))
          : this.discardPile.map((card) => ({ card, zone: 'Discard' }))
    );
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
        value
      }))
    };
  }

  private flockStatRows() {
    return buildFlockStatRows(this.allDeckCards(), this.flock.maxHp, this.nextTurnEnergyBonus, this.flock.openSkyGuard);
  }
}

function createFlock(): Flock {
  return {
    hp: 36,
    maxHp: 36,
    block: 0,
    weak: 0,
    frail: 0,
    fouled: 0,
    exposed: false,
    exposedTurns: 0,
    molt: false,
    openSkyGuard: 0,
    flow: 0,
    flowMax: 5
  };
}

function selectedCombatRouteNode(routeNodeId: string | undefined) {
  if (routeNodeId) {
    const routeNode = currentCombatNodes().find((node) => node.id === routeNodeId);
    if (routeNode) return routeNode;
  }
  return currentCombatNodes()[0];
}

function createEncounterEnemy(encounter: number): Enemy {
  return createEncounterEnemiesForRouteNode(currentCombatNodes()[Math.min(encounter - 1, currentCombatNodes().length - 1)])[0];
}

// Build every enemy an encounter declares (its enemies[] array). When the same
// enemy id appears more than once, each instance gets a unique id ("roof_rat#0")
// and a disambiguating display suffix ("Roof Rat A") so targeting/selection and
// per-enemy state stay independent.
function createEncounterEnemiesForRouteNode(routeNode: RouteNode): Enemy[] {
  const runtimes = getEncounterEnemiesByPayload(routeNode.payloadId);
  const solo = runtimes.length === 1 && routeNode.type !== 'boss';
  const multi = runtimes.length > 1 && routeNode.type !== 'boss';
  const totalById = new Map<string, number>();
  runtimes.forEach((r) => totalById.set(r.id, (totalById.get(r.id) ?? 0) + 1));
  const seenById = new Map<string, number>();
  return runtimes.map((runtime) => {
    const seen = seenById.get(runtime.id) ?? 0;
    seenById.set(runtime.id, seen + 1);
    const duplicated = (totalById.get(runtime.id) ?? 1) > 1;
    const maxHp = solo
      ? Math.ceil(runtime.health * SOLO_ENCOUNTER_HEALTH_MULT)
      : multi
        ? Math.ceil(runtime.health * MULTI_ENCOUNTER_HEALTH_MULT)
        : runtime.health;
    return {
      id: duplicated ? `${runtime.id}#${seen}` : runtime.id,
      name: duplicated ? `${runtime.name} ${String.fromCharCode(65 + seen)}` : runtime.name,
      hp: maxHp,
      maxHp,
      block: 0,
      weak: 0,
      intentIndex: 0,
      hitThisTurn: false,
      nextAttackBonus: 0,
      damageBonus: solo ? SOLO_ENCOUNTER_DAMAGE_BONUS : (multi ? MULTI_ENCOUNTER_DAMAGE_BONUS : 0),
      roles: runtime.roles ?? [],
      solo,
      runtime
    };
  });
}

// Active-run persistence: a single in-progress run is mirrored to localStorage so
// the player can close the tab and Continue. Written from the route checkpoint
// (RouteScene.renderAll) and cleared on win / loss / abandon.
const ACTIVE_RUN_KEY = 'birdsquad.run.active';
function persistActiveRun(runState: RunState): void {
  try {
    window.localStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(runState));
  } catch {
    /* storage unavailable — saving is best-effort */
  }
}
function loadActiveRun(): RunState | undefined {
  try {
    const raw = window.localStorage.getItem(ACTIVE_RUN_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as RunState;
    return parsed && Array.isArray(parsed.deck) ? parsed : undefined;
  } catch {
    return undefined;
  }
}
function clearActiveRun(): void {
  try {
    window.localStorage.removeItem(ACTIVE_RUN_KEY);
  } catch {
    /* ignore */
  }
}
function hasActiveRun(): boolean {
  return loadActiveRun() !== undefined;
}

// Highest difficulty tier the player has unlocked (beat tier N -> unlock N+1).
const MAX_TIER_KEY = 'birdsquad.maxTier';
function getMaxUnlockedTier(): number {
  try {
    return Math.max(0, Math.min(MAX_DIFFICULTY, Number(window.localStorage.getItem(MAX_TIER_KEY) ?? '0') || 0));
  } catch {
    return 0;
  }
}
function unlockTier(tier: number): void {
  try {
    const next = Math.min(MAX_DIFFICULTY, tier);
    if (next > getMaxUnlockedTier()) window.localStorage.setItem(MAX_TIER_KEY, String(next));
  } catch {
    /* ignore */
  }
}

function createStartingDeck(leaderId?: string): Card[] {
  return getLeader(leaderId).startingDeckIds.map((id) => cloneCard(id));
}

let cardInstanceCounter = 0;
function nextCardInstanceId(cardId: string): string {
  cardInstanceCounter += 1;
  return `${cardId}#${cardInstanceCounter}`;
}

// Every cloned card gets a unique per-combat instance id so two copies of the
// same card are distinguishable in hand (next-level-data-contracts Phase 4 /
// §11a — per-combat instance identity).
function cloneCard(id: string): Card {
  return { ...cardLibrary[id], instanceId: nextCardInstanceId(id) };
}

function createInitialRunState(leaderId?: string, difficulty = 0): RunState {
  const leader = getLeader(leaderId);
  discoverCards(leader.startingDeckIds); // the starting deck is "found" for the Codex
  return {
    deck: leader.startingDeckIds.map((id) => ({ id })),
    leaderId: leader.id,
    difficulty,
    seed: Math.random().toString(36).slice(2, 10), // a fresh procedural-route seed per run
    currentHp: BASE_COHESION + (aggregateFlockStats(createStartingDeck(leader.id)).cohesion ?? 0),
    scrap: STARTING_SCRAP,
    routeMarks: [],
    supplies: [],
    supplySlots: BASE_SUPPLY_SLOTS,
    mapIndex: 0,
    completedRouteNodeIds: [],
    currentRouteNodeId: undefined,
    routeLog: ['The flock gathers at Rooftop Blocks.'],
    nextCombat: undefined,
    signalChoices: [],
    rewardEvents: [],
    suppliesUsed: [],
    combatResults: [],
    freePreenNextDistrict: 0
  };
}

function cloneRunState(runState: RunState): RunState {
  return {
    deck: runState.deck.map((card) => ({ ...card })),
    leaderId: runState.leaderId,
    difficulty: runState.difficulty ?? 0,
    seed: runState.seed,
    currentHp: runState.currentHp,
    scrap: runState.scrap ?? STARTING_SCRAP,
    routeMarks: [...(runState.routeMarks ?? [])],
    supplies: [...(runState.supplies ?? [])],
    supplySlots: runSupplyCapacity(runState),
    mapIndex: runState.mapIndex ?? 0,
    completedRouteNodeIds: [...runState.completedRouteNodeIds],
    currentRouteNodeId: runState.currentRouteNodeId,
    routeLog: [...runState.routeLog],
    nextCombat: runState.nextCombat ? { ...runState.nextCombat } : undefined,
    signalChoices: (runState.signalChoices ?? []).map((entry) => ({ ...entry })),
    rewardEvents: (runState.rewardEvents ?? []).map((entry) => ({ ...entry, offered: [...entry.offered] })),
    suppliesUsed: [...(runState.suppliesUsed ?? [])],
    combatResults: (runState.combatResults ?? []).map((entry) => ({ ...entry, enemyIds: [...entry.enemyIds] })),
    freePreenNextDistrict: runState.freePreenNextDistrict ?? 0
  };
}

function cardsFromSave(savedCards: SavedCard[]): Card[] {
  return savedCards.map((saved) => {
    const card = cloneCard(saved.id);
    card.upgraded = saved.upgraded;
    return card;
  });
}

function saveCards(cards: Card[]): SavedCard[] {
  const byId = new Map<string, SavedCard>();
  cards.forEach((card) => {
    if (!byId.has(card.id)) byId.set(card.id, { id: card.id, upgraded: card.upgraded });
  });
  return [...byId.values()];
}

function displayName(card: Card) {
  return card.upgraded ? `${card.name}+` : card.name;
}

function isAviaryCard(card: Pick<Card, 'id'>) {
  return card.id.startsWith('aviary_');
}

function cardLabel(card: Card) {
  if (isSnagCard(card)) return 'SNAG';
  if (isAviaryCard(card)) return 'AVIARY';
  if (card.type === 'major') return 'LEGEND';
  if (card.type === 'minor') return suitLabel(card);
  return 'MOLT';
}

function suitLabel(card: Card) {
  if (card.runtime.suit === 'plumes') return 'PLUMES';
  if (card.runtime.suit === 'basins') return 'BASINS';
  if (card.runtime.suit === 'quills') return 'QUILLS';
  if (card.runtime.suit === 'nests') return 'NESTS';
  return 'CREW';
}

function cardArtKey(card: Card) {
  return cardArtAssets[card.id]?.key;
}

function compactCardArtKey(card: Card) {
  return cardCompactArtAsset(card)?.key;
}

function loadedCardArtKey(scene: Phaser.Scene, card: Card) {
  const full = cardArtKey(card);
  if (full && scene.textures.exists(full)) return full;
  const compact = compactCardArtKey(card);
  if (compact && scene.textures.exists(compact)) return compact;
  return undefined;
}

function isSnagCard(card: Pick<Card, 'runtime'>) {
  return card.runtime.kind === 'snag';
}

function renderSnagCardBorder(
  scene: Phaser.Scene,
  addTo: UiAdd | undefined,
  card: Pick<Card, 'runtime'>,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 1
) {
  if (!isSnagCard(card) || !scene.textures.exists(snagCardBorderAsset.key)) return false;
  const bg = scene.add.rectangle(x, y, width, height, 0x07090d, Math.min(0.98, alpha));
  const frame = scene.add.image(x, y, snagCardBorderAsset.key)
    .setDisplaySize(width, height)
    .setAlpha(alpha);
  if (addTo) {
    addTo(bg);
    addTo(frame);
  }
  return true;
}

function cardCompactArtAsset(card: Pick<Card, 'id'>) {
  return cardThumbArtAssets[card.id] ?? cardArtAssets[card.id];
}

function displayText(card: Card) {
  return card.upgraded ? card.upgradedText : card.text;
}

function activeMoltEffects(card: Card) {
  return card.upgraded && card.runtime.upgrade.moltEffects?.length
    ? (card.runtime.upgrade.moltEffects as string[])
    : (card.runtime.moltEffects ?? []);
}

function activeMoltText(card: Card) {
  if (card.upgraded && card.moltTextUpgraded) return card.moltTextUpgraded;
  return card.moltText;
}

function effectBody(effect: string) {
  return effect.replace(/^if .+? then /, '');
}

function effectsNeedEnemyTarget(effects: string[]) {
  return effects.some((effect) => {
    const body = effectBody(effect);
    return /\b(?:damage|damagePierce|applyWinded|removeCover)\(target\b/.test(body)
      || /\b(?:resonanceBurst|windedBurst)\(/.test(body)
      || /\bperWinded\b/.test(body)
      || /\btarget(?:BelowHalf|IntendsAttack|HasCover|Winded)\b/.test(effect)
      || /\bwindedAtLeast\(/.test(effect);
  });
}

function effectsHitAllEnemies(effects: string[]) {
  return effects.some((effect) => /\bdamageAll\(/.test(effectBody(effect)));
}

function effectsOnlyAffectFlock(effects: string[]) {
  return effects.some((effect) => {
    const body = effectBody(effect);
    return /\b(?:gainCover|applyOpenSky|loseCover|damageFlock|heal|overhealCover|loseCohesion|draw|discard|discardUpTo|gainWingbeat|loseWingbeat|gainResonance|spendResonance|enterMolt|gainOpenSkyGuard|returnDiscard|nextCoverBonus|nextTurnDraw|gainEnergyNextTurn|enemyNextAttackBonus|enemyGainCover|shuffleSelfToDraw|exhaustSelf)\(/.test(body);
  });
}

function effectsActAsAttack(effects: string[]) {
  return effects.some((effect) => {
    const body = effectBody(effect);
    return /\b(?:damage|damagePierce|damageAll|applyWinded|removeCover|resonanceBurst|windedBurst)\(/.test(body)
      || /\btarget(?:BelowHalf|IntendsAttack|HasCover|Winded)\b/.test(effect)
      || /\bwindedAtLeast\(/.test(effect);
  });
}

function effectsActAsSkill(effects: string[]) {
  return effects.some((effect) => {
    const body = effectBody(effect);
    return /\b(?:gainCover|heal|overhealCover|cleanseFlock|gainOpenSkyGuard|nextCoverBonus|retainHand)\(/.test(body);
  });
}

function inferActiveTarget(baseTarget: TargetType, effects: string[]): TargetType {
  if (effectsNeedEnemyTarget(effects)) return 'enemy';
  if (effectsHitAllEnemies(effects)) return 'allEnemies';
  if (baseTarget === 'choice') return 'choice';
  if (effectsOnlyAffectFlock(effects)) return baseTarget === 'none' ? 'none' : 'self';
  return baseTarget;
}

function inferActiveRole(effects: string[], fallback: CardRole): CardRole {
  if (effectsActAsAttack(effects)) return 'attack';
  if (effectsActAsSkill(effects)) return 'skill';
  if (effects.length > 0) return 'utility';
  return fallback;
}

function activeCardContract(card: Card, molting: boolean): ActiveCardContract {
  const moltEffects = activeMoltEffects(card);
  const usesMolt = molting && moltEffects.length > 0;
  const effects = usesMolt
    ? moltEffects
    : (card.upgraded ? card.runtime.upgrade.effects : card.runtime.effects);
  return {
    effects,
    text: usesMolt ? activeMoltText(card) : displayText(card),
    target: usesMolt ? inferActiveTarget(card.target, effects) : card.target,
    baseTarget: card.target,
    role: inferActiveRole(effects, card.role),
    usesMolt,
    label: usesMolt ? 'Molt' : 'Normal',
  };
}

const STATUS_TOOLTIPS: Record<string, string> = {
  winded: "Winded reduces the flock's attack output and ticks down each turn.",
  openSky: 'Open Sky increases incoming damage until it ticks down.',
  openSkyGuard: 'Open Sky Guard cancels Open Sky damage increases — one per point.',
  molt: 'Molt: while in this stance, every card plays its alternate Molt ability instead of its normal effect. Ends your turn Open Sky.',
  fouled: 'Fouled deals Cohesion damage at the start of your turn, then ticks down by 1.',
  ruffled: 'Ruffled is a lingering debuff on the flock.'
};

function flockStatuses(flock: Flock) {
  return flockStatusEntries(flock).map((entry) => entry.label);
}

// Status display is driven by the registry (alpha-statuses.json): each active
// status is classified buff/debuff by the registry, and debuffs (threats) sort
// first (next-level-data-contracts §5.5 — the registry as source of truth).
function flockStatusEntries(flock: Flock): Array<{ id: string; label: string; kind: 'buff' | 'debuff' }> {
  const kindOf = (id: string): 'buff' | 'debuff' =>
    alphaStatusSet.statuses.find((status) => status.id === id)?.kind ?? 'buff';
  const entries: Array<{ id: string; label: string; kind: 'buff' | 'debuff' }> = [];
  if (flock.weak > 0) entries.push({ id: 'winded', label: `Winded ${flock.weak}`, kind: kindOf('winded') });
  if (flock.fouled > 0) entries.push({ id: 'fouled', label: `Fouled ${flock.fouled}`, kind: kindOf('fouled') });
  if (flock.exposed) entries.push({ id: 'openSky', label: 'Open Sky', kind: kindOf('openSky') });
  if (flock.frail > 0) entries.push({ id: 'ruffled', label: `Ruffled ${flock.frail}`, kind: 'debuff' });
  if (flock.molt) entries.push({ id: 'molt', label: 'Molt', kind: kindOf('molt') });
  if (flock.openSkyGuard > 0) entries.push({ id: 'openSkyGuard', label: `Open Sky Guard ${flock.openSkyGuard}`, kind: kindOf('openSkyGuard') });
  return entries.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'debuff' ? -1 : 1));
}

// Board placement for enemy `index` of `count`. One enemy keeps the classic
// anchor at a larger feature scale; 2-3 fan out around x=900, and 4 uses a
// compact two-row stage so HP/intent badges do not pile up in one horizontal run.
function enemyViewAt(index: number, count: number): { x: number; y: number; scale: number } {
  if (count <= 1) return { x: ENEMY_FX_X, y: ENEMY_FX_Y, scale: 1.12 };
  const layouts: Record<number, Array<{ x: number; y: number; scale: number }>> = {
    2: [
      { x: 760, y: ENEMY_FX_Y, scale: 0.98 },
      { x: 1040, y: ENEMY_FX_Y, scale: 0.98 },
    ],
    3: [
      { x: 675, y: 242, scale: 0.8 },
      { x: 910, y: 230, scale: 0.84 },
      { x: 1130, y: 252, scale: 0.8 },
    ],
    4: [
      { x: 690, y: 200, scale: 0.68 },
      { x: 1065, y: 200, scale: 0.68 },
      { x: 755, y: 330, scale: 0.64 },
      { x: 1125, y: 330, scale: 0.64 },
    ],
  };
  return layouts[Math.min(4, count)]?.[index] ?? layouts[4][layouts[4].length - 1];
}

function bossGoonViewAt(index: number, count: number): { x: number; y: number; scale: number } {
  const layouts: Record<number, Array<{ x: number; y: number; scale: number }>> = {
    1: [
      { x: 680, y: 344, scale: 0.66 },
    ],
    2: [
      { x: 650, y: 338, scale: 0.64 },
      { x: 1178, y: 338, scale: 0.64 },
    ],
    3: [
      { x: 640, y: 338, scale: 0.62 },
      { x: 1190, y: 338, scale: 0.62 },
      { x: 930, y: 405, scale: 0.56 },
    ],
  };
  return layouts[Math.min(3, count)]?.[index] ?? layouts[3][layouts[3].length - 1];
}

function enemyStatus(enemy: Enemy) {
  const statuses: string[] = [];
  if (enemy.block > 0) statuses.push(`${enemy.block} Cover`);
  if (enemy.weak > 0) statuses.push(`${enemy.weak} Winded`);
  return statuses.join(' / ');
}

function enemyInitials(name: string): string {
  const words = name.split(/\s+/).filter((word) => word.toLowerCase() !== 'the');
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('') || '?';
}

function intentCoverValue(intent: { effects: string[] }) {
  for (const effect of intent.effects) {
    const parsed = parseEffect(effect);
    if (parsed && parsed.name === 'gainCover') return Number(parsed.args[0]) || 0;
  }
  return 0;
}

function suitAccentColor(card: Card) {
  switch (card.runtime.suit) {
    case 'plumes': return 0xff9d4d;
    case 'basins': return 0x7ab8d6;
    case 'quills': return 0xd8e0ea;
    case 'nests': return 0x8fd6a0;
    default: return 0x7ab8d6;
  }
}

function suitFxMeta(suit: string | null | undefined) {
  switch (suit) {
    case 'plumes': return { color: 0xff9d4d, hex: '#ff9d4d', label: 'PLUMES', glyph: '>>' };
    case 'quills': return { color: 0xd8e0ea, hex: '#d8e0ea', label: 'QUILLS', glyph: '//' };
    case 'basins': return { color: 0x7ab8d6, hex: '#7ab8d6', label: 'BASINS', glyph: '~~' };
    case 'nests': return { color: 0x8fd6a0, hex: '#8fd6a0', label: 'NESTS', glyph: '##' };
    default: return { color: 0xd8a840, hex: '#d8a840', label: 'CREW', glyph: '**' };
  }
}

// ---------------------------------------------------------------------------
// Keyword glossary: the game's mechanical terms, each with a highlight color
// and a player-facing definition. Used to color keywords inside card effect
// text and to pop an explanatory tooltip on hover (see renderRichText).
// ---------------------------------------------------------------------------
interface KeywordDef { color: string; def: string }
const KEYWORDS: Record<string, KeywordDef> = {
  Cover: { color: '#7ab8d6', def: 'Temporary shielding. Absorbs incoming damage, then clears at the end of your turn — unless your Nests keystone is holding it over.' },
  Cohesion: { color: '#8fd6a0', def: "The flock's health. When Cohesion reaches 0, the run ends." },
  Resonance: { color: '#c39bff', def: 'A Plumes resource. Bank it, then spend it on Resonance cards for amplified effects.' },
  'Resonance Burst': { color: UI_CYAN, def: 'A Plumes payoff that spends all of your banked Resonance at once for a large effect.' },
  Winded: { color: '#c98bff', def: 'A Quills counter. High Winded weakens the flock’s hits but supercharges Winded-payoff cards; it ticks down over time.' },
  Fouled: { color: '#8bd2a0', def: 'A poison-like pressure. It damages Cohesion at the start of your turn, then ticks down by 1.' },
  'Winded Burst': { color: '#c98bff', def: 'A Quills payoff that converts accumulated Winded into a burst of damage.' },
  Molt: { color: '#ff9d4d', def: 'A transform stance. While Molting, every card plays its alternate Molt ability instead of its normal effect. The turn ends Open Sky.' },
  'Open Sky': { color: UI_GOLD, def: 'Exposed. Incoming damage is increased until it ticks down. Open Sky Guard cancels it, one point per stack.' },
  'Open Sky Guard': { color: '#cfe3a3', def: "Cancels Open Sky's damage increase — one point per stack." },
  Flow: { color: '#67d4e6', def: 'A rising meter. Holding Flow shifts the flock into stronger formations; an unblocked hit breaks it.' },
  Surge: { color: UI_CYAN, def: 'The peak formation from high Flow — the flock attacks and defends at its best.' },
  Scatter: { color: '#ff7a6e', def: 'A broken formation from lost Flow — the flock is disorganized and weaker until it regroups.' },
  Hold: { color: '#9fd0e0', def: 'The steady mid formation — neither broken nor surging.' },
  Wingbeat: { color: '#ffd97a', def: 'Stored momentum that grants extra Energy on a later turn.' },
  Regen: { color: '#8fd6a0', def: 'Restores a set amount of Cohesion at the start of each of your turns.' },
  Energy: { color: '#ffd54a', def: 'Spent to play cards. Refreshes at the start of each turn.' },
  Draw: { color: '#bcd2e6', def: 'Pull cards from your draw pile into your hand. An empty draw pile reshuffles the discard.' },
  Discard: { color: '#b6a0c8', def: 'Send cards from your hand to the discard pile.' },
  Keystone: { color: '#ffd97a', def: 'A suit aura unlocked by holding 5+ cards of one suit, granting a passive bonus all combat.' },
};
const KEYWORD_LIST = Object.keys(KEYWORDS).sort((a, b) => b.length - a.length);

// Split text into word tokens, fusing multi-word keyword phrases (e.g. "Open
// Sky") into a single keyword token. Trailing punctuation is tolerated.
function buildKeywordTokens(text: string): Array<{ text: string; kw?: string }> {
  const words = text.split(/\s+/).filter(Boolean);
  const tokens: Array<{ text: string; kw?: string }> = [];
  for (let i = 0; i < words.length;) {
    let matched = false;
    for (let n = Math.min(3, words.length - i); n >= 1 && !matched; n--) {
      const raw = words.slice(i, i + n).join(' ');
      const stripped = raw.replace(/[.,;:!)]+$/, '').replace(/^[(]+/, '');
      const canonical = KEYWORD_LIST.find((k) => k.toLowerCase() === stripped.toLowerCase());
      if (canonical) { tokens.push({ text: raw, kw: canonical }); i += n; matched = true; }
    }
    if (!matched) { tokens.push({ text: words[i] }); i++; }
  }
  return tokens;
}

let activeKwTooltip: { scene: Phaser.Scene; container: Phaser.GameObjects.Container } | undefined;
function hideKwTooltip(scene?: Phaser.Scene) {
  if (!activeKwTooltip) return;
  if (scene && activeKwTooltip.scene !== scene) {
    activeKwTooltip = undefined;
    return;
  }
  activeKwTooltip.container.destroy(true);
  activeKwTooltip = undefined;
}
function showKwTooltip(scene: Phaser.Scene, kw: string, atX: number, atY: number) {
  hideKwTooltip(scene);
  const def = KEYWORDS[kw];
  if (!def) return;
  const w = 248;
  const title = scene.add.text(10, 8, kw.toUpperCase(), { fontFamily: UI_FONT, fontSize: '12px', fontStyle: UI_BOLD, color: def.color });
  const body = scene.add.text(10, 8 + title.height + 4, def.def, { fontFamily: UI_FONT, fontSize: '12px', color: '#dbe6f2', lineSpacing: 2, wordWrap: { width: w - 20 } });
  const h = 8 + title.height + 4 + body.height + 10;
  const stroke = Phaser.Display.Color.HexStringToColor(def.color).color;
  const bg = scene.add.rectangle(0, 0, w, h, 0x0a1018, 0.98).setOrigin(0, 0).setStrokeStyle(2, stroke, 1);
  const c = scene.add.container(0, 0, [bg, title, body]).setDepth(99999);
  let px = atX - w / 2;
  let py = atY - h - 10;
  px = Math.max(8, Math.min(GAME_WIDTH - w - 8, px));
  if (py < 8) py = atY + 24;
  c.setPosition(px, py);
  activeKwTooltip = { scene, container: c };
}

// Lay out effect text with mechanical keywords highlighted in their color
// (and bold). When tooltips=true, each keyword is interactive and pops its
// definition on hover. Returns the total rendered height. Manual token layout
// is required because a Phaser Text object is a single color.
interface RichTextOpts {
  wrap: number; fontSize?: number; baseColor?: string; lineSpacing?: number;
  bold?: boolean; align?: 'left' | 'center'; tooltips?: boolean;
}
function renderRichText(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number, y: number, text: string, opts: RichTextOpts,
): number {
  const { wrap, fontSize = 14, baseColor = '#dbe6f2', lineSpacing = 3, bold = false, align = 'left', tooltips = false } = opts;
  const base = { fontFamily: UI_FONT, fontSize: `${fontSize}px` };
  const m1 = scene.add.text(0, 0, 'a a', base); const m2 = scene.add.text(0, 0, 'aa', base);
  const spaceW = Math.max(3, m1.width - m2.width); m1.destroy(); m2.destroy();
  const tokens = buildKeywordTokens(text).map((t) => {
    const style = { ...base, fontStyle: (t.kw || bold) ? 'bold' : 'normal' };
    const tmp = scene.add.text(0, 0, t.text, style); const w = tmp.width; tmp.destroy();
    return { ...t, w };
  });
  const lines: Array<Array<typeof tokens[number]>> = [];
  let cur: Array<typeof tokens[number]> = []; let curW = 0;
  for (const t of tokens) {
    const add = (cur.length ? spaceW : 0) + t.w;
    if (cur.length && curW + add > wrap) { lines.push(cur); cur = [t]; curW = t.w; }
    else { cur.push(t); curW += add; }
  }
  if (cur.length) lines.push(cur);
  const lineH = Math.ceil(fontSize * 1.2) + lineSpacing;
  let yy = y;
  for (const line of lines) {
    const lineW = line.reduce((s, t, i) => s + t.w + (i ? spaceW : 0), 0);
    let sx = align === 'center' ? x - lineW / 2 : x;
    for (const t of line) {
      const color = t.kw ? KEYWORDS[t.kw].color : baseColor;
      const fontStyle = (t.kw || bold) ? 'bold' : 'normal';
      const txt = scene.add.text(sx, yy, t.text, { ...base, color, fontStyle });
      parent.add(txt);
      if (t.kw && tooltips) {
        const kw = t.kw; const tipX = sx + t.w / 2; const tipY = yy;
        txt.setInteractive({ useHandCursor: true });
        txt.on('pointerover', () => showKwTooltip(scene, kw, tipX, tipY));
        txt.on('pointerout', () => hideKwTooltip());
      }
      sx += t.w + spaceW;
    }
    yy += lineH;
  }
  return yy - y;
}

function zoneRank(zone: string) {
  if (zone === 'Hand') return 0;
  if (zone === 'Draw' || zone === 'Deck') return 1;
  if (zone === 'Discard') return 2;
  return 3;
}

function tableHeaderStyle() {
  return {
    fontFamily: UI_FONT,
    fontSize: '14px',
    fontStyle: UI_BOLD,
    color: '#91a6b8'
  };
}

function tableCellStyle(color: string) {
  return {
    fontFamily: UI_FONT,
    fontSize: '16px',
    fontStyle: UI_BOLD,
    color
  };
}

function marketOfferTitleStyle() {
  return {
    fontFamily: UI_FONT,
    fontSize: '16px',
    fontStyle: UI_BOLD,
    color: UI_GOLD
  };
}

function marketOfferPriceStyle(enabled: boolean) {
  return {
    fontFamily: UI_FONT,
    fontSize: '14px',
    fontStyle: UI_BOLD,
    color: enabled ? '#8df4ff' : '#91a6b8'
  };
}

const UI_FIELD = {
  ink: 0x070b12,
  panel: 0x0b111b,
  panelWarm: 0x17120c,
  rail: 0x111923,
  paper: 0x1c2022,
  gold: 0xd8a840,
  brass: 0xf0c36f,
  cyan: 0x7ab8d6,
  green: 0x8fd6a0,
  danger: 0xff6b57,
  violet: 0xc9a6ff,
  text: '#e7eef7',
  muted: '#91a6b8',
  warm: '#ffe1a3',
  cyanText: '#8df4ff'
};

type UiAdd = (obj: Phaser.GameObjects.GameObject) => void;

function addUi<T extends Phaser.GameObjects.GameObject>(addTo: UiAdd, obj: T): T {
  addTo(obj);
  return obj;
}

type CompactItemKind = 'supply' | 'waymark';

interface CompactItemTileOptions {
  kind: CompactItemKind;
  id: string;
  glyph: string;
  accent: number;
  name: string;
  meta?: string;
  summary: string;
  enabled?: boolean;
  actionLabel?: string;
}

function formatConditionCompact(condition: string) {
  return formatCondition(condition)
    .replace('first played', 'first')
    .replace('target attacks', 'attack intent')
    .replace('target below half', 'low target')
    .replace('target has Cover', 'has Cover')
    .replace('target Winded', 'Winded')
    .replace('full Cohesion', 'full HP')
    .replace('low Cohesion', 'low HP');
}

function formatEffectCompact(effect: string): string {
  const conditional = effect.match(/^if ([a-zA-Z][a-zA-Z0-9]*(?:\([^)]+\))?) then (.+)$/);
  if (conditional) return `${formatConditionCompact(conditional[1])}: ${formatEffectCompact(conditional[2])}`;
  const parsed = parseEffect(effect);
  if (!parsed) return compactSentenceText(effect, 44, 1).replace(/\.$/, '');
  const value = (parsed.args[1] ?? parsed.args[0] ?? '')
    .replace(' perWinded', '/Winded')
    .replace(' perDiscarded', '/discard')
    .replace(' perCover', '/Cover');
  switch (parsed.name) {
    case 'damage': return `${value} dmg`;
    case 'damagePierce': return `${value} pierce`;
    case 'damageAll': return `${value} all`;
    case 'removeCover': return `-${value} Cover`;
    case 'gainCover': return `+${value} Cover`;
    case 'applyOpenSky': return `Open Sky ${value}`;
    case 'loseCover': return `-${value} Cover`;
    case 'damageFlock': return `-${value} HP`;
    case 'heal':
    case 'healCohesion': return `+${value} HP`;
    case 'healMissingPct': return `missing HP +${parsed.args[1] ?? value}`;
    case 'healAlly': return `ally +${value} HP`;
    case 'healAllEnemies': return `enemies +${value} HP`;
    case 'gainCoverAlly': return `ally +${value} Cover`;
    case 'gainCoverAllEnemies': return `enemies +${value} Cover`;
    case 'nextAttackBonusAlly': return `ally +${value} dmg`;
    case 'overhealCover': return `+${value} HP -> Cover`;
    case 'loseCohesion': return `-${value} HP`;
    case 'draw': return `Draw ${value}`;
    case 'discard': return `Discard ${value}`;
    case 'discardUpTo': return `Discard up to ${value}`;
    case 'gainWingbeat': return `+${value} Wingbeat`;
    case 'loseWingbeat': return `-${value} Wingbeat`;
    case 'gainResonance': return `+${value} Resonance`;
    case 'gainScrap': return `+${value} Scrap`;
    case 'payScrap': return `-${value} Scrap`;
    case 'spendResonance': return `spend ${value} Resonance`;
    case 'resonanceBurst': return `${value} dmg/Resonance`;
    case 'windedBurst': return `${value} dmg/Winded`;
    case 'applyWinded': return parsed.args[0] === 'flock' ? `flock +${value} Winded` : `+${value} Winded`;
    case 'applyPoison': return `+${value} Fouled`;
    case 'enterMolt': return 'Molt';
    case 'gainOpenSkyGuard': return `+${value} Sky Guard`;
    case 'reduceNextOpenSky':
    case 'reduceOpenSky': return `-${value} Open Sky`;
    case 'returnDiscard': {
      const drawAfter = parseEffectValue(parsed.args[1], 0);
      return drawAfter > 0 ? `return discard + Draw ${drawAfter}` : 'return discard';
    }
    case 'nextCoverBonus': return `next Cover +${value}`;
    case 'retainHand': return `retain ${value}`;
    case 'nextTurnDraw': return `next Draw ${Number(value) >= 0 ? '+' : ''}${value}`;
    case 'gainEnergyNextTurn': return `next Wingbeat +${value}`;
    case 'enemyNextAttackBonus': return `enemy +${value} dmg`;
    case 'enemyGainCover': return `enemy +${value} Cover`;
    case 'repeatNextSupply': return `repeat Supply +${value}`;
    case 'cleanseFlock': return `cleanse ${value}`;
    case 'peekNextNodes': return `peek ${value || 1}`;
    case 'increaseSupplySlots': return `slot +${value || 1}`;
    case 'gainSupply': return 'Supply';
    case 'gainSupplyChoice': return `Supply choice ${value || 1}`;
    case 'addHeal': return `Basin +${value} HP`;
    case 'reducePreenPrice': return `Preen -${value} Scrap`;
    case 'gainCoverPerWaymark': return `+${value} Cover/Waymark`;
    case 'gainRouteMark':
      if (value === 'randomRare') return 'Rare Waymark';
      if (value === 'randomUncommonOrRare') return 'High-tier Waymark';
      return 'Waymark';
    case 'addCard':
      if (value === 'chooseOneOfTwoRare' || value === 'randomRare') return 'Rare card';
      if (value === 'chooseOneOfTwoUncommonOrRare' || value === 'randomUncommonOrRare') return 'High-tier card';
      return 'Card';
    case 'addSnagToDiscard': return 'Snag to discard';
    case 'addSnagToDraw': return 'Snag to draw';
    case 'shuffleSelfToDraw': return 'returns to deck';
    case 'exhaustSelf': return 'clears';
    case 'bossDamageShield': return `Boss +${value} Cover`;
    case 'extraCacheChoice': return `Cache +${value} choice`;
    case 'freePreenNextDistrict': return 'free Preen next';
    case 'districtStartKit': return 'next district kit';
    case 'removeRouteChoice': return 'close route';
    default: return formatEffect(effect).replace(/\.$/, '');
  }
}

function compactEffectGrammar(effects: string[] | string, maxChars = 96, maxParts = 3) {
  const raw = Array.isArray(effects) ? effects : effects.split(/\.\s+/).filter(Boolean);
  const text = raw.slice(0, maxParts).map(formatEffectCompact).join(' | ');
  return compactSentenceText(text, maxChars, 1).replace(/\.$/, '');
}

function compactCardEffectSummary(effects: string[]) {
  return compactEffectGrammar(effects, 86, 3);
}

function compactEffectSummary(effects: string[] | string, maxChars = 96, maxSentences = 2) {
  const text = (Array.isArray(effects) ? formatEffects(effects) : effects)
    .replace(/\s+/g, ' ')
    .trim();
  return compactSentenceText(text, maxChars, maxSentences);
}

function compactSentenceText(text: string, maxChars = 96, maxSentences = 2) {
  const sentences = text.match(/[^.!?]+[.!?]/g)?.map((part) => part.trim()) ?? [text];
  const source = sentences.slice(0, maxSentences).join(' ').trim() || text;
  if (source.length <= maxChars) return source;
  const clipped = source.slice(0, maxChars - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, lastSpace > 42 ? lastSpace : clipped.length).trim()}...`;
}

function renderCompactItemTile(
  scene: Phaser.Scene,
  addTo: UiAdd,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: CompactItemTileOptions,
) {
  const enabled = opts.enabled ?? true;
  const stroke = enabled ? opts.accent : 0x49606d;
  const bg = addUi(addTo, scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x07101c, enabled ? 0.9 : 0.72)
    .setStrokeStyle(1.5, stroke, enabled ? 0.82 : 0.58));
  addUi(addTo, scene.add.rectangle(x + 5, y + h / 2, 4, h - 18, stroke, enabled ? 0.82 : 0.58));

  const iconSize = 48;
  const iconX = x + 38;
  const iconY = y + 36;
  addUi(addTo, scene.add.rectangle(iconX, iconY, iconSize, iconSize, 0x07101c, enabled ? 0.97 : 0.72)
    .setStrokeStyle(2, stroke, enabled ? 0.95 : 0.62));
  const artKey = opts.kind === 'supply'
    ? supplyArtAssets[opts.id]?.key
    : waymarkArtAssets[opts.id]?.key;
  if (artKey && scene.textures.exists(artKey)) {
    const icon = opts.kind === 'supply'
      ? addSupplyArtImage(scene, iconX, iconY, artKey)
      : addWaymarkArtImage(scene, iconX, iconY, artKey);
    addUi(addTo, icon.setDisplaySize(iconSize - 8, iconSize - 8).setAlpha(enabled ? 1 : 0.58));
  } else {
    addUi(addTo, scene.add.text(iconX, iconY - 1, opts.glyph, {
      fontFamily: UI_FONT,
      fontSize: opts.kind === 'supply' ? '21px' : '23px',
      fontStyle: UI_BOLD,
      color: enabled ? '#ffe7c9' : '#7f93a8'
    }).setOrigin(0.5));
  }

  const textX = x + 74;
  const textW = w - 92;
  addUi(addTo, scene.add.text(textX, y + 14, opts.name, {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: enabled ? '#ffe1a3' : '#9fb1c4',
    fixedWidth: textW,
    maxLines: 1
  }).setResolution(2));
  if (opts.meta) {
    addUi(addTo, scene.add.text(textX, y + 35, opts.meta, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: enabled ? '#ffcf9d' : '#7f93a8',
      fixedWidth: textW,
      maxLines: 1
    }).setResolution(2));
  }
  addUi(addTo, scene.add.text(textX, opts.meta ? y + 54 : y + 39, opts.summary, {
    fontFamily: UI_FONT,
    fontSize: opts.meta ? '10px' : '11px',
    color: UI_BODY,
    fixedWidth: textW,
    maxLines: opts.meta ? 2 : 2
  }).setResolution(2));
  if (opts.actionLabel) {
    addUi(addTo, scene.add.text(x + w - 12, y + h - 18, opts.actionLabel, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: enabled ? '#8df4ff' : '#5e7285'
    }).setOrigin(1, 0.5));
  }
  return bg;
}

function killTweensForTree(scene: Phaser.Scene, obj?: Phaser.GameObjects.GameObject) {
  if (!obj) return;
  scene.tweens.killTweensOf(obj);
  if (obj.type !== 'Container') return;
  const children = [...(obj as Phaser.GameObjects.Container).list];
  children.forEach((child) => killTweensForTree(scene, child));
}

function killTweensForScene(scene: Phaser.Scene) {
  scene.children.list.forEach((child) => killTweensForTree(scene, child));
}

type UnifiedRunHudData = {
  title: string;
  subtitle: string;
  cohesion: string;
  scrap: string | number;
  deckSize: string | number;
  waymarks: string | number;
  supplies: string | number;
  statusLabel?: string;
  statusColor?: string;
  flow?: number;
  flowMax?: number;
  cover?: number;
  wingbeats?: string | number;
  resonance?: string | number;
  beat?: string | number;
  onFlock?: () => void;
  onDeck?: () => void;
  onWaymarks?: () => void;
  onSupplies?: () => void;
};

function addWaymarkWithCapacity(current: string[], markId: string) {
  if (current.includes(markId)) return { routeMarks: [...current], added: false };
  const mark = alphaRouteMarkLibrary.get(markId);
  if (!mark) return { routeMarks: [...current], added: false };
  const next = [...current];
  let replaced: string | undefined;
  const capExempt = mark.source === 'boss' || mark.rarity === 'boss';
  if (!capExempt) {
    const nonBossCount = next.filter((id) => {
      const owned = alphaRouteMarkLibrary.get(id);
      return owned?.source !== 'boss' && owned?.rarity !== 'boss';
    }).length;
    if (nonBossCount >= WAYMARK_ACTIVE_CAP) {
      const replaceIndex = next.findIndex((id) => {
        const owned = alphaRouteMarkLibrary.get(id);
        return owned?.source !== 'boss' && owned?.rarity !== 'boss';
      });
      if (replaceIndex >= 0) {
        [replaced] = next.splice(replaceIndex, 1);
      }
    }
  }
  next.push(markId);
  return { routeMarks: next, added: true, replaced };
}

function renderUnifiedRunHud(
  scene: Phaser.Scene,
  addTo: UiAdd,
  data: UnifiedRunHudData
) {
  const accent = data.statusColor ? Phaser.Display.Color.HexStringToColor(data.statusColor).color : UI_FIELD.gold;
  const highlight = data.statusLabel && !['ROUTE', 'HOLDING'].includes(data.statusLabel);
  addUi(addTo, scene.add.rectangle(GAME_WIDTH / 2, 47, GAME_WIDTH - 28, 62, 0x070b12, 0.78)
    .setStrokeStyle(1, accent, highlight ? 0.78 : 0.26));
  addUi(addTo, scene.add.rectangle(GAME_WIDTH / 2, 16, GAME_WIDTH - 62, 2, accent, highlight ? 0.82 : 0.32));
  addUi(addTo, scene.add.rectangle(GAME_WIDTH / 2, 76, GAME_WIDTH - 62, 1, 0xffffff, 0.08));

  const [hp, maxHp] = parseHudRatio(data.cohesion);
  const hpFrac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const hpLeft = FLOCK_HP_BAR.x - FLOCK_HP_BAR.w / 2;
  const hpBg = addUi(addTo, scene.add.rectangle(FLOCK_HP_BAR.x, FLOCK_HP_BAR.y, FLOCK_HP_BAR.w, FLOCK_HP_BAR.h, 0x0e1a12, 0.95)
    .setStrokeStyle(1, 0x000000, 0.5));
  if (data.onFlock) {
    hpBg.setInteractive({ useHandCursor: true });
    hpBg.on('pointerdown', data.onFlock);
  }
  addUi(addTo, scene.add.rectangle(
    hpLeft + (FLOCK_HP_BAR.w * hpFrac) / 2,
    FLOCK_HP_BAR.y,
    Math.max(2, FLOCK_HP_BAR.w * hpFrac),
    FLOCK_HP_BAR.h - 6,
    hpFrac > 0.34 ? 0x4fa777 : 0xe2b24a,
    0.95
  ));
  const flockIcon = addUiIconImage(scene, 'flock-heart', hpLeft, FLOCK_HP_BAR.y + 1, 28);
  if (flockIcon) addUi(addTo, flockIcon);
  addUi(addTo, scene.add.text(FLOCK_HP_BAR.x, FLOCK_HP_BAR.y, `${data.cohesion}`, {
    fontFamily: UI_FONT,
    fontSize: '14px',
    fontStyle: UI_BOLD,
    color: '#eaf6ee',
    stroke: '#0a1410',
    strokeThickness: 3
  }).setOrigin(0.5));

  const cover = data.cover ?? 0;
  renderHudMetricChip(scene, addTo, hpLeft + FLOCK_HP_BAR.w + 76, FLOCK_HP_BAR.y + 1, 108, 'Cover', `${cover}`, 0x7ab8d6, {
    height: 38,
    valueColor: cover > 0 ? '#dffbff' : '#8a99a6',
    alpha: 0.82,
    icon: 'cover-shield'
  });
  renderHudMetricChip(scene, addTo, hpLeft + FLOCK_HP_BAR.w + 199, FLOCK_HP_BAR.y + 1, 118, 'Wingbeats', `${data.wingbeats ?? '0/3'}`, 0xf5d38a, {
    height: 38,
    valueColor: '#ffe7a8',
    alpha: 0.82,
    icon: 'wingbeats'
  });
  renderHudMetricChip(scene, addTo, hpLeft + FLOCK_HP_BAR.w + 322, FLOCK_HP_BAR.y + 1, 118, 'Resonance', `${data.resonance ?? '0/5'}`, 0x8df4ff, {
    height: 38,
    valueColor: '#dffbff',
    alpha: 0.82,
    icon: 'resonance-battery'
  });

  addUi(addTo, scene.add.rectangle(650, FLOCK_HP_BAR.y + 1, 1, 38, 0x49606d, 0.55));
  addUi(addTo, scene.add.rectangle(655, FLOCK_HP_BAR.y + 1, 1, 28, 0xffffff, 0.08));

  const chips: Array<{ label: string; value: string | number; width: number; color: number; text?: string; icon?: UiIconId }> = [
    { label: 'Scrap', value: data.scrap, width: 116, color: 0x8df4ff, text: '#dffbff', icon: 'scrap-gear' },
    { label: 'Deck', value: data.deckSize, width: 108, color: UI_FIELD.gold, text: UI_FIELD.warm, icon: 'deck-stack' },
    { label: 'Supplies', value: data.supplies, width: 130, color: 0xffb86b, text: '#ffe1a3', icon: 'supply-pouch' },
    { label: 'Waymarks', value: data.waymarks, width: 116, color: UI_FIELD.violet, text: '#e6d8ff', icon: 'waymark-compass' }
  ];
  let x = 674;
  chips.forEach((chip) => {
    const cx = x + chip.width / 2;
    const rect = renderHudMetricChip(scene, addTo, cx, FLOCK_HP_BAR.y + 1, chip.width, chip.label, `${chip.value}`, chip.color, {
      height: 38,
      valueColor: chip.text,
      alpha: 0.82,
      icon: chip.icon
    });
    if (chip.label === 'Deck' && data.onDeck) {
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerdown', data.onDeck);
    }
    if (chip.label === 'Waymarks' && data.onWaymarks) {
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerdown', data.onWaymarks);
    }
    if (chip.label === 'Supplies' && data.onSupplies) {
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerdown', data.onSupplies);
    }
    x += chip.width + 10;
  });

  const progressPrefix = '';
  addUi(addTo, scene.add.text(1262, 36, data.beat !== undefined ? `${progressPrefix} · Beat ${data.beat}` : progressPrefix, {
    fontFamily: UI_FONT,
    fontSize: '14px',
    fontStyle: UI_BOLD,
    color: '#f5d38a'
  }).setOrigin(1, 0.5));
}

function parseHudRatio(value: string): [number, number] {
  const match = value.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return [0, 0];
  return [Number(match[1]), Number(match[2])];
}

function renderHudMetricChip(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  width: number,
  label: string,
  value: string,
  accent: number,
  opts: { valueColor?: string; height?: number; alpha?: number; icon?: UiIconId } = {}
) {
  const height = opts.height ?? 38;
  const compact = height <= 34;
  const topRailY = cy - height / 2 + 2;
  const rect = addUi(addTo, scene.add.rectangle(cx, cy, width, height, 0x0b1017, opts.alpha ?? 0.78)
    .setStrokeStyle(1, accent, 0.42));
  addUi(addTo, scene.add.rectangle(cx, topRailY, width - 18, 2, accent, 0.72));
  const iconId = opts.icon ?? hudIconForLabel(label);
  const hasIcon = Boolean(iconId && scene.textures.exists(uiIconAssets[iconId].key));
  if (iconId) {
    const icon = addUiIconImage(scene, iconId, cx - width / 2 + 24, cy + 1, Math.min(28, height - 8));
    if (icon) addUi(addTo, icon);
  }
  const textLeft = cx - width / 2 + (hasIcon ? 58 : 10);
  if (!hasIcon) {
    addUi(addTo, scene.add.text(textLeft, cy - height / 2 + 6, label.toUpperCase(), {
      fontFamily: UI_FONT,
      fontSize: compact ? '7px' : '8px',
      fontStyle: UI_BOLD,
      color: '#91a6b8'
    }));
  }
  addUi(addTo, scene.add.text(hasIcon ? cx + 16 : textLeft, hasIcon ? cy + 1 : cy + (compact ? 7 : 8), value, {
    fontFamily: UI_FONT,
    fontSize: hasIcon ? '17px' : compact ? '13px' : '16px',
    fontStyle: UI_BOLD,
    color: opts.valueColor ?? '#e7eef7'
  }).setOrigin(hasIcon ? 0.5 : 0, 0.5));
  return rect;
}

function renderFieldPanel(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  w: number,
  h: number,
  opts: { title?: string; subtitle?: string; accent?: number; fill?: number; eyebrow?: string } = {}
) {
  const accent = opts.accent ?? UI_FIELD.gold;
  const fill = opts.fill ?? UI_FIELD.panel;
  addUi(addTo, scene.add.rectangle(cx + 8, cy + 10, w, h, 0x020409, 0.42));
  addUi(addTo, scene.add.rectangle(cx, cy, w, h, fill, 0.985).setStrokeStyle(1, accent, 0.42));
  addUi(addTo, scene.add.rectangle(cx, cy - h / 2 + 14, w - 34, 2, accent, 0.72));
  addUi(addTo, scene.add.rectangle(cx, cy + h / 2 - 14, w - 34, 1, 0xffffff, 0.08));
  const left = cx - w / 2;
  const right = cx + w / 2;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  const corner = 28;
  [
    [left + 15, top + 15, corner, 2], [left + 15, top + 15, 2, corner],
    [right - 15, top + 15, corner, 2], [right - 15, top + 15, 2, corner],
    [left + 15, bottom - 15, corner, 2], [left + 15, bottom - 15, 2, corner],
    [right - 15, bottom - 15, corner, 2], [right - 15, bottom - 15, 2, corner]
  ].forEach(([x, y, cw, ch], index) => {
    const ox = index === 2 || index === 6 ? -corner : 0;
    const oy = index === 5 || index === 7 ? -corner : 0;
    addUi(addTo, scene.add.rectangle(x + ox, y + oy, cw, ch, accent, 0.72).setOrigin(0, 0));
  });
  if (opts.eyebrow) {
    addUi(addTo, scene.add.text(left + 36, top + 30, opts.eyebrow.toUpperCase(), {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.muted
    }));
  }
  if (opts.title) {
    addUi(addTo, scene.add.text(left + 36, top + (opts.eyebrow ? 46 : 30), opts.title, {
      fontFamily: UI_FONT,
      fontSize: '28px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.warm,
      stroke: '#020409',
      strokeThickness: 3
    }));
  }
  if (opts.subtitle) {
    addUi(addTo, scene.add.text(left + 36, top + (opts.title ? 76 : 44), opts.subtitle, {
      fontFamily: UI_FONT,
      fontSize: '14px',
      color: UI_SOFT,
      wordWrap: { width: w - 220 }
    }));
  }
  return { left, right, top, bottom, cx, cy, w, h };
}

function renderCloseControl(scene: Phaser.Scene, addTo: UiAdd, x: number, y: number, onClick: () => void) {
  const hit = addUi(addTo, scene.add.rectangle(x, y, 104, 34, 0x020409, 0.05)
    .setInteractive({ useHandCursor: true }));
  const icon = addUiIconImage(scene, 'close-medallion', x - 44, y, 24);
  if (icon) addUi(addTo, icon);
  const label = addUi(addTo, scene.add.text(x + (icon ? 18 : 0), y - 7, 'Close', {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: '#ffd5cc'
  }).setOrigin(0.5, 0));
  const line = addUi(addTo, scene.add.rectangle(x, y + 12, 52, 2, UI_FIELD.danger, 0.85));
  hit.on('pointerover', () => {
    label.setColor('#ffffff');
    line.setDisplaySize(66, 2);
  });
  hit.on('pointerout', () => {
    label.setColor('#ffd5cc');
    line.setDisplaySize(52, 2);
  });
  hit.on('pointerdown', () => {
    playUiSound('close');
    onClick();
  });
  return hit;
}

function renderFieldButton(
  scene: Phaser.Scene,
  addTo: UiAdd,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  enabled: boolean,
  onClick: () => void,
  accent = UI_FIELD.gold
) {
  const button = addUi(addTo, scene.add.rectangle(x, y, w, h, enabled ? 0x141b22 : 0x0b1017, enabled ? 0.96 : 0.55)
    .setStrokeStyle(1, enabled ? accent : 0x3f4c58, enabled ? 0.9 : 0.45));
  addUi(addTo, scene.add.rectangle(x, y - h / 2 + 4, w - 18, 2, accent, enabled ? 0.78 : 0.25));
  const iconId = buttonIconForLabel(label);
  const iconSize = Math.min(28, h - 10);
  const icon = iconId ? addUiIconImage(scene, iconId, x - w / 2 + iconSize / 2 + 9, y + 1, iconSize) : undefined;
  if (icon) {
    icon.setAlpha(enabled ? 0.95 : 0.42);
    addUi(addTo, icon);
  }
  const textX = icon ? x + Math.min(12, w * 0.08) : x;
  const text = addUi(addTo, scene.add.text(textX, y - 8, label, {
    fontFamily: UI_FONT,
    fontSize: '14px',
    fontStyle: UI_BOLD,
    color: enabled ? UI_FIELD.warm : '#596a78'
  }).setOrigin(0.5, 0));
  if (enabled) {
    button.setInteractive({ useHandCursor: true });
    button.on('pointerover', () => {
      button.setFillStyle(0x1b2630, 0.98);
      text.setColor('#ffffff');
    });
    button.on('pointerout', () => {
      button.setFillStyle(0x141b22, 0.96);
      text.setColor(UI_FIELD.warm);
    });
    button.on('pointerdown', () => {
      playUiSound('confirm');
      onClick();
    });
  }
  return button;
}

function playUiSound(kind: 'confirm' | 'close' | 'locked' = 'confirm') {
  try {
    const AudioContextCtor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const freq = kind === 'close' ? 280 : kind === 'locked' ? 150 : 420;
    osc.type = kind === 'locked' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(kind === 'close' ? 190 : freq * 1.45, now + 0.06);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === 'locked' ? 0.025 : 0.035, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // UI sound is cosmetic; browsers may block or omit WebAudio in test contexts.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getInspectedEntry(cards: Array<{ card: Card; zone: string }>, inspectedCardId: string | undefined) {
  return cards.find(({ card }) => card.id === inspectedCardId) ?? cards[0];
}

function inspectedCardPayload(entry: { card: Card; zone: string } | undefined, costOverride?: number, molting = false) {
  if (!entry) return undefined;
  const contract = activeCardContract(entry.card, molting);
  return {
    id: entry.card.id,
    name: displayName(entry.card),
    bird: entry.card.bird,
    zone: entry.zone,
    cost: costOverride ?? entry.card.cost,
    type: entry.card.type,
    target: entry.card.target,
    activeTarget: contract.target,
    activeRole: contract.role,
    activeText: contract.text,
    usesMolt: contract.usesMolt,
    baseText: entry.card.text,
    upgradedText: entry.card.upgradedText,
    flockStats: Object.entries(entry.card.runtime.flockStats).map(([key, value]) => ({
      label: flockStatLabel(key),
      value
    }))
  };
}

function renderFloatingCardDetail(scene: Phaser.Scene, card: Card, zone: string, cost: number, anchorX: number, anchorY: number, molting = false) {
  const w = 300;
  const h = 450;
  const margin = 18;
  const cx = anchorX < GAME_WIDTH / 2
    ? Math.min(GAME_WIDTH - w / 2 - margin, anchorX + 232)
    : Math.max(w / 2 + margin, anchorX - 232);
  const cy = Math.max(h / 2 + margin, Math.min(GAME_HEIGHT - h / 2 - margin, anchorY));
  const left = cx - w / 2;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  const accent = card.upgraded ? 0x24d0d6 : card.type === 'major' ? 0xd8a840 : card.type === 'molt' ? 0xc56cff : suitAccentColor(card);
  const contract = activeCardContract(card, molting);
  const container = scene.add.container(0, 0);
  const add = (child: Phaser.GameObjects.GameObject) => { container.add(child); return child; };

  add(scene.add.rectangle(cx, cy, w + 8, h + 8, 0x06090f, 0.99).setStrokeStyle(3, accent, 1));
  const key = loadedCardArtKey(scene, card);
  if (key && scene.textures.exists(key)) {
    add(scene.add.image(cx, cy, key).setDisplaySize(w, h).setAlpha(0.98));
  } else if (!renderSnagCardBorder(scene, (obj) => add(obj), card, cx, cy, w, h, 0.98)) {
    add(scene.add.rectangle(cx, cy, w, h, 0x141d2b, 0.95));
    add(scene.add.text(cx, cy - 42, cardLabel(card), {
      fontFamily: UI_FONT, fontSize: '18px', fontStyle: UI_BOLD, color: '#7ab8d6',
      wordWrap: { width: w - 50 }, align: 'center'
    }).setOrigin(0.5));
  } else {
    add(scene.add.rectangle(cx, cy, w, h, 0x05101a, 0.12));
  }

  add(scene.add.rectangle(cx, top + 24, w - 4, 44, 0x05080e, 0.76));
  add(scene.add.text(left + 52, top + 9, displayName(card), {
    fontFamily: UI_FONT, fontSize: '20px', fontStyle: UI_BOLD, color: '#ffe7b0', wordWrap: { width: w - 72 }
  }));
  add(scene.add.circle(left + 26, top + 24, 20, cost === 0 ? 0x24d0d6 : 0xe8b830, 1).setStrokeStyle(2, 0x05080e, 0.9));
  add(scene.add.text(left + 26, top + 24, `${cost}`, {
    fontFamily: UI_FONT, fontSize: '23px', fontStyle: UI_BOLD, color: '#06101c'
  }).setOrigin(0.5));

  add(scene.add.rectangle(cx, top + 60, w - 4, 24, 0x05080e, 0.68));
  add(scene.add.text(cx, top + 54, `${card.bird} / ${cardLabel(card)} / ${zone}`, {
    fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: UI_CYAN,
    align: 'center', wordWrap: { width: w - 16 }
  }).setOrigin(0.5, 0));

  const panelH = card.moltText || contract.usesMolt ? 202 : 170;
  add(scene.add.rectangle(cx, bottom - panelH / 2 - 4, w - 4, panelH, 0x05080e, 0.93));
  add(scene.add.rectangle(cx, bottom - panelH - 4, w - 4, 2, accent, 0.85));
  let yy = bottom - panelH + 8;
  const tx = left + 16;
  const wrap = w - 32;
  if (contract.usesMolt) {
    add(scene.add.rectangle(left + 50, yy + 8, 84, 20, 0x2a1208, 0.92)
      .setStrokeStyle(1, 0xff9d4d, 0.72));
    add(scene.add.text(left + 50, yy + 2, 'MOLT', {
      fontFamily: UI_FONT, fontSize: '10px', fontStyle: UI_BOLD, color: '#ffc78f',
      align: 'center',
      fixedWidth: 74
    }).setOrigin(0.5, 0));
    yy += 27;
  }
  add(scene.add.text(tx, yy, `${targetLabel(contract.target)} / ${contract.role.toUpperCase()}`, {
    fontFamily: UI_FONT, fontSize: '10px', fontStyle: UI_BOLD, color: contract.usesMolt ? '#ffc78f' : '#91a6b8'
  }));
  yy += 15;
  const current = add(scene.add.text(tx, yy, contract.text, {
    fontFamily: UI_FONT, fontSize: '12px', color: '#dce8f2', lineSpacing: 1, wordWrap: { width: wrap }, maxLines: 3
  })) as Phaser.GameObjects.Text;
  yy += current.height + 8;
  add(scene.add.text(tx, yy, contract.usesMolt ? 'Base' : 'Preen', {
    fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: UI_GOLD
  }));
  yy += 15;
  const upgraded = add(scene.add.text(tx, yy, contract.usesMolt ? displayText(card) : card.upgraded ? 'Already preened.' : card.upgradedText, {
    fontFamily: UI_FONT, fontSize: '12px', color: '#cfe0ef', lineSpacing: 1, wordWrap: { width: wrap }, maxLines: 2
  })) as Phaser.GameObjects.Text;
  yy += upgraded.height + 8;
  if (!contract.usesMolt && card.moltText && yy < bottom - 40) {
    add(scene.add.text(tx, yy, 'Molt', {
      fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: '#ffc78f'
    }));
    yy += 15;
    const molt = add(scene.add.text(tx, yy, card.upgraded && card.moltTextUpgraded ? card.moltTextUpgraded : card.moltText, {
      fontFamily: UI_FONT, fontSize: '11px', color: '#ffc78f', fontStyle: UI_BOLD, lineSpacing: 1, wordWrap: { width: wrap }, maxLines: 3
    })) as Phaser.GameObjects.Text;
    yy += molt.height + 7;
  }
  add(scene.add.text(tx, Math.min(yy, bottom - 28), 'Flock Stats', {
    fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: UI_GOLD
  }));
  const stats = cardStatRows(card);
  add(scene.add.text(tx, bottom - 16, stats.length > 0 ? stats.join('   ') : 'None', {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: stats.length > 0 ? '#8df4ff' : '#91a6b8',
    align: 'center',
    wordWrap: { width: wrap }
  }).setOrigin(0, 1));
  return container;
}

function renderSceneCardDetail(scene: Phaser.Scene, card: Card, zone: string, cost: number, molting = false) {
  const accent = card.upgraded ? 0x24d0d6 : card.type === 'major' ? 0xd8a840 : 0x7ab8d6;
  const contract = activeCardContract(card, molting);
  renderFieldPanel(scene, (obj) => {}, DECK_DETAIL_LAYOUT.panelCx, DECK_DETAIL_LAYOUT.panelCy, DECK_DETAIL_LAYOUT.panelW, DECK_DETAIL_LAYOUT.panelH, { accent, fill: UI_FIELD.ink });

  const key = loadedCardArtKey(scene, card);
  if (key && scene.textures.exists(key)) {
    scene.add.image(DECK_DETAIL_LAYOUT.artX, DECK_DETAIL_LAYOUT.artY, key)
      .setDisplaySize(DECK_DETAIL_LAYOUT.artW, DECK_DETAIL_LAYOUT.artH)
      .setAlpha(0.92);
  } else if (!renderSnagCardBorder(scene, undefined, card, DECK_DETAIL_LAYOUT.artX, DECK_DETAIL_LAYOUT.artY, DECK_DETAIL_LAYOUT.artW, DECK_DETAIL_LAYOUT.artH, 0.92)) {
    scene.add.rectangle(DECK_DETAIL_LAYOUT.artX, DECK_DETAIL_LAYOUT.artY, DECK_DETAIL_LAYOUT.artW, DECK_DETAIL_LAYOUT.artH, 0x141f2f, 0.95)
      .setStrokeStyle(1, 0x49606d, 0.8);
    scene.add.text(DECK_DETAIL_LAYOUT.artX, DECK_DETAIL_LAYOUT.artY, cardLabel(card), {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: '#7ab8d6',
      wordWrap: { width: 190 },
      align: 'center'
    }).setOrigin(0.5);
  } else {
    scene.add.rectangle(DECK_DETAIL_LAYOUT.artX, DECK_DETAIL_LAYOUT.artY, DECK_DETAIL_LAYOUT.artW, DECK_DETAIL_LAYOUT.artH, 0x05101a, 0.12);
  }

  scene.add.circle(DECK_DETAIL_LAYOUT.costX, DECK_DETAIL_LAYOUT.costY, 18, cost === 0 ? 0x24d0d6 : 0xd8a840, 1);
  scene.add.text(DECK_DETAIL_LAYOUT.costX, DECK_DETAIL_LAYOUT.costY, `${cost}`, {
    fontFamily: UI_FONT,
    fontSize: '17px',
    fontStyle: UI_BOLD,
    color: '#07101c'
  }).setOrigin(0.5);
  scene.add.text(DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.titleY, displayName(card), {
    fontFamily: UI_FONT,
    fontSize: '26px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
    wordWrap: { width: DECK_DETAIL_LAYOUT.textW }
  });
  scene.add.text(DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.metaY, `${card.bird} / ${cardLabel(card)} / ${zone}`, {
    fontFamily: UI_FONT,
    fontSize: '15px',
    fontStyle: UI_BOLD,
    color: '#7ab8d6',
    wordWrap: { width: DECK_DETAIL_LAYOUT.textW }
  });
  scene.add.text(DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.targetY, `${targetLabel(contract.target)} / ${contract.role.toUpperCase()}`, {
    fontFamily: UI_FONT,
    fontSize: '14px',
    color: contract.usesMolt ? '#ffc78f' : UI_SOFT
  });
  if (contract.usesMolt) {
    scene.add.rectangle(DECK_DETAIL_LAYOUT.textX + 40, DECK_DETAIL_LAYOUT.statusY + 9, 80, 22, 0x2a1208, 0.96)
      .setStrokeStyle(1, 0xff9d4d, 0.82);
    scene.add.text(DECK_DETAIL_LAYOUT.textX + 40, DECK_DETAIL_LAYOUT.statusY, 'MOLT', {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: '#ffc78f',
      align: 'center',
      fixedWidth: 72
    }).setOrigin(0.5, 0);
  }
  scene.add.text(DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.currentHeaderY, contract.usesMolt ? 'Now (Molt)' : 'Now', detailHeaderStyle());
  scene.add.text(DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.currentBodyY, contract.text, detailBodyStyle(DECK_DETAIL_LAYOUT.textW, 3));
  scene.add.text(DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.alternateHeaderY, contract.usesMolt ? 'Base' : 'Preen', detailHeaderStyle());
  scene.add.text(DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.alternateBodyY, contract.usesMolt ? displayText(card) : card.upgraded ? 'Already preened.' : card.upgradedText, detailBodyStyle(DECK_DETAIL_LAYOUT.textW, 2));
  scene.add.text(DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.statsHeaderY, 'Flock Stats', detailHeaderStyle());
  const stats = cardStatRows(card);
  scene.add.text(DECK_DETAIL_LAYOUT.textX, DECK_DETAIL_LAYOUT.statsY, stats.length > 0 ? stats.join('   ') : 'None', {
    fontFamily: UI_FONT,
    fontSize: '14px',
    fontStyle: UI_BOLD,
    color: stats.length > 0 ? '#8df4ff' : '#91a6b8',
    wordWrap: { width: DECK_DETAIL_LAYOUT.textW }
  });
}

function detailHeaderStyle() {
  return {
    fontFamily: UI_FONT,
    fontSize: '15px',
    fontStyle: UI_BOLD,
    color: UI_GOLD
  };
}

function detailBodyStyle(width: number, maxLines?: number) {
  return {
    fontFamily: UI_FONT,
    fontSize: '14px',
    color: '#dce8f2',
    lineSpacing: 3,
    wordWrap: { width },
    ...(maxLines ? { maxLines } : {})
  };
}

function targetLabel(target: TargetType) {
  if (target === 'allEnemies') return 'All Enemies';
  if (target === 'self') return 'Flock';
  if (target === 'none') return 'No Target';
  if (target === 'choice') return 'Choice';
  return 'Enemy';
}

function flockStatLabel(key: string) {
  if (key === 'cohesion') return 'Cohesion';
  if (key === 'damage') return 'Damage';
  if (key === 'cover') return 'Cover';
  if (key === 'regen') return 'Regen';
  if (key === 'draw') return 'Hand Target';
  if (key === 'resonance') return 'Start Resonance';
  if (key === 'moltPower') return 'Molt Power';
  if (key === 'openSkyGuard') return 'Open Sky Guard';
  return key;
}

function cardStatRows(card: Card) {
  return cardStatEntries(card).map(({ key, value }) => `${flockStatLabel(key)} +${value}`);
}

function cardStatEntries(card: Card) {
  const rows = Object.entries(card.runtime.flockStats).map(([key, value]) => ({ key, value }));
  if (card.upgraded) {
    rows.push(...Object.entries(card.runtime.upgrade.flockStats).map(([key, value]) => ({ key, value })));
  }
  return rows;
}

function routeNodeTitle(node: RouteNode) {
  if (node.type === 'street') return 'Street';
  if (node.type === 'rival') return 'Rival';
  if (node.type === 'boss') return 'Boss';
  return node.label;
}

// Fallback glyphs for the route map if icon art has not loaded yet.
function routeNodeGlyph(type: RouteNode['type']) {
  switch (type) {
    case 'street': return 'S';
    case 'rival': return 'R';
    case 'boss': return 'B';
    case 'basin': return '~';
    case 'nest': return 'N';
    case 'market': return '$';
    case 'signal': return '?';
    case 'cache': return 'C';
    default: return '?';
  }
}

// Node FILL color encodes the crossing TYPE (so the map is readable at a glance
// without hovering); risk is shown as a small pip + in the legend/side panel.
function routeNodeTypeColor(type: RouteNode['type']) {
  switch (type) {
    case 'street': return 0xd0703a; // combat — orange
    case 'rival': return 0xe0457a;  // elite combat — magenta
    case 'boss': return 0xb33636;   // boss — crimson
    case 'basin': return 0x3fa86a;  // heal/rest — green
    case 'nest': return 0xc88a34;   // upgrade — amber
    case 'market': return 0xe8c24a; // shop — gold
    case 'signal': return 0x9b63d8; // event — purple
    case 'cache': return 0x3fa9c8;  // treasure — cyan
    default: return 0x6a7d90;
  }
}
function routeNodeTypeHex(type: RouteNode['type']) {
  switch (type) {
    case 'street': return '#f0986a';
    case 'rival': return '#ff6f9e';
    case 'boss': return '#ff7a6e';
    case 'basin': return '#6fd69a';
    case 'nest': return '#e8b860';
    case 'market': return '#f5d878';
    case 'signal': return '#c79bf0';
    case 'cache': return '#7fd6ec';
    default: return '#9fb1c4';
  }
}

function routeNodeRiskHex(risk: RouteNode['risk']) {
  if (risk === 'low') return '#f5d38a';
  if (risk === 'medium') return '#ff9d4d';
  return '#ff7a6e';
}

function routeNodeRiskColor(risk: RouteNode['risk']) {
  if (risk === 'low') return 0xf5d38a;
  if (risk === 'medium') return 0xff9d4d;
  return 0xff7a6e;
}

function routeNodeTypeLabel(type: RouteNode['type']) {
  switch (type) {
    case 'street': return 'Street Encounter';
    case 'rival': return 'Rival Crew';
    case 'boss': return 'Boss';
    case 'basin': return 'Lantern Roost';
    case 'nest': return 'Nest Workshop';
    case 'market': return 'Market';
    case 'signal': return 'Signal';
    case 'cache': return 'Rooftop Cache';
    default: return 'Crossing';
  }
}

function routeEventAccent(type: RouteNode['type']) {
  switch (type) {
    case 'basin': return UI_FIELD.green;
    case 'nest': return UI_FIELD.cyan;
    case 'market': return UI_FIELD.gold;
    case 'signal': return 0xc9a6ff;
    case 'cache': return 0xffcf6b;
    default: return UI_FIELD.gold;
  }
}

function routeEventLandmarkLine(type: RouteNode['type']) {
  switch (type) {
    case 'basin': return 'A warm roost landmark where recovery is treated like careful maintenance.';
    case 'nest': return 'A rooftop workshop landmark for tuning the flock before the next crossing.';
    case 'market': return 'A stall-lined landmark where route currency turns into momentum.';
    case 'signal': return 'A signal landmark where one choice changes the shape of the route.';
    case 'cache': return 'A hidden rooftop cache with one useful find waiting in the open.';
    default: return 'A marked crossing on the route.';
  }
}

function nonCombatLesson(type: RouteNode['type']) {
  switch (type) {
    case 'basin': return 'Recover Cohesion, take shelter for Open Sky Guard, or trade Scrap for a Supply.';
    case 'nest': return 'Preen or Remove a card, or buy a Waymark to shape the deck.';
    case 'market': return 'Spend Scrap on cards, Waymarks, Supplies, and Preen/Remove.';
    case 'signal': return 'A route choice with trade-offs in Scrap, Cohesion, and risk.';
    case 'cache': return 'Choose one reward from the rooftop stash.';
    default: return 'A crossing on the route.';
  }
}

function waymarkGlyph(mark: RuntimeRouteMark) {
  switch (mark.family) {
    case 'safety': return '+';
    case 'route': return '>';
    case 'economy': return '$';
    case 'suit': return '*';
    case 'molt': return '^';
    case 'bossPrep': return '!';
    default: return '#';
  }
}

function routeMarkAccent(mark: RuntimeRouteMark) {
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

function routeMarkFamilyLabel(family: RuntimeRouteMark['family']) {
  switch (family) {
    case 'safety': return 'Shelter';
    case 'economy': return 'Economy';
    case 'route': return 'Tempo';
    case 'suit': return 'Suit';
    case 'molt': return 'Molt';
    case 'bossPrep': return 'Boss';
    default: return 'Waymark';
  }
}

function routeMarkEffects(mark: RuntimeRouteMark): string[] {
  if (Array.isArray(mark.effects) && mark.effects.length > 0) return mark.effects;
  return mark.effect ? [mark.effect] : [];
}

function routeMarkEffectText(mark: RuntimeRouteMark): string {
  return formatEffects(routeMarkEffects(mark));
}

function routeMarkEffectGrammar(mark: RuntimeRouteMark): string {
  return routeMarkEffects(mark).join(' -> ');
}

function supplyAccent(supply: RuntimeSupply) {
  switch (supply.category) {
    case 'snack': return 0x8fd6a0;
    case 'flare': return 0xffcf6b;
    case 'tool': return 0x7ab8d6;
    case 'call': return 0xc9a6ff;
    default: return 0xffb86b;
  }
}

function supplyCategoryLabel(supply: RuntimeSupply) {
  switch (supply.category) {
    case 'snack': return 'Snack';
    case 'flare': return 'Signal';
    case 'tool': return 'Tool';
    case 'call': return 'Call';
    default: return supply.category;
  }
}

function supplyTimingLabel(supply: RuntimeSupply) {
  switch (supply.timing) {
    case 'route': return 'Route';
    case 'combat': return 'Combat';
    case 'either': return 'Flexible';
    default: return supply.timing;
  }
}

function supplyAnswerLabel(supply: RuntimeSupply) {
  switch (supply.answerType) {
    case 'coverNow': return 'Cover';
    case 'healNow': return 'Recovery';
    case 'drawNow': return 'Draw';
    case 'wingbeatNow': return 'Wingbeat';
    case 'damageNow': return 'Damage';
    case 'antiCover': return 'Anti-Cover';
    case 'cleanseNow': return 'Cleanse';
    case 'openSkySafety': return 'Open Sky';
    case 'handFix': return 'Hand Fix';
    case 'moltNow': return 'Molt';
    case 'burstNow': return 'Burst';
    case 'tellControl': return 'Intel';
    default: return supply.answerType;
  }
}

function addSynergyTag(tags: string[], tag: string) {
  if (!tags.includes(tag)) tags.push(tag);
}

function authoredEffectBodies(effects: string[]) {
  return effects.flatMap((effect) => {
    const conditional = effect.match(/^if ([a-zA-Z][a-zA-Z0-9]*(?:\([^)]+\))?) then (.+)$/);
    return conditional ? [conditional[1], conditional[2]] : [effect];
  });
}

function effectVerb(effect: string) {
  return parseEffect(effect)?.name ?? '';
}

function supplySynergyTags(supply: RuntimeSupply) {
  const tags: string[] = [];
  const bodies = authoredEffectBodies(supply.effects);
  const text = `${supply.answerType} ${supply.timing} ${supply.effects.join(' ')}`.toLowerCase();
  const verbs = new Set(bodies.map(effectVerb));
  if (supply.timing === 'route') addSynergyTag(tags, 'Route');
  if (supply.timing === 'combat') addSynergyTag(tags, 'Combat');
  if (supply.timing === 'either') addSynergyTag(tags, 'Flexible');
  if (text.includes('visitednodetype')) addSynergyTag(tags, 'Route Memory');
  if (verbs.has('gainCover') || supply.answerType === 'coverNow') addSynergyTag(tags, 'Cover');
  if (verbs.has('healCohesion') || verbs.has('heal') || supply.answerType === 'healNow') addSynergyTag(tags, 'Recovery');
  if (verbs.has('draw') || verbs.has('nextTurnDraw') || supply.answerType === 'drawNow') addSynergyTag(tags, 'Draw');
  if (verbs.has('gainWingbeat') || verbs.has('gainEnergyNextTurn') || supply.answerType === 'wingbeatNow') addSynergyTag(tags, 'Wingbeat');
  if (verbs.has('damage') || verbs.has('damageAll') || verbs.has('damagePierce') || supply.answerType === 'damageNow') addSynergyTag(tags, 'Pressure');
  if (verbs.has('removeCover') || supply.answerType === 'antiCover') addSynergyTag(tags, 'Anti-Cover');
  if (verbs.has('cleanseFlock') || supply.answerType === 'cleanseNow') addSynergyTag(tags, 'Cleanse');
  if (verbs.has('gainSupplyChoice') || verbs.has('gainSupply')) addSynergyTag(tags, 'Packs Supply');
  if (verbs.has('increaseSupplySlots')) addSynergyTag(tags, 'Capacity');
  if (verbs.has('repeatNextSupply')) addSynergyTag(tags, 'Supply Combo');
  if (verbs.has('retainHand') || supply.answerType === 'handFix') addSynergyTag(tags, 'Hand Fix');
  if (verbs.has('enterMolt') || supply.answerType === 'moltNow') addSynergyTag(tags, 'Molt');
  if (verbs.has('peekNextNodes') || supply.answerType === 'tellControl') addSynergyTag(tags, 'Intel');
  return tags.slice(0, 5);
}

function waymarkSynergyTags(mark: RuntimeRouteMark) {
  const tags: string[] = [];
  const verbs = new Set(routeMarkEffects(mark).map(effectVerb));
  addSynergyTag(tags, routeMarkFamilyLabel(mark.family));
  if (mark.rarity === 'boss') addSynergyTag(tags, 'Boss');
  if (mark.trigger.startsWith('onSuitPlayed')) addSynergyTag(tags, 'Suit Engine');
  if (mark.trigger === 'onSupplyUsed') addSynergyTag(tags, 'Supply Combo');
  if (mark.trigger === 'onEnemyCoverBroken') addSynergyTag(tags, 'Anti-Cover');
  if (mark.trigger === 'onEnterMolt') addSynergyTag(tags, 'Molt');
  if (mark.trigger === 'onHealFlock' || mark.trigger === 'basinHeal') addSynergyTag(tags, 'Recovery');
  if (mark.trigger === 'cacheChoice') addSynergyTag(tags, 'Cache');
  if (mark.trigger === 'signalResolved') addSynergyTag(tags, 'Signal');
  if (mark.trigger === 'afterStreetEncounter' || mark.trigger === 'afterMarketPurchase') addSynergyTag(tags, 'Economy');
  if (mark.trigger === 'mapStart') addSynergyTag(tags, 'Next District');
  if (verbs.has('gainCover') || verbs.has('bossDamageShield') || verbs.has('gainCoverPerWaymark')) addSynergyTag(tags, 'Cover');
  if (verbs.has('heal') || verbs.has('addHeal')) addSynergyTag(tags, 'Recovery');
  if (verbs.has('draw') || verbs.has('nextTurnDraw')) addSynergyTag(tags, 'Draw');
  if (verbs.has('gainWingbeat') || verbs.has('gainEnergyNextTurn')) addSynergyTag(tags, 'Wingbeat');
  if (verbs.has('gainOpenSkyGuard') || verbs.has('reduceOpenSky') || verbs.has('reduceNextOpenSky')) addSynergyTag(tags, 'Open Sky');
  if (verbs.has('gainScrap') || verbs.has('reducePreenPrice')) addSynergyTag(tags, 'Economy');
  if (verbs.has('damageAll') || verbs.has('damage') || verbs.has('damagePierce')) addSynergyTag(tags, 'Pressure');
  if (verbs.has('gainResonance')) addSynergyTag(tags, 'Resonance');
  if (verbs.has('extraCacheChoice')) addSynergyTag(tags, 'Cache');
  if (verbs.has('freePreenNextDistrict') || verbs.has('districtStartKit')) addSynergyTag(tags, 'Preen');
  return tags.slice(0, 5);
}

// Human-readable summary of route-effect verbs for the node-choice overlay.
function routeEffectSummary(effects: string[]): string {
  if (effects.length === 0) return 'No cost';
  return effects.map((effect) => {
    const parsed = parseEffect(effect);
    if (effect === 'startRivalBattle') return 'Start rival battle';
    if (!parsed) return effect;
    const a = parsed.args[0] ?? '';
    switch (parsed.name) {
      case 'gainScrap': return `+${a} Scrap`;
      case 'payScrap': return `Pay ${a} Scrap`;
      case 'loseCohesion': return `-${a} Cohesion`;
      case 'healCohesion': case 'heal': return `Heal ${a} Cohesion`;
      case 'healMissingPct': return `Heal ${a}% missing Cohesion`;
      case 'gainRouteMark':
        if (a === 'randomRare') return 'Gain a rare Waymark';
        if (a === 'randomUncommonOrRare') return 'Gain a high-tier Waymark';
        return alphaRouteMarkLibrary.get(a) ? `Gain ${alphaRouteMarkLibrary.get(a)!.name}` : 'Gain a Waymark';
      case 'gainSupply': return 'Gain a Supply';
      case 'gainSupplyChoice': return 'Choose a Supply';
      case 'peekNextNodes': return `Preview ${a || 1} route`;
      case 'gainCacheReward': return 'Open the cache';
      case 'addSnagToDiscard': case 'addSnagToDraw': return 'Add a Snag to the deck';
      case 'addCard':
        if (a === 'chooseOneOfTwoRare') return 'Choose a rare card';
        if (a === 'randomRare') return 'Add a rare card';
        if (a === 'chooseOneOfTwoUncommonOrRare') return 'Choose a high-tier card';
        if (a === 'randomUncommonOrRare') return 'Add a high-tier card';
        return 'Add a card to the flock';
      case 'preenCard': return `Preen ${a || 1}`;
      case 'releaseCard': return `Remove ${a || 1}`;
      case 'gainOpenSkyGuard': return `+${a} Open Sky Guard next combat`;
      case 'reduceNextOpenSky': return `Soften next Open Sky by ${a}`;
      case 'enemyCoverNextCombat': return `Next enemy starts +${a} Cover`;
      case 'bossDamageShield': return `Boss fight starts +${a} Cover`;
      case 'extraCacheChoice': return `Caches offer +${a} choice`;
      case 'freePreenNextDistrict': return `Next district starts with ${a || 1} free Preen`;
      case 'increaseSupplySlots': return `Supply capacity +${a || 1}`;
      case 'startNextCombatOpenSky': return 'Next combat starts in Open Sky';
      case 'revealNodes': return `Reveal ${a} nodes`;
      case 'skipNextStreet': return 'Skip the next street encounter';
      case 'removeRouteChoice': return 'Close a route';
      default: return parsed.name;
    }
  }).join(' / ');
}

function routeEffectSummaryWithPreview(
  effects: string[],
  previewItem?: PendingRouteRewardItem,
  previewCards: Card[] = []
): string {
  if (effects.length === 0) return 'No cost';
  return effects.map((effect) => {
    const parsed = parseEffect(effect);
    if (!parsed) return effect === 'startRivalBattle' ? 'Start rival battle' : effect;
    if (previewItem?.kind === 'supply' && (parsed.name === 'gainSupply' || parsed.name === 'gainSupplyChoice')) {
      const supply = alphaSupplyLibrary.get(previewItem.id);
      return supply ? `Gain ${supply.name}` : routeEffectSummary([effect]);
    }
    if (previewItem?.kind === 'waymark' && parsed.name === 'gainRouteMark') {
      const mark = alphaRouteMarkLibrary.get(previewItem.id);
      return mark ? `Gain ${mark.name}` : routeEffectSummary([effect]);
    }
    if ((parsed.name === 'addSnagToDiscard' || parsed.name === 'addSnagToDraw') && previewCards.length > 0) {
      const card = previewCards.find((candidate) => candidate.id === parsed.args[0]) ?? previewCards[0];
      return `Add ${displayName(card)} to the deck`;
    }
    if (parsed.name === 'addCard' && previewCards.length > 0) {
      const card = previewCards.find((candidate) => candidate.runtime.kind !== 'snag');
      return card ? `Add ${displayName(card)}` : routeEffectSummary([effect]);
    }
    return routeEffectSummary([effect]);
  }).join(' / ');
}

interface RouteEffectToken {
  label: string;
  color: number;
  textColor: string;
  icon?: UiIconId;
  scrap?: boolean;
}

function routeEffectTokens(effects: string[]): RouteEffectToken[] {
  if (effects.length === 0) {
    return [{ label: 'No cost', color: 0x49606d, textColor: '#b9c7d6', icon: 'route-pin' }];
  }
  return effects.map((effect) => {
    const parsed = parseEffect(effect);
    if (effect === 'startRivalBattle') {
      return { label: 'Rival', color: UI_FIELD.danger, textColor: '#ffd5cc', icon: 'release-card' };
    }
    if (!parsed) {
      return { label: effect, color: 0x49606d, textColor: '#dbe6f2', icon: 'route-pin' };
    }
    const a = parsed.args[0] ?? '';
    switch (parsed.name) {
      case 'gainScrap': return { label: `+${a}`, color: UI_FIELD.gold, textColor: '#fff0b8', scrap: true };
      case 'payScrap': return { label: `-${a}`, color: UI_FIELD.danger, textColor: '#ffd5cc', scrap: true };
      case 'loseCohesion': return { label: `-${a}`, color: UI_FIELD.danger, textColor: '#ffd5cc', icon: 'flock-heart' };
      case 'healCohesion':
      case 'heal': return { label: `+${a}`, color: UI_FIELD.green, textColor: '#e4fbe9', icon: 'flock-heart' };
      case 'healMissingPct': return { label: `Heal ${a}%`, color: UI_FIELD.green, textColor: '#e4fbe9', icon: 'flock-heart' };
      case 'gainRouteMark': return {
        label: a === 'randomRare' ? 'Rare Waymark' : a === 'randomUncommonOrRare' ? 'High Waymark' : 'Waymark',
        color: UI_FIELD.violet,
        textColor: '#efe4ff',
        icon: 'waymark-compass'
      };
      case 'gainSupply':
      case 'gainSupplyChoice': return { label: parsed.name === 'gainSupplyChoice' ? 'Supply choice' : 'Supply', color: 0xffb86b, textColor: '#ffe7c9', icon: 'supply-pouch' };
      case 'peekNextNodes':
      case 'revealNodes': return { label: `Preview ${a || 1}`, color: UI_FIELD.cyan, textColor: '#dffbff', icon: 'route-pin' };
      case 'gainCacheReward': return { label: 'Cache', color: UI_FIELD.gold, textColor: '#fff0b8', icon: 'locked-padlock' };
      case 'addSnagToDiscard':
      case 'addSnagToDraw': return { label: 'Snag', color: UI_FIELD.danger, textColor: '#ffd5cc', icon: 'release-card' };
      case 'addCard': return {
        label: a === 'chooseOneOfTwoRare' || a === 'randomRare'
          ? 'Rare card'
          : a === 'chooseOneOfTwoUncommonOrRare' || a === 'randomUncommonOrRare'
            ? 'High card'
            : 'Card',
        color: UI_FIELD.gold,
        textColor: '#fff0b8',
        icon: 'deck-stack'
      };
      case 'preenCard': return { label: `Preen ${a || 1}`, color: UI_FIELD.cyan, textColor: '#dffbff', icon: 'preen-kit' };
      case 'releaseCard': return { label: `Remove ${a || 1}`, color: UI_FIELD.danger, textColor: '#ffd5cc', icon: 'release-card' };
      case 'gainOpenSkyGuard': return { label: `Guard ${a}`, color: UI_FIELD.green, textColor: '#e4fbe9', icon: 'cover-shield' };
      case 'reduceNextOpenSky': return { label: `Sky -${a}`, color: UI_FIELD.cyan, textColor: '#dffbff', icon: 'cover-shield' };
      case 'enemyCoverNextCombat': return { label: `Enemy +${a}`, color: UI_FIELD.danger, textColor: '#ffd5cc', icon: 'cover-shield' };
      case 'bossDamageShield': return { label: `Boss +${a}`, color: UI_FIELD.danger, textColor: '#ffd5cc', icon: 'cover-shield' };
      case 'extraCacheChoice': return { label: `Cache +${a}`, color: UI_FIELD.gold, textColor: '#fff0b8', icon: 'locked-padlock' };
      case 'freePreenNextDistrict': return { label: `Free Preen ${a || 1}`, color: UI_FIELD.cyan, textColor: '#dffbff', icon: 'preen-kit' };
      case 'increaseSupplySlots': return { label: `Slot +${a || 1}`, color: 0xffb86b, textColor: '#ffe7c9', icon: 'supply-pouch' };
      case 'startNextCombatOpenSky': return { label: 'Open Sky', color: UI_FIELD.cyan, textColor: '#dffbff', icon: 'route-pin' };
      case 'skipNextStreet': return { label: 'Skip street', color: UI_FIELD.cyan, textColor: '#dffbff', icon: 'route-pin' };
      case 'removeRouteChoice': return { label: 'Close route', color: UI_FIELD.danger, textColor: '#ffd5cc', icon: 'route-pin' };
      default: return { label: parsed.name, color: 0x49606d, textColor: '#dbe6f2', icon: 'route-pin' };
    }
  });
}

function nonCombatRewardBias(type: RouteNode['type']) {
  switch (type) {
    case 'basin': return 'Healing / Open Sky Guard / Supply';
    case 'nest': return 'Preen / Remove / Waymark';
    case 'market': return 'Cards / Waymarks / Supplies';
    case 'signal': return 'Varies by choice';
    case 'cache': return 'Marn appraises numbered lockbox drawers';
    default: return '';
  }
}

function routeNodeRecovery(node: RouteNode, routeMarkIds: string[] = []) {
  if (node.type === 'basin') {
    const bonus = routeMarkIds.reduce((total, id) => {
      const mark = alphaRouteMarkLibrary.get(id);
      if (!mark || mark.trigger !== 'basinHeal') return total;
      return total + routeMarkEffects(mark).reduce((sum, effect) => {
        const parsed = parseEffect(effect);
        return parsed?.name === 'addHeal' ? sum + parseEffectValue(parsed.args[1] ?? parsed.args[0], 0) : sum;
      }, 0);
    }, 0);
    return 8 + bonus;
  }
  if (node.type === 'cache') return 3;
  return 0;
}

function routeNodeResolutionText(node: RouteNode, result: { recovery?: number; scrap?: number; preened?: Card } = {}) {
  if (node.type === 'basin') return `${node.label}: the flock recovers ${result.recovery ?? 0} Cohesion.`;
  if (node.type === 'nest') {
    return result.preened
      ? `${node.label}: ${result.preened.name} is preened.`
      : `${node.label}: the flock checks gear; nothing needs preening.`;
  }
  if (node.type === 'market') return `${node.label}: market business settled.`;
  if (node.type === 'cache') return `${node.label}: cache found. +${result.scrap ?? 0} Scrap and a Waymark if available.`;
  if (node.type === 'signal') {
    return result.scrap
      ? `${node.label}: a street signal points the way. +${result.scrap} Scrap.`
      : `${node.label}: a street signal points the way.`;
  }
  return `${node.label}: route stop cleared.`;
}

// Reward tuning lives in encounter reward profiles, not on enemy definitions
// (next-level-data-contracts §3; impl-spec "reward tuning does not live on enemy
// definitions"). Resolve the route node's encounter -> reward profile.
function rewardProfileForRouteNode(routeNode: RouteNode | undefined): RewardProfile | undefined {
  if (!routeNode) return undefined;
  const encounter = alphaEncounterLibrary.get(routeNode.payloadId);
  if (!encounter) return undefined;
  return alphaRewardProfileLibrary.get(encounter.rewardProfileId);
}

function combatScrapReward(routeNode: RouteNode | undefined) {
  const reward = rewardProfileForRouteNode(routeNode)?.scrap;
  if (Array.isArray(reward)) return Math.round((reward[0] + reward[1]) / 2);
  if (typeof reward === 'number') return reward;
  if (routeNode?.type === 'boss') return 120;
  return 0;
}

function createCardTemplate(runtime: RuntimeCard): Card {
  const heldText = runtime.heldEffects?.length ? `Roost: ${formatEffects(runtime.heldEffects)}` : '';
  const baseText = formatEffects(runtime.effects);
  return {
    instanceId: '',
    id: runtime.id,
    name: runtime.displayName,
    type: runtime.id.startsWith('aviary_') ? 'aviary' : runtime.kind === 'legend' ? 'major' : runtime.kind === 'molt' ? 'molt' : 'minor',
    role: runtime.tags.includes('attack') ? 'attack' : runtime.tags.some((tag) => ['cover', 'heal'].includes(tag)) ? 'skill' : 'utility',
    target: runtime.target,
    cost: runtime.cost,
    text: heldText ? `${baseText} ${heldText}` : baseText,
    upgradedText: heldText ? `${formatEffects(runtime.upgrade.effects)} ${heldText}` : formatEffects(runtime.upgrade.effects),
    heldText,
    moltText: runtime.moltEffects?.length ? formatEffects(runtime.moltEffects) : '',
    moltTextUpgraded: runtime.upgrade.moltEffects?.length ? formatEffects(runtime.upgrade.moltEffects) : '',
    bird: runtime.bird,
    runtime
  };
}

function getEncounterRuntime(encounter: number) {
  const payloadId = currentCombatNodes()[Math.min(encounter - 1, currentCombatNodes().length - 1)]?.payloadId;
  return getEncounterRuntimeByPayload(payloadId);
}

// Resolve a combat route node's payloadId (an encounter id) to EVERY enemy the
// encounter declares, via the combined enemy library (Map 1 + districts). Falls
// back to a raw enemy id for backward compatibility (next-level-data-contracts §4).
function getEncounterEnemiesByPayload(payloadId: string | undefined): RuntimeEnemy[] {
  const encounter = payloadId ? alphaEncounterLibrary.get(payloadId) : undefined;
  if (encounter) {
    return encounter.enemies.map((enemyId) => {
      const enemy = alphaEnemyLibrary.get(enemyId);
      if (!enemy) throw new Error(`Encounter ${payloadId} references missing enemy: ${enemyId}`);
      return enemy;
    });
  }
  const enemy = payloadId ? alphaEnemyLibrary.get(payloadId) : undefined;
  if (!enemy) throw new Error(`Missing encounter payload: ${payloadId}`);
  return [enemy];
}

function getEncounterRuntimeByPayload(payloadId: string | undefined): RuntimeEnemy {
  return getEncounterEnemiesByPayload(payloadId)[0];
}

// Select the enemy's current move by walking its attack pattern with intentIndex
// (next-level-data-contracts §2). intentIndex is unbounded; the pattern maps it.
function currentMove(enemy: Enemy): EnemyMove {
  const { moves, attackPattern } = enemy.runtime;
  const byId = (id: string) => moves.find((move) => move.id === id) ?? moves[0];
  const i = enemy.intentIndex;
  switch (attackPattern.type) {
    case 'cycle':
      return byId(attackPattern.moveIds[i % attackPattern.moveIds.length]);
    case 'scripted': {
      const ids = attackPattern.moveIds;
      if (i < ids.length) return byId(ids[i]);
      const loopFrom = attackPattern.loopFrom ?? 0;
      const loopLen = Math.max(1, ids.length - loopFrom);
      return byId(ids[loopFrom + ((i - ids.length) % loopLen)]);
    }
    case 'weighted': {
      // Deterministic weighted cycle: expand entries by weight and walk by
      // intentIndex so frequencies honor the weights AND the telegraphed intent
      // always matches the move that later executes (no per-call RNG drift).
      const expanded = attackPattern.entries.flatMap((entry) =>
        Array<string>(Math.max(1, entry.weight ?? 1)).fill(entry.moveId));
      return byId(expanded[i % expanded.length]);
    }
    case 'conditional': {
      const hit = attackPattern.entries.find((entry) => evalPatternCondition(entry.if, enemy));
      return byId(hit ? hit.moveId : attackPattern.fallback);
    }
    default:
      return moves[i % moves.length];
  }
}

function moveDealsDamage(move: EnemyMove): boolean {
  return move.effects.some((effect) => /(?:^|then )damage\(flock/.test(effect));
}

// Live flock/turn snapshot so the free `currentMove`/`evalPatternCondition`
// functions can evaluate conditional attack patterns (which branch on flock
// state) without a scene reference. BattleScene refreshes it before any move
// is selected for rendering or execution.
interface EnemyMoveContext {
  flock: Flock;
  turn: number;
  c: number;
  z: number;
  h: number;
}

let enemyMoveContext: EnemyMoveContext | null = null;

// The single source of truth for the closed enemy/pattern condition grammar
// (next-level-data-contracts §1.3). Used by both the per-effect gate
// (checkEnemyCondition) and the attack-pattern selector (evalPatternCondition),
// so authored `conditional` patterns branch on exactly the same rules cards do.
function evaluateEnemyCondition(condition: string, enemy: Enemy, context: EnemyMoveContext): boolean {
  const { flock, turn } = context;
  const turnGate = condition.match(/^turn >= (\d+)$/);
  if (turnGate) return turn >= Number(turnGate[1]);
  const playedCardsAtLeast = condition.match(/^playedCardsAtLeast\((\d+)\)$/);
  if (playedCardsAtLeast) return context.c >= Number(playedCardsAtLeast[1]);
  const zeroCostCardsAtLeast = condition.match(/^zeroCostCardsAtLeast\((\d+)\)$/);
  if (zeroCostCardsAtLeast) return context.z >= Number(zeroCostCardsAtLeast[1]);
  if (condition === 'handEmptyAtRoost') return context.c > 0 && context.h === 0;
  if (condition === 'notHitThisTurn') return !enemy.hitThisTurn;
  if (condition === 'flockHasNoCover') return flock.block <= 0;
  if (condition === 'flockHasCover') return flock.block > 0;
  if (condition === 'isMolting') return flock.molt;
  if (condition === 'flockOpenSky') return flock.exposed;
  if (condition === 'flockCohesionBelowHalf') return flock.hp < flock.maxHp / 2;
  if (condition === 'selfBelowHalf') return enemy.hp < enemy.maxHp / 2;
  return false;
}

function evalPatternCondition(condition: string, enemy: Enemy): boolean {
  if (!enemyMoveContext) return false; // no live flock/turn yet → use pattern fallback
  return evaluateEnemyCondition(condition, enemy, enemyMoveContext);
}

function parseEffect(effectText: string) {
  const match = effectText.match(/^([a-zA-Z][a-zA-Z0-9]*)\((.*)\)$/);
  if (!match) return undefined;
  return {
    name: match[1],
    args: match[2].split(',').map((arg) => arg.trim()).filter(Boolean)
  };
}

function parseEffectValue(raw: string | undefined, previousDiscarded: number, winded = 0, cover = 0) {
  if (!raw) return 0;
  const perDiscarded = raw.match(/^(\d+) perDiscarded$/);
  if (perDiscarded) return Number(perDiscarded[1]) * previousDiscarded;
  const perWinded = raw.match(/^(\d+) perWinded$/);
  if (perWinded) return Number(perWinded[1]) * winded; // scales with the target's Winded stacks
  const perCover = raw.match(/^(\d+) perCover$/);
  if (perCover) return Number(perCover[1]) * cover; // scales with the flock's current Cover
  const value = Number(raw.replace('+', ''));
  return Number.isFinite(value) ? value : 0;
}

function formatEffects(effects: string[]) {
  return effects.map((effect) => {
    const conditional = effect.match(/^if ([a-zA-Z][a-zA-Z0-9]*(?:\([^)]+\))?) then (.+)$/);
    if (conditional) return `If ${formatCondition(conditional[1])}: ${formatEffect(conditional[2])}`;
    return formatEffect(effect);
  }).join(' ');
}

function formatCondition(condition: string) {
  return condition
    .replace('firstPlayedThisCombat', 'first played')
    .replace('targetBelowHalf', 'target below half')
    .replace('targetIntendsAttack', 'target attacks')
    .replace('targetHasCover', 'target has Cover')
    .replace('targetWinded', 'target Winded')
    .replace(/^resonanceAtLeast\((\d+)\)$/, '$1+ Resonance')
    .replace(/^windedAtLeast\((\d+)\)$/, 'target $1+ Winded')
    .replace('hasResonance', 'Resonance')
    .replace('noResonance', 'no Resonance')
    .replace('noCover', 'no Cover')
    .replace('spentResonance', 'spent Resonance')
    .replace('isMolting', 'Molting')
    .replace('openSky', 'Open Sky')
    .replace('fullCohesion', 'full Cohesion')
    .replace('cohesionBelowHalf', 'low Cohesion')
    .replace('defeatsEnemy', 'defeats enemy')
    .replace('fullyBlocksNextAttack', 'fully blocks next attack')
    .replace(/^visitedNodeType\(([^)]+)\)$/, 'visited $1')
    .replace(/^playedSuitThisTurn\(([^)]+)\)$/, 'played $1');
}

function formatEffect(effect: string) {
  const parsed = parseEffect(effect);
  if (!parsed) return effect;
  const value = (parsed.args[1] ?? parsed.args[0] ?? '')
    .replace(' perWinded', ' per Winded')
    .replace(' perDiscarded', ' per card discarded')
    .replace(' perCover', ' per Cover');
  switch (parsed.name) {
    case 'damage':
      return `Deal ${value}.`;
    case 'damagePierce':
      return `Deal ${value}, ignoring Cover.`;
    case 'damageAll':
      return `Deal ${value} to all.`;
    case 'removeCover':
      return `Remove ${value} Cover.`;
    case 'gainCover':
      return `Gain ${value} Cover.`;
    case 'applyOpenSky':
      return `Enter Open Sky for ${value}.`;
    case 'loseCover':
      return `Lose ${value} Cover.`;
    case 'damageFlock':
      return `Take ${value} damage.`;
    case 'heal':
      return `Heal ${value}.`;
    case 'healCohesion':
      return `Heal ${value} Cohesion.`;
    case 'healMissingPct':
      return `Heal based on missing Cohesion, up to ${parsed.args[1] ?? value}.`;
    case 'healAlly':
      return `Heal an ally ${value}.`;
    case 'healAllEnemies':
      return `Heal all enemies ${value}.`;
    case 'gainCoverAlly':
      return `Give an ally ${value} Cover.`;
    case 'gainCoverAllEnemies':
      return `Give all enemies ${value} Cover.`;
    case 'nextAttackBonusAlly':
      return `Give an ally +${value} damage.`;
    case 'overhealCover':
      return `Heal ${value}; overflow becomes Cover.`;
    case 'loseCohesion':
      return `Lose ${value} Cohesion.`;
    case 'draw':
      return `Draw ${value}.`;
    case 'discard':
      return `Discard ${value}.`;
    case 'discardUpTo':
      return `Discard up to ${value}.`;
    case 'gainWingbeat':
      return `Gain ${value} Wingbeat.`;
    case 'loseWingbeat':
      return `Lose ${value} Wingbeat.`;
    case 'gainResonance':
      return `Gain ${value} Resonance.`;
    case 'gainScrap':
      return `Gain ${value} Scrap.`;
    case 'payScrap':
      return `Pay ${value} Scrap.`;
    case 'spendResonance':
      return `Spend ${value} Resonance.`;
    case 'resonanceBurst':
      return `Spend all Resonance: deal ${value} damage per point.`;
    case 'windedBurst':
      return `Consume the target's Winded: deal ${value} damage per stack.`;
    case 'applyWinded':
      if (parsed.args[0] === 'flock') return `Apply ${value} Winded to the flock.`;
      return `Apply ${value} Winded.`;
    case 'applyPoison':
      return `Apply ${value} Fouled.`;
    case 'enterMolt':
      return 'Enter Molt.';
    case 'gainOpenSkyGuard':
      return `Gain ${value} Open Sky Guard.`;
    case 'reduceNextOpenSky':
    case 'reduceOpenSky':
      return `Reduce the next Open Sky increase by ${value}.`;
    case 'returnDiscard': {
      const drawAfter = parseEffectValue(parsed.args[1], 0);
      return drawAfter > 0
        ? `Return a card from discard, then draw ${drawAfter}.`
        : 'Return a card from discard.';
    }
    case 'nextCoverBonus':
      return `Next Nest Cover +${value}.`;
    case 'retainHand':
      return `Retain ${value} card${value === '1' ? '' : 's'}.`;
    case 'nextTurnDraw': {
      const n = Number(value);
      if (Number.isFinite(n) && n < 0) return `Draw ${Math.abs(n)} fewer next turn.`;
      return `Draw ${value} next turn.`;
    }
    case 'gainEnergyNextTurn':
      return `Gain ${value} Wingbeat next turn.`;
    case 'enemyNextAttackBonus':
      return `The next enemy attack gains +${value} damage.`;
    case 'enemyGainCover':
      return `The enemy gains ${value} Cover.`;
    case 'repeatNextSupply':
      return `The next Supply resolves ${value} extra time${value === '1' ? '' : 's'}.`;
    case 'cleanseFlock':
      return `Reduce each flock debuff by ${value}.`;
    case 'peekNextNodes':
      return `Preview ${value || 1} route choice${value === '1' ? '' : 's'}.`;
    case 'increaseSupplySlots':
      return `Supply capacity +${value || 1}.`;
    case 'gainSupply':
      return 'Pack a Supply.';
    case 'gainSupplyChoice':
      return `Pack ${value || 1} Supply ${value === '1' ? 'choice' : 'choices'}.`;
    case 'addHeal':
      return `Basin Stops heal +${value} Cohesion.`;
    case 'reducePreenPrice':
      return `Market Preen costs ${value} less Scrap.`;
    case 'gainCoverPerWaymark':
      return `Combat starts with ${value} Cover per Waymark.`;
    case 'gainRouteMark':
      return 'Gain a Waymark.';
    case 'addCard':
      return 'Add a card.';
    case 'addSnagToDiscard':
      return 'Add a Snag to discard.';
    case 'addSnagToDraw':
      return 'Add a Snag to draw.';
    case 'shuffleSelfToDraw':
      return 'Return this to the draw pile after play.';
    case 'exhaustSelf':
      return 'Remove this from combat.';
    case 'bossDamageShield':
      return `Boss fights: gain ${value} Cover.`;
    case 'extraCacheChoice':
      return `Caches offer +${value} choice.`;
    case 'freePreenNextDistrict':
      return `Next district starts with ${value || 1} free Preen.`;
    case 'districtStartKit':
      return `Next district starts with ${value || 1} free Preen and ${value || 1} Supply.`;
    default:
      return effect;
  }
}

interface FlockStatRow { label: string; base: number; bonus: number; total: number; }

// Flock Stats rows from a set of cards. Shared by the in-battle Flock Stats
// overlay and the route-map Flock view so both read identically.
function buildFlockStatRows(cards: Card[], maxHp: number, energyBonus = 0, openSkyGuardCurrent = 0): FlockStatRow[] {
  const stats = aggregateFlockStats(cards);
  return [
    { label: 'Cohesion', base: BASE_COHESION, bonus: stats.cohesion ?? 0, total: maxHp },
    { label: 'Wingbeats', base: BASE_WINGBEATS, bonus: energyBonus, total: BASE_WINGBEATS + energyBonus },
    { label: 'Hand Target', base: BASE_HAND_TARGET, bonus: stats.draw ?? 0, total: BASE_HAND_TARGET + (stats.draw ?? 0) },
    { label: 'Resonance Cap', base: BASE_RESONANCE_CAP, bonus: 0, total: BASE_RESONANCE_CAP },
    { label: 'Damage', base: 0, bonus: stats.damage ?? 0, total: stats.damage ?? 0 },
    { label: 'Cover', base: 0, bonus: stats.cover ?? 0, total: stats.cover ?? 0 },
    { label: 'Regen', base: 0, bonus: stats.regen ?? 0, total: stats.regen ?? 0 },
    { label: 'Start Resonance', base: 0, bonus: stats.resonance ?? 0, total: stats.resonance ?? 0 },
    { label: 'Molt Power', base: 2, bonus: stats.moltPower ?? 0, total: 2 + (stats.moltPower ?? 0) },
    { label: 'Open Sky Guard', base: 0, bonus: stats.openSkyGuard ?? 0, total: Math.max(stats.openSkyGuard ?? 0, openSkyGuardCurrent) },
  ];
}

// Renders the Stat / Base / Flock / Now table. addTo lets each scene re-parent
// the objects into its own layer (BattleScene.root vs the RouteScene display list).
function renderFlockStatTable(
  scene: Phaser.Scene,
  addTo: (obj: Phaser.GameObjects.GameObject) => void,
  rows: FlockStatRow[],
  leftX: number,
  topY: number,
): void {
  addTo(scene.add.text(leftX, topY, 'Stat', tableHeaderStyle()));
  addTo(scene.add.text(leftX + 232, topY, 'Base', tableHeaderStyle()));
  addTo(scene.add.text(leftX + 330, topY, 'Flock', tableHeaderStyle()));
  addTo(scene.add.text(leftX + 446, topY, 'Now', tableHeaderStyle()));
  addTo(scene.add.rectangle(leftX + 270, topY + 25, 540, 1, UI_FIELD.gold, 0.28));
  rows.forEach((row, index) => {
    const y = topY + 37 + index * 33;
    addTo(scene.add.rectangle(leftX + 270, y + 25, 540, 1, 0xffffff, index % 2 === 0 ? 0.08 : 0.04));
    if (row.bonus > 0) addTo(scene.add.rectangle(leftX - 8, y + 9, 3, 18, UI_FIELD.cyan, 0.82));
    addTo(scene.add.text(leftX, y, row.label, tableCellStyle('#ffe1a3')));
    addTo(scene.add.text(leftX + 240, y, `${row.base}`, tableCellStyle('#dce8f2')));
    addTo(scene.add.text(leftX + 338, y, row.bonus > 0 ? `+${row.bonus}` : `${row.bonus}`, tableCellStyle(row.bonus > 0 ? '#8df4ff' : '#91a6b8')));
    addTo(scene.add.text(leftX + 454, y, `${row.total}`, tableCellStyle('#ffffff')));
  });
}

function aggregateFlockStats(cards: Card[]) {
  const stats: Record<string, number> = {};
  for (const card of cards) {
    for (const [key, value] of Object.entries(card.runtime.flockStats)) {
      stats[key] = (stats[key] ?? 0) + value;
    }
    if (card.upgraded) {
      for (const [key, value] of Object.entries(card.runtime.upgrade.flockStats)) {
        stats[key] = (stats[key] ?? 0) + value;
      }
    }
  }
  return stats;
}

function shouldPreserveDrawingBufferForCapture() {
  return typeof window !== 'undefined'
    && (
      window.location.search.includes('capture=1')
      || window.location.search.includes('playwright=1')
      || navigator.webdriver
    );
}

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // prefer WebGL: real texture filtering + mipmaps for crisp art
  title: 'Bird Squad',
  parent: 'game-container',
  backgroundColor: '#08101d',
  // The card art is detailed 1024x1536 illustrations shown small, so we want
  // smooth (LINEAR) minification + mipmaps, NOT nearest-neighbour pixel-art mode.
  pixelArt: false,
  antialias: true,
  roundPixels: false,
  render: {
    mipmapFilter: 'LINEAR_MIPMAP_LINEAR', // trilinear: sharp, alias-free downscaling
    powerPreference: 'high-performance',
    preserveDrawingBuffer: shouldPreserveDrawingBufferForCapture()
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    min: { width: 640, height: 360 },
    max: { width: 1920, height: 1080 }
  },
  input: {
    keyboard: true,
    mouse: true,
    touch: true,
    gamepad: false
  },
  scene: [BootScene, MenuScene, ProfileScene, CodexScene, RouteScene, BattleScene]
};

// --- Global text crispness -------------------------------------------------
// Phaser bakes each Text object to its own canvas at `resolution`x device
// pixels (default 1). Our UI is authored at 1280x720 then FIT-scaled up to the
// display (~1.5x on a 1080p monitor, ~3x on HiDPI), which softens every glyph.
// Bake text at a higher resolution so it stays sharp after upscaling. Card art
// is unaffected — it downsamples through mipmaps. This one patch raises detail
// for every `this.add.text(...)` in the game.
const TEXT_RESOLUTION = Math.min(4, Math.max(3, Math.ceil((window.devicePixelRatio || 1) * 2)));
const _factoryText = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function (
  this: Phaser.GameObjects.GameObjectFactory,
  x: number,
  y: number,
  text: string | string[],
  style?: Phaser.Types.GameObjects.Text.TextStyle
) {
  return _factoryText.call(this, x, y, text, { resolution: TEXT_RESOLUTION, ...style });
};

window.__birdSquadGame = new Phaser.Game(config);
window.__birdSquadCurrentMap = () => currentMap();
