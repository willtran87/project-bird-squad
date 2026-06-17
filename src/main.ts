import Phaser from 'phaser';
import './style.css';
import splashUrl from '../assets/splash/bird-squad-canal-run-splash-v4-menu-pop.webp';
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
import type { EnemyMove, RewardProfile, RouteNode, RuntimeCard, RuntimeEnemy, RuntimeRouteMap, RuntimeRouteMark } from './game/types';
import type { ReserveEnemyContract } from './game/runtime-data';
import { banner, burst, fadeRect, floatingText, impactRing, shakeCamera, strike } from './game/fx';
import { drawPanel } from './game/theme';
import { defaultLeaderId, flockLeaders, getLeader } from './game/leaders';
import { getLeaderLore } from './game/leader-lore';
import { difficultyAdds, difficultyLabel, difficultyMods, MAX_DIFFICULTY } from './game/difficulty';
import { achievements, discoverCards, isLeaderUnlocked, leaderUnlockHints, loadAccount, recordRun, type PlayerAccount } from './game/meta';
import { queueRuntimeImageAssets, uniqueImageAssets, type RuntimeImageAsset } from './game/runtime-images';

type GameMode = 'menu' | 'routeSelection' | 'battle' | 'cardReward' | 'upgradeReward' | 'runComplete' | 'defeat';
type CodexDataModule = typeof import('./game/codex-data');
const codexDataPreload: Promise<CodexDataModule> = import('./game/codex-data');
type InspectOverlay = 'deck' | 'draw' | 'discard' | 'flock';
type CardType = 'major' | 'minor' | 'molt' | 'aviary';
type CardRole = 'attack' | 'skill' | 'utility';
type TargetType = 'enemy' | 'allEnemies' | 'self' | 'none' | 'choice';

interface Flock {
  hp: number;
  maxHp: number;
  block: number;
  weak: number;
  frail: number;
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

interface CombatResultSummary {
  encounterId: string;
  nodeId: string;
  nodeType: RouteNode['type'];
  enemyIds: string[];
  turnsTaken: number;
  damageDealt: number;
  cohesionLost: number;
  killedByMove?: string;
}

interface RouteMark {
  id: string;
  name: string;
  text: string;
  price: number;
}

interface EffectResolutionState {
  previousDiscarded: number;
  previousDamageDefeated: boolean;
  spentResonance: boolean;
  returnSelfToDraw: boolean;
  builtFlow: boolean;
}

type EnemyMotionCue = 'attack' | 'hit';

interface RenderPayload {
  mode: GameMode;
  scene: string;
  encounter: number;
  turn: number;
  energy: number;
  resonance: number;
  selectedCard?: string;
  inspectedCard?: {
    id: string;
    name: string;
    bird: string;
    zone: string;
    cost: number;
    type: CardType;
    target: TargetType;
    activeTarget?: TargetType;
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
    statuses: string[];
  };
  hand: Array<{ id: string; name: string; bird: string; cost: number; type: CardType; target: TargetType; activeTarget?: TargetType; activeText?: string; usesMolt?: boolean }>;
  rewardChoices?: Array<{ id: string; name: string; bird: string; cost: number; type: CardType; target: TargetType }>;
  upgradeChoices?: Array<{ id: string; name: string; bird: string; cost: number; type: CardType; target: TargetType }>;
  enemies: Array<{
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    block: number;
    weak: number;
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
    battlefieldAssetKey?: string;
    battlefieldVariant?: boolean;
    battlefieldMood?: 'street' | 'rival' | 'boss';
  };
  inspectOverlay?: InspectOverlay;
  waymarkDrawerOpen?: boolean;
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
const MENU_BORDER_WIDTH = 1.5;
const MENU_BORDER_COLOR = 0x7ab8d6;
const HAND_Y = 590;
const CARD_W = 164;
const CARD_H = 246; // true 2:3 card aspect (art is 1024x1536)
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
const FLOCK_HP_BAR = { x: 230, y: 44, w: 300, h: 24 };
// A suit's keystone aura activates once the flock holds this many of that suit.
// (A suit-biased Leader's starter deck already crosses it, so each Leader opens
// with their keystone live; the balanced Fledgling opens with none.)
const KEYSTONE_AT = 5;
const NESTS_COVER_CARRY_CAP = 10;
const CARD_REVIEW_VISIBLE_ROWS = 11;
const CARD_REVIEW_ROW_H = 38;
const BASE_COHESION = 36;
const BASE_WINGBEATS = 3;
const BASE_HAND_TARGET = 5;
const BASE_RESONANCE_CAP = 5;
const STARTING_SCRAP = 40;
// Market pricing is data-driven from alpha-market.json (next-level-implementation
// -spec "Market prices and services are data-driven").
const alphaMarketConfig = alphaMarketSet.markets[0];
const MARKET_CARD_PRICE = alphaMarketConfig.cardSlots.find((slot) => slot.rarity === 'common')?.price.base ?? 55;
const MARKET_PREEN_PRICE = alphaMarketConfig.services.find((service) => service.id === 'preen')?.basePrice ?? 100;
const MARKET_ROUTE_MARK_PRICE = alphaMarketConfig.routeMarkSlots[0]?.price.base ?? 110;
const CACHE_SCRAP_REWARD = 30;
const REWARD_SKIP_SCRAP = 12;
const COMBAT_FX_TEXTURE = 'combat-fx-atlas';
const COMBAT_FX_PARTICLE_TEXTURE = 'combat-fx-pixel';
const COMBAT_ATMOSPHERE_TEXTURE = 'combat-atmosphere-strip';
const SUIT_FX_ANIM: Record<string, string> = {
  plumes: 'fx-plumes',
  quills: 'fx-quills',
  basins: 'fx-basins',
  nests: 'fx-nests',
};
// Every playable card lives in one shared reward pool; weight post-combat offers
// by rarity so commons/uncommons are the staple and rares/legendaries stay scarce.
const REWARD_RARITY_WEIGHT: Record<string, number> = { common: 100, uncommon: 45, rare: 16, legendary: 5 };
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

function battlefieldVariantAsset(filename: string, key: string): RuntimeImageAsset {
  return {
    key,
    url: battlefieldVariantRuntimeArtUrls[`../assets/runtime/backdrops/variants/${filename}`]
      ?? `/assets/runtime/backdrops/variants/${filename}`
  };
}

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
  cache: battlefieldVariantAsset('rooftop-blocks-cache-billboard-v1.webp', 'route-event-cache-billboard'),
  market: battlefieldVariantAsset('canal-markets-supply-market-v1.webp', 'route-event-supply-market'),
  signal: battlefieldVariantAsset('signal-spires-signal-relay-v1.webp', 'route-event-signal-relay'),
  nest: battlefieldVariantAsset('high-roost-workshop-prep-v1.webp', 'route-event-workshop-prep')
};
const ROUTE_MAP_BACKDROP_ASSET = {
  key: 'route-map-backdrop-rooftop-blocks',
  url: battlefieldRuntimeArtUrls['../assets/runtime/backdrops/rooftop-blocks-route-map-v1.webp']
    ?? '/assets/runtime/backdrops/rooftop-blocks-route-map-v1.webp'
};

const cardRuntimeArtUrls = import.meta.glob('../assets/runtime/cards/thumb/*.webp', {
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
const routeNodeIconRuntimeArtUrls = import.meta.glob('../assets/runtime/map-icons/icons/*.webp', {
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

const cardArtAssets: Record<string, RuntimeImageAsset> = Object.fromEntries(
  alphaCardArtManifest.cards
    .filter((entry) => entry.status === 'approved')
    .map((entry) => [entry.cardId, {
      key: `card-${entry.cardId}`,
      url: bundledAssetUrl(entry.thumbnail, cardRuntimeArtUrls)
    }])
);
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
const waymarkArtAssets: Record<string, RuntimeImageAsset> = Object.fromEntries(
  alphaRouteMarkSet.routeMarks.map((mark) => [mark.id, {
    key: `waymark-${mark.id}`,
    url: waymarkRuntimeArtUrls[`../assets/runtime/waymarks/icons/${mark.id}.webp`]
      ?? `/assets/runtime/waymarks/icons/${mark.id}.webp`
  }])
);
const routeNodeIconAssets: Record<RouteNode['type'], RuntimeImageAsset> = Object.fromEntries(
  (['street', 'rival', 'boss', 'basin', 'nest', 'market', 'signal', 'cache'] as RouteNode['type'][]).map((type) => [type, {
    key: `route-node-${type}`,
    url: routeNodeIconRuntimeArtUrls[`../assets/runtime/map-icons/icons/${type}.webp`]
      ?? `/assets/runtime/map-icons/icons/${type}.webp`
  }])
) as Record<RouteNode['type'], RuntimeImageAsset>;

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
    this.load.image('title-bird', titleBirdUrl);
    this.load.image('title-squad', titleSquadUrl);
    this.load.spritesheet(COMBAT_FX_TEXTURE, combatFxAtlasUrl, { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet(COMBAT_ATMOSPHERE_TEXTURE, combatAtmosphereUrl, { frameWidth: 256, frameHeight: 96 });
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

    this.createAnimatedTitle();

    // Keep difficulty near the run action without adding a full-width dock, so
    // the splash art stays visible behind the compact controls.
    this.selectedDifficulty = Math.min(this.selectedDifficulty, getMaxUnlockedTier());
    this.add.rectangle(228, 642, 314, 102, 0x05070c, 0.68)
      .setStrokeStyle(MENU_BORDER_WIDTH, MENU_BORDER_COLOR, 0.64);
    this.add.text(122, 600, 'ASCENSION', {
      fontFamily: 'Arial',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#dce8f2',
      stroke: '#05070c',
      strokeThickness: 2,
    }).setResolution(2).setOrigin(0.5);
    const dec = this.add.rectangle(100, 632, 26, 28, 0x0d1420, 0.9)
      .setStrokeStyle(MENU_BORDER_WIDTH, MENU_BORDER_COLOR, 0.86).setInteractive({ useHandCursor: true });
    dec.on('pointerdown', () => this.stepDifficulty(-1));
    this.add.text(100, 631, '<', { fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold', color: '#eef7ff', stroke: '#05070c', strokeThickness: 1 }).setResolution(2).setOrigin(0.5);
    const inc = this.add.rectangle(356, 632, 26, 28, 0x0d1420, 0.9)
      .setStrokeStyle(MENU_BORDER_WIDTH, MENU_BORDER_COLOR, 0.86).setInteractive({ useHandCursor: true });
    inc.on('pointerdown', () => this.stepDifficulty(1));
    this.add.text(356, 631, '>', { fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold', color: '#eef7ff', stroke: '#05070c', strokeThickness: 1 }).setResolution(2).setOrigin(0.5);
    this.difficultyLabelText = this.add.text(228, 630, '', {
      fontFamily: 'Arial', fontSize: '18px', fontStyle: 'bold', color: '#ffd76a', stroke: '#05070c', strokeThickness: 2
    }).setResolution(2).setOrigin(0.5);
    this.difficultyDescText = this.add.text(228, 663, '', {
      fontFamily: 'Arial',
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
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffe1a3',
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
        fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: unlocked ? '#ffe1a3' : '#5a6675', align: 'center', stroke: '#05070c', strokeThickness: 1, wordWrap: { width: 184 }
      }).setResolution(2).setOrigin(0.5);
      const detail = unlocked
        ? `${leader.suit} - ${leader.bird}\n${leader.signatureName}`
        : `Locked\n${leaderUnlockHints[leader.id] ?? 'Locked'}`;
      const detailText = this.add.text(px, py + 15, detail, {
        fontFamily: 'Arial',
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
      fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#dce8f2'
    }).setResolution(2).setOrigin(0.5);

    const codex = this.add.rectangle(GAME_WIDTH - 240, 38, 136, 38, 0x0d1420, 0.9)
      .setStrokeStyle(MENU_BORDER_WIDTH, MENU_BORDER_COLOR, 0.9).setInteractive({ useHandCursor: true });
    codex.on('pointerover', () => codex.setFillStyle(0x1b2535, 0.96));
    codex.on('pointerout', () => codex.setFillStyle(0x0d1420, 0.92));
    codex.on('pointerdown', () => this.scene.start('CodexScene'));
    this.add.text(GAME_WIDTH - 240, 38, 'Codex', {
      fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#dce8f2'
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
      fontFamily: 'Arial', fontSize, fontStyle: 'bold', color: '#ffe1a3', stroke: '#111111', strokeThickness: 2
    }).setResolution(2).setOrigin(0.5);
    panel.on('pointerover', () => { panel.setFillStyle(0x1b2535, 0.96); label.setColor('#ffffff'); });
    panel.on('pointerout', () => { panel.setFillStyle(0x0d1420, 0.92); label.setColor('#ffe1a3'); });
    panel.on('pointerdown', onClick);
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
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'bold',
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

  private playTitleImpact(
    logo: Phaser.GameObjects.Container
  ) {
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
      fontFamily: 'Georgia, serif', fontSize: '40px', fontStyle: 'bold', color: '#ffe1a3', stroke: '#000000', strokeThickness: 5
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
      this.add.text(cx, 100, chip[0], { fontFamily: 'Arial', fontSize: '13px', color: '#8fa3b6' }).setOrigin(0.5);
      this.add.text(cx, 126, chip[1], { fontFamily: 'Arial', fontSize: '19px', fontStyle: 'bold', color: '#ffe1a3' }).setOrigin(0.5);
    });

    this.add.text(120, 184, 'Flock Leaders', { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#ffe1a3' });
    flockLeaders.forEach((leader, index) => {
      const y = 226 + index * 46;
      const unlocked = isLeaderUnlocked(account, leader.id);
      this.add.rectangle(330, y + 12, 460, 40, index % 2 === 0 ? 0x121c2b : 0x0e1623, 0.9).setStrokeStyle(1, 0x223247, 0.8);
      this.add.text(118, y, leader.name, { fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: unlocked ? '#ffe1a3' : '#5a6675' });
      const wins = account.winsByLeader[leader.id] ?? 0;
      this.add.text(540, y, unlocked ? `${wins} ${wins === 1 ? 'win' : 'wins'}` : 'Locked', {
        fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: unlocked ? '#8df4ff' : '#6f7d8c'
      }).setOrigin(1, 0);
    });

    const earned = account.achievements;
    this.add.text(640, 184, `Achievements  (${earned.length}/${achievements.length})`, { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#ffe1a3' });
    achievements.forEach((ach, index) => {
      const y = 226 + index * 46;
      const got = earned.includes(ach.id);
      this.add.rectangle(940, y + 14, 600, 42, index % 2 === 0 ? 0x121c2b : 0x0e1623, 0.9).setStrokeStyle(1, 0x223247, 0.8);
      this.add.text(648, y, `${got ? '★' : '○'} ${ach.name}`, { fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: got ? '#ffe07a' : '#6f7d8c' });
      this.add.text(648, y + 19, ach.desc, { fontFamily: 'Arial', fontSize: '12px', color: got ? '#cdd9e6' : '#5a6675' });
    });

    const back = this.add.rectangle(GAME_WIDTH / 2, 680, 240, 48, 0x122235, 0.98).setStrokeStyle(2, 0xd8a840, 1).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('MenuScene'));
    this.add.text(GAME_WIDTH / 2, 680, 'Back', { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#ffe1a3' }).setOrigin(0.5);
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MenuScene'));
  }
}

type CodexSection = 'cards' | 'items' | 'leaders' | 'enemies';
type CodexEnemySource = 'encounter' | 'reserve';

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
  private activeItemTab = 0;
  private discovered = new Set<string>();
  private detailId?: string;
  private detailScroll = 0;
  private detailMaxScroll = 0;
  private gridScroll = 0;
  private gridMaxScroll = 0;
  private codexData?: CodexDataModule;
  private codexDataLoad?: Promise<void>;
  private codexDataFailed = false;
  private textureBoundsCache = new Map<string, TextureVisibleBounds>();
  private static readonly GRID_TOP = 158;
  private static readonly GRID_BOTTOM = 690;
  private readonly tabs: Array<{ label: string; match: (c: Card) => boolean }> = [
    { label: 'Major', match: (c) => c.id.startsWith('major_') },
    { label: 'Aviary', match: (c) => c.id.startsWith('aviary_') },
    { label: 'Plumes', match: (c) => c.runtime.suit === 'plumes' },
    { label: 'Quills', match: (c) => c.runtime.suit === 'quills' },
    { label: 'Basins', match: (c) => c.runtime.suit === 'basins' },
    { label: 'Nests', match: (c) => c.runtime.suit === 'nests' },
  ];
  private readonly enemyTabs: Array<{ label: string; match: (e: CodexEnemyEntry) => boolean }> = [
    { label: 'All', match: () => true },
    { label: 'Rooftops', match: (e) => e.district === 'Rooftop Blocks' },
    { label: 'Canals', match: (e) => e.district === 'Canal Markets' },
    { label: 'Signals', match: (e) => e.district === 'Signal Spires' },
    { label: 'Roost', match: (e) => e.district === 'High Roost' },
  ];
  private readonly itemTabs: Array<{ label: string; match: (m: RuntimeRouteMark) => boolean }> = [
    { label: 'All', match: () => true },
    { label: 'Shelter', match: (m) => m.family === 'safety' },
    { label: 'Tempo', match: (m) => m.family === 'route' },
    { label: 'Routecraft', match: (m) => m.family === 'economy' },
    { label: 'Suit', match: (m) => m.family === 'suit' },
    { label: 'Molt', match: (m) => m.family === 'molt' },
    { label: 'Boss', match: (m) => m.family === 'bossPrep' },
  ];

  constructor() {
    super('CodexScene');
  }

  create() {
    this.cameras.main.fadeIn(180);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.32);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.82);
    this.root = this.add.container(0, 0);
    this.discovered = new Set(loadAccount().discoveredCards);
    void this.ensureCodexData();
    this.queueArt();
    this.renderAll();
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.detailId) { this.detailId = undefined; this.renderAll(); }
      else this.scene.start('MenuScene');
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.detailId) {
        if (this.detailMaxScroll <= 0) return;
        this.detailScroll = Math.max(0, Math.min(this.detailMaxScroll, this.detailScroll + (dy > 0 ? 64 : -64)));
        this.renderAll();
        return;
      }
      if (this.gridMaxScroll <= 0) return;
      this.gridScroll = Math.max(0, Math.min(this.gridMaxScroll, this.gridScroll + (dy > 0 ? 84 : -84)));
      this.renderAll();
    });
  }

  private allCards(): Card[] {
    return Object.values(cardLibrary).filter((c) => c.runtime.kind !== 'snag');
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

  private currentWaymarks(): RuntimeRouteMark[] {
    const rarityOrder: Record<string, number> = { common: 0, uncommon: 1, rare: 2, boss: 3 };
    return this.allWaymarks()
      .filter(this.itemTabs[this.activeItemTab].match)
      .sort((a, b) => (rarityOrder[a.rarity] ?? 9) - (rarityOrder[b.rarity] ?? 9) || a.name.localeCompare(b.name));
  }

  private ensureCodexData() {
    if (this.codexData) return Promise.resolve();
    this.codexDataFailed = false;
    this.codexDataLoad ??= codexDataPreload
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
    const top = CodexScene.GRID_TOP;
    return entries.filter((_entry, i) => {
      const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
      return cy - this.gridScroll >= top - cellH && cy - this.gridScroll <= CodexScene.GRID_BOTTOM + cellH;
    });
  }

  private currentDetailArtAsset(): RuntimeImageAsset | undefined {
    if (!this.detailId) return undefined;
    if (this.activeSection === 'items') return waymarkArtAssets[this.detailId];
    if (this.activeSection === 'leaders') return flockLeaderArtAssets[this.detailId];
    if (this.activeSection === 'enemies') {
      const enemy = this.currentCodexEnemies().find((candidate) => candidate.id === this.detailId);
      return enemy ? this.enemyArtAsset(enemy) : undefined;
    }
    return this.discovered.has(this.detailId) ? cardArtAssets[this.detailId] : undefined;
  }

  private queueArt() {
    const cards = this.allCards().filter(this.tabs[this.activeTab].match).sort((a, b) => a.id.localeCompare(b.id));
    const waymarks = this.currentWaymarks();
    const leaders = this.allLeaders();
    const enemies = this.currentCodexEnemies();
    const source = this.activeSection === 'items'
      ? this.visibleGridEntries(waymarks, 4, 176).map((mark) => waymarkArtAssets[mark.id])
      : this.activeSection === 'leaders'
        ? this.visibleGridEntries(leaders, 3, 238).map((leader) => flockLeaderArtAssets[leader.id])
        : this.activeSection === 'enemies'
          ? this.visibleGridEntries(enemies, 4, 228).map((enemy) => this.enemyArtAsset(enemy))
          : this.visibleGridEntries(cards, 5, 286)
          .filter((c) => this.discovered.has(c.id))
          .map((c) => cardArtAssets[c.id]);
    queueRuntimeImageAssets(this, [...source, this.currentDetailArtAsset()], 'Codex art failed to load', () => this.renderAll());
  }

  private renderAll() {
    hideKwTooltip();
    this.root.removeAll(true);
    this.queueArt();
    const all = this.allCards();
    const found = all.filter((c) => this.discovered.has(c.id)).length;
    const enemyAll = this.allCodexEnemies();
    const reserveEnemyCount = this.allReserveEnemies().length;
    const encounterEnemyCount = this.allEncounterEnemies().length;
    const enemies = this.currentCodexEnemies();
    const waymarkAll = this.allWaymarks();
    const waymarks = this.currentWaymarks();
    const leaders = this.allLeaders();
    const top = CodexScene.GRID_TOP;

    // 1) Scrollable grid. Drawn FIRST so the
    //    header/footer curtains below can hide anything scrolled out of view
    //    (WebGL doesn't support geometry masks, so we clip with opaque strips).
    const cardMode = this.activeSection === 'cards';
    const itemMode = this.activeSection === 'items';
    const leaderMode = this.activeSection === 'leaders';
    const cards = cardMode
      ? this.allCards().filter(this.tabs[this.activeTab].match).sort((a, b) => a.id.localeCompare(b.id))
      : [];
    const cols = cardMode ? 5 : leaderMode ? 3 : 4;
    const cellW = cardMode ? 202 : leaderMode ? 360 : 274;
    const cellH = cardMode ? 286 : itemMode ? 176 : leaderMode ? 238 : 228;
    const gridLeft = (GAME_WIDTH - cols * cellW) / 2;
    const rows = Math.ceil((cardMode ? cards.length : itemMode ? waymarks.length : leaderMode ? leaders.length : enemies.length) / cols);
    this.gridMaxScroll = Math.max(0, rows * cellH - (CodexScene.GRID_BOTTOM - top) + 12);
    this.gridScroll = Math.min(this.gridScroll, this.gridMaxScroll);

    const grid = this.add.container(0, -this.gridScroll);
    if (cardMode) {
      cards.forEach((card, i) => {
        const cx = gridLeft + (i % cols) * cellW + cellW / 2;
        const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
        // Cull rows fully outside the viewport (cheap + avoids drawing offscreen).
        if (cy - this.gridScroll < top - cellH || cy - this.gridScroll > CodexScene.GRID_BOTTOM + cellH) return;
        this.renderThumb(grid, card, cx, cy);
      });
    } else if (itemMode) {
      waymarks.forEach((mark, i) => {
        const cx = gridLeft + (i % cols) * cellW + cellW / 2;
        const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
        if (cy - this.gridScroll < top - cellH || cy - this.gridScroll > CodexScene.GRID_BOTTOM + cellH) return;
        this.renderWaymarkThumb(grid, mark, cx, cy);
      });
    } else if (leaderMode) {
      leaders.forEach((leader, i) => {
        const cx = gridLeft + (i % cols) * cellW + cellW / 2;
        const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
        if (cy - this.gridScroll < top - cellH || cy - this.gridScroll > CodexScene.GRID_BOTTOM + cellH) return;
        this.renderLeaderThumb(grid, leader, cx, cy);
      });
    } else {
      enemies.forEach((enemy, i) => {
        const cx = gridLeft + (i % cols) * cellW + cellW / 2;
        const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
        if (cy - this.gridScroll < top - cellH || cy - this.gridScroll > CodexScene.GRID_BOTTOM + cellH) return;
        this.renderEnemyThumb(grid, enemy, cx, cy);
      });
    }
    this.root.add(grid);

    // 2) Curtains hide grid overflow above/below the viewport.
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, top / 2, GAME_WIDTH, top, 0x070a11, 1));
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, (CodexScene.GRID_BOTTOM + GAME_HEIGHT) / 2, GAME_WIDTH, GAME_HEIGHT - CodexScene.GRID_BOTTOM, 0x070a11, 1));

    // 3) Header (title / counter / Back / tabs) on top of the curtain.
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, 78, GAME_WIDTH, 156, 0x08111e, 0.96));
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, 150, GAME_WIDTH - 80, 2, 0x1b2c3e, 0.82));
    this.root.add(this.add.rectangle(838, 42, 486, 54, 0x05080e, 0.64).setStrokeStyle(1, 0x22364d, 0.72));
    this.root.add(this.add.text(40, 24, 'Codex', { fontFamily: 'Georgia, serif', fontSize: '34px', fontStyle: 'bold', color: '#ffe1a3', stroke: '#000000', strokeThickness: 4 }));
    const subtitle = cardMode
      ? `${found} / ${all.length} cards discovered`
      : itemMode
        ? `${waymarkAll.length} Waymark items cataloged`
          : leaderMode
            ? `${flockLeaders.filter((leader) => isLeaderUnlocked(loadAccount(), leader.id)).length} / ${flockLeaders.length} Flock Leaders rallied`
            : this.codexDataPending()
            ? `${encounterEnemyCount} playable enemies cataloged (loading reserve concepts)`
            : `${enemyAll.length} enemies cataloged (${encounterEnemyCount} playable / ${reserveEnemyCount} reserve concepts)`;
    this.root.add(this.add.text(42, 66, subtitle, { fontFamily: 'Arial', fontSize: '15px', color: '#8fa3b6' }));
    const codexStatus = this.codexDataFailed
      ? 'Extended Codex notes unavailable'
      : this.codexDataPending()
        ? 'Loading extended Codex notes...'
        : '';
    if (codexStatus) {
      this.root.add(this.add.text(42, 84, codexStatus, {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: this.codexDataFailed ? '#ff9b6a' : '#8df4ff'
      }));
    }

    const back = this.add.rectangle(GAME_WIDTH - 86, 42, 140, 44, 0x122235, 0.96).setStrokeStyle(2, 0xd8a840, 1).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('MenuScene'));
    this.root.add(back);
    this.root.add(this.add.text(GAME_WIDTH - 86, 42, 'Back', { fontFamily: 'Arial', fontSize: '18px', fontStyle: 'bold', color: '#ffe1a3' }).setOrigin(0.5));

    const sectionMeta: Record<CodexSection, string> = {
      cards: `${found}/${all.length}`,
      items: `${waymarkAll.length}`,
      leaders: `${flockLeaders.filter((leader) => isLeaderUnlocked(loadAccount(), leader.id)).length}/${flockLeaders.length}`,
      enemies: `${enemyAll.length}`,
    };
    const sectionAccent: Record<CodexSection, number> = {
      cards: 0x7ab8d6,
      items: 0xc9a6ff,
      leaders: 0xe8c24a,
      enemies: 0xff9b6a,
    };
    ([
      ['cards', 'Cards'],
      ['items', 'Items'],
      ['leaders', 'Leaders'],
      ['enemies', 'Enemies'],
    ] as Array<[CodexSection, string]>).forEach(([section, label], i) => {
      const tx = 660 + i * 118;
      const active = section === this.activeSection;
      this.renderCodexTab(tx, 42, 106, 42, label, sectionMeta[section], active, sectionAccent[section], () => {
        this.activeSection = section;
        this.detailId = undefined;
        this.detailScroll = 0;
        this.gridScroll = 0;
        this.renderAll();
      }, 14);
    });

    if (cardMode) {
      this.tabs.forEach((tab, i) => {
        const tx = 72 + i * 132;
        const active = i === this.activeTab;
        const tabCards = this.allCards().filter(tab.match);
        const got = tabCards.filter((c) => this.discovered.has(c.id)).length;
        const sampleCard = tabCards[0];
        const accent = sampleCard ? this.cardAccent(sampleCard) : 0x7ab8d6;
        this.renderCodexTab(tx, 116, 124, 40, tab.label, `${got}/${tabCards.length}`, active, accent, () => {
          this.activeTab = i; this.detailId = undefined; this.gridScroll = 0; this.renderAll();
        }, 13);
      });
    } else if (itemMode) {
      this.itemTabs.forEach((tab, i) => {
        const tx = 72 + i * 128;
        const active = i === this.activeItemTab;
        const tabMarks = this.allWaymarks().filter(tab.match);
        const accent = tabMarks[0] ? this.waymarkAccent(tabMarks[0]) : 0xc9a6ff;
        this.renderCodexTab(tx, 116, 120, 40, tab.label, `${tabMarks.length}`, active, accent, () => {
          this.activeItemTab = i; this.detailId = undefined; this.gridScroll = 0; this.renderAll();
        }, 12);
      });
    } else if (!leaderMode) {
      this.enemyTabs.forEach((tab, i) => {
        const tx = 72 + i * 150;
        const active = i === this.activeEnemyTab;
        const tabEnemies = this.allCodexEnemies().filter(tab.match);
        const accent = tabEnemies[0] ? this.enemyAccent(tabEnemies[0]) : 0x7ab8d6;
        this.renderCodexTab(tx, 116, 140, 40, tab.label, `${tabEnemies.length}`, active, accent, () => {
          this.activeEnemyTab = i; this.detailId = undefined; this.gridScroll = 0; this.renderAll();
        }, 13);
      });
    }

    if (this.gridMaxScroll > 0) {
      this.root.add(this.add.text(GAME_WIDTH - 30, CodexScene.GRID_BOTTOM + 6, this.gridScroll < this.gridMaxScroll ? 'scroll for more v' : '^ scroll up', {
        fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#7f93a8'
      }).setOrigin(1, 0));
    }

    if (this.detailId) {
      if (this.activeSection === 'items') this.renderWaymarkDetail(this.detailId);
      else if (this.activeSection === 'leaders') this.renderLeaderDetail(this.detailId);
      else if (this.activeSection === 'enemies') this.renderEnemyDetail(this.detailId);
      else this.renderDetail(this.detailId);
    }
  }

  private hexColor(color: number) {
    return `#${color.toString(16).padStart(6, '0')}`;
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
      fontFamily: 'Arial',
      fontSize: '10px',
      fontStyle: 'bold',
      color: active ? '#ffe1a3' : '#aebed0',
      align: 'center',
      fixedWidth: w - 8,
    }).setResolution(2).setOrigin(0.5));
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
    this.root.add(this.add.text(x, y - 8, label, {
      fontFamily: 'Arial',
      fontSize: `${labelSize}px`,
      fontStyle: 'bold',
      color: active ? '#ffe1a3' : '#9fb1c4',
    }).setResolution(2).setOrigin(0.5));
    this.root.add(this.add.text(x, y + 10, meta, {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: active ? this.hexColor(accent) : '#708296',
    }).setResolution(2).setOrigin(0.5));
  }

  private cardAccent(card: Card) {
    if (isAviaryCard(card)) return 0xe8c24a;
    if (card.type === 'major') return 0xd8a840;
    if (card.type === 'molt') return 0xc56cff;
    return suitAccentColor(card);
  }

  private cardFamilyLabel(card: Card) {
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
      fontFamily: 'Arial',
      fontSize: '12px',
      fontStyle: 'bold',
      color: this.hexColor(accent),
      align: 'center',
      fixedWidth: aw - 34,
    }).setResolution(2).setOrigin(0.5));
    layer.add(this.add.text(cx, cy - 6, '?', {
      fontFamily: 'Georgia, serif',
      fontSize: '68px',
      fontStyle: 'bold',
      color: '#344558',
      stroke: '#05070c',
      strokeThickness: 2,
    }).setResolution(2).setOrigin(0.5));
    layer.add(this.add.text(cx, cy + 66, 'UNFOUND', {
      fontFamily: 'Arial',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#8fa3b6',
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
    if (found) bg.on('pointerdown', () => { this.detailId = card.id; this.detailScroll = 0; this.renderAll(); });
    layer.add(bg);

    const key = cardArtKey(card);
    if (found && key && this.textures.exists(key)) {
      layer.add(this.add.image(cx, cy, key).setDisplaySize(aw, ah).setAlpha(0.99));
      // Cost badge (gameplay info not shown in the illustration).
      layer.add(this.add.circle(cx - aw / 2 + 18, cy - ah / 2 + 18, 15, card.cost === 0 ? 0x24d0d6 : 0xe8b830, 1).setStrokeStyle(2, 0x05080e, 0.95));
      layer.add(this.add.text(cx - aw / 2 + 18, cy - ah / 2 + 18, `${card.cost}`, { fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: '#06101c' }).setOrigin(0.5));
    } else if (found) {
      layer.add(this.add.text(cx, cy, displayName(card), { fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: '#cdd9e6', align: 'center', wordWrap: { width: aw - 16 } }).setOrigin(0.5));
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
      case 'economy': return 'Routecraft';
      case 'suit': return 'Suit Engine';
      case 'molt': return 'Molt';
      case 'bossPrep': return 'Boss';
      default: return mark.family;
    }
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
    bg.on('pointerdown', () => { this.detailId = mark.id; this.detailScroll = 0; this.renderAll(); });
    layer.add(bg);
    layer.add(this.add.rectangle(cx, cy - h / 2 + 7, w - 16, 4, accent, 0.82));

    const artAsset = waymarkArtAssets[mark.id];
    layer.add(this.add.circle(cx - 92, cy - 34, 32, 0x05080e, 0.94).setStrokeStyle(2, accent, 0.9));
    if (artAsset && this.textures.exists(artAsset.key)) {
      layer.add(this.add.image(cx - 92, cy - 34, artAsset.key).setDisplaySize(58, 58));
    } else {
      layer.add(this.add.text(cx - 92, cy - 35, waymarkGlyph(mark), {
        fontFamily: 'Arial', fontSize: '22px', fontStyle: 'bold', color: '#e7eef7'
      }).setOrigin(0.5));
    }
    layer.add(this.add.text(cx - 48, cy - 58, mark.name, {
      fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: '#ffe1a3',
      wordWrap: { width: 168 }
    }).setOrigin(0, 0));
    layer.add(this.add.text(cx - 48, cy - 20, `${this.waymarkFamilyLabel(mark)} / ${mark.rarity}`, {
      fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#8df4ff',
      wordWrap: { width: 168 }
    }).setOrigin(0, 0));
    this.addCodexChip(layer, cx - 58, cy + 7, 98, mark.trigger, accent);
    this.addCodexChip(layer, cx + 52, cy + 7, 106, mark.effect, accent);
    layer.add(this.add.text(cx - 112, cy + 18, mark.description, {
      fontFamily: 'Arial', fontSize: '12px', color: '#cdd9e6',
      align: 'center', wordWrap: { width: w - 28 }
    }).setOrigin(0, 0));
  }

  private renderWaymarkDetail(id: string) {
    const mark = alphaRouteMarkLibrary.get(id);
    if (!mark) return;
    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.76).setInteractive();
    scrim.on('pointerdown', () => { this.detailId = undefined; this.renderAll(); });
    this.root.add(scrim);

    const px = GAME_WIDTH / 2;
    const py = GAME_HEIGHT / 2;
    const MW = 780;
    const MH = 480;
    const left = px - MW / 2;
    const top = py - MH / 2;
    const accent = this.waymarkAccent(mark);
    const accentText = `#${accent.toString(16).padStart(6, '0')}`;
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x0c1420, 0.995).setStrokeStyle(2, accent, 1));
    const artAsset = waymarkArtAssets[mark.id];
    this.root.add(this.add.rectangle(left + 92, top + 92, 108, 108, 0x05080e, 0.96).setStrokeStyle(3, accent, 0.95));
    if (artAsset && this.textures.exists(artAsset.key)) {
      this.root.add(this.add.image(left + 92, top + 92, artAsset.key).setDisplaySize(96, 96));
    } else {
      this.root.add(this.add.text(left + 92, top + 91, waymarkGlyph(mark), {
        fontFamily: 'Arial', fontSize: '36px', fontStyle: 'bold', color: '#e7eef7'
      }).setOrigin(0.5));
    }

    const tx = left + 168;
    const wrap = MW - 214;
    let yy = top + 48;
    this.root.add(this.add.text(tx, yy, mark.name, {
      fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffe1a3',
      wordWrap: { width: wrap }
    }));
    yy += 42;
    this.root.add(this.add.text(tx, yy, `${this.waymarkFamilyLabel(mark)} Waymark / ${mark.rarity} / ${mark.source}`, {
      fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#8fa3b6',
      wordWrap: { width: wrap }
    }));
    yy += 42;
    this.root.add(this.add.text(tx, yy, 'EFFECT', { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: accentText }));
    yy += 18;
    const effect = this.add.text(tx, yy, mark.description, {
      fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold', color: '#cfe0ef',
      lineSpacing: 4, wordWrap: { width: wrap }
    });
    this.root.add(effect);
    yy += effect.height + 24;
    this.root.add(this.add.text(tx, yy, 'TRIGGER', { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: accentText }));
    yy += 18;
    this.root.add(this.add.text(tx, yy, `${mark.trigger} -> ${mark.effect}`, {
      fontFamily: 'Arial', fontSize: '13px', color: '#9fb1c4',
      wordWrap: { width: wrap }
    }));
    yy += 42;
    this.root.add(this.add.text(tx, yy, 'FOUND OBJECT', { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: accentText }));
    yy += 18;
    const flavor = this.add.text(tx, yy, mark.flavorText ?? 'A real route artifact carried by the flock.', {
      fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'italic', color: '#d9c8ff',
      lineSpacing: 4, wordWrap: { width: wrap }
    });
    this.root.add(flavor);

    const close = this.add.rectangle(left + MW - 30, top + 30, 36, 36, 0x3d2a2d, 0.97)
      .setStrokeStyle(2, 0xff6b57, 1).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => { this.detailId = undefined; this.renderAll(); });
    this.root.add(close);
    this.root.add(this.add.text(left + MW - 30, top + 30, 'x', {
      fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold', color: '#ffd5cc'
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
    bg.on('pointerdown', () => { this.detailId = leader.id; this.detailScroll = 0; this.renderAll(); });
    layer.add(bg);
    layer.add(this.add.rectangle(cx, cy - h / 2 + 8, w - 18, 4, unlocked ? accent : 0x2a3a4d, unlocked ? 0.84 : 0.6));

    const art = flockLeaderArtAssets[leader.id];
    if (art && this.textures.exists(art.key)) {
      const fit = this.fittedTextureSize(art.key, 132, 160);
      layer.add(this.add.image(cx - 104, cy - 8, art.key).setDisplaySize(fit.w, fit.h).setAlpha(unlocked ? 0.99 : 0.38));
    } else {
      layer.add(this.add.rectangle(cx - 104, cy - 8, 116, 154, 0x141d2b, 0.9).setStrokeStyle(1, 0x2a3a4d, 0.8));
      layer.add(this.add.text(cx - 104, cy - 12, leader.bird, {
        fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#cdd9e6',
        align: 'center', wordWrap: { width: 98 }
      }).setOrigin(0.5));
    }

    layer.add(this.add.text(cx + 26, cy - 86, leader.name, {
      fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold', color: unlocked ? '#ffe1a3' : '#6f7d8c',
      wordWrap: { width: 176 }
    }).setOrigin(0.5, 0));
    layer.add(this.add.text(cx + 26, cy - 42, lore?.epithet ?? leader.signatureName, {
      fontFamily: 'Georgia, serif', fontSize: '13px', fontStyle: 'italic', color: unlocked ? '#d9c8ff' : '#657385',
      align: 'center', wordWrap: { width: 176 }
    }).setOrigin(0.5, 0));
    this.addCodexChip(layer, cx - 24, cy + 8, 86, leader.suit, accent, unlocked);
    this.addCodexChip(layer, cx + 72, cy + 8, 86, unlocked ? 'Rallied' : 'Locked', accent, unlocked);
    layer.add(this.add.text(cx + 26, cy + 20, lore?.codexSummary ?? leader.blurb, {
      fontFamily: 'Arial', fontSize: '12px', color: unlocked ? '#cdd9e6' : '#7f93a8',
      align: 'center', wordWrap: { width: 178 }
    }).setOrigin(0.5, 0));
    layer.add(this.add.text(cx + 26, cy + 76, unlocked ? `${wins} ${wins === 1 ? 'win' : 'wins'}` : 'Locked', {
      fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: unlocked ? '#ffe1a3' : '#6f7d8c',
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
    scrim.on('pointerdown', () => { this.detailId = undefined; this.renderAll(); });
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
    this.root.add(this.add.rectangle(left + 32, mTop + 28, 154, 28, 0x07101c, 0.96).setStrokeStyle(1, accent, 0.9));
    this.root.add(this.add.text(left + 44, mTop + 36, 'FIELD DOSSIER', {
      fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: accentText
    }));
    this.root.add(this.add.text(left + 198, mTop + 36, `ID ${leader.id.toUpperCase().replace(/_/g, '-')}`, {
      fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#6f8192'
    }));
    [0, 1, 2].forEach((i) => {
      this.root.add(this.add.rectangle(left + 24, mTop + 88 + i * 42, 8, 28, i === 0 ? accent : 0x2a3a4d, i === 0 ? 0.9 : 0.72));
    });
    this.root.add(this.add.rectangle(left + 54, mTop + 68, 302, 2, accent, 0.55));

    const art = flockLeaderArtAssets[leader.id];
    const artBoxX = left + 205;
    if (art && this.textures.exists(art.key)) {
      const fit = this.fittedTextureSize(art.key, 340, 500);
      this.root.add(this.add.image(artBoxX, py + 8, art.key).setDisplaySize(fit.w, fit.h).setAlpha(unlocked ? 0.99 : 0.42));
    } else {
      this.root.add(this.add.rectangle(artBoxX, py, 320, 480, 0x141d2b, 0.9).setStrokeStyle(1, 0x2a3a4d, 0.8));
      this.root.add(this.add.text(artBoxX, py, leader.bird, {
        fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#cdd9e6',
        align: 'center', wordWrap: { width: 260 }
      }).setOrigin(0.5));
    }
    if (!unlocked) {
      this.root.add(this.add.rectangle(artBoxX, py + 224, 260, 36, 0x05070c, 0.8).setStrokeStyle(1, 0x2a3a4d, 0.85));
      this.root.add(this.add.text(artBoxX, py + 224, leaderUnlockHints[leader.id] ?? 'Locked', {
        fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#ffe1a3',
        align: 'center', wordWrap: { width: 238 }
      }).setOrigin(0.5));
    }

    const tx = left + 410;
    const wrap = right - tx - 30;
    const viewTop = mTop + 20;
    const viewBottom = mBottom - 18;
    const viewH = viewBottom - viewTop;
    let yy = viewTop - this.detailScroll;
    const heading = (t: string, color: string) => {
      this.root.add(this.add.text(tx, yy, t, { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color }));
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
      fontFamily: 'Arial', fontSize: '29px', fontStyle: 'bold', color: '#ffe1a3',
      wordWrap: { width: wrap }
    }));
    yy += 38;
    this.root.add(this.add.text(tx, yy, lore.epithet, {
      fontFamily: 'Georgia, serif', fontSize: '17px', fontStyle: 'italic', color: '#d9c8ff',
      wordWrap: { width: wrap }
    }));
    yy += 29;
    this.root.add(this.add.text(tx, yy, `${leader.bird} / ${leader.suit} Leader / ${unlocked ? `${wins} career ${wins === 1 ? 'win' : 'wins'}` : 'Locked'}`, {
      fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#8fa3b6',
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
    para(lore.playstyleRead, { size: 13, bold: true, color: '#ffe1a3' });
    yy += 12;

    heading('SIGNATURE', '#c9a6ff');
    para(`${leader.signatureName}: ${leader.signatureText}`, { size: 13, color: '#d9c8ff' });
    yy += 12;

    heading('STARTING DECK', '#7f93a8');
    const starterNames = leader.startingDeckIds
      .map((cardId) => cardLibrary[cardId])
      .filter((card): card is Card => Boolean(card))
      .map((card) => displayName(card));
    para(starterNames.join(' / '), { size: 12, color: '#b9c7d6' });
    yy += 12;

    heading(unlocked ? 'FIELD QUOTE' : 'LOCKED NOTE', unlocked ? '#8fd6a0' : '#ff9b6a');
    para(unlocked ? `"${lore.quote}"` : lore.unlockFlavor, { size: 14, italic: true, color: unlocked ? '#bfe9cc' : '#ffd5cc' });

    const contentBottom = yy + this.detailScroll;
    const SCROLL_PAD = 16;
    this.detailMaxScroll = Math.max(0, (contentBottom - viewTop) - viewH + SCROLL_PAD);

    const closeDetail = () => { this.detailId = undefined; this.renderAll(); };
    this.root.add(this.add.rectangle(0, 0, GAME_WIDTH, mTop, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(0, mBottom, GAME_WIDTH, GAME_HEIGHT - mBottom, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(left + 1, mTop + 1, MW - 2, viewTop - mTop - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    this.root.add(this.add.rectangle(left + 1, viewBottom, MW - 2, mBottom - viewBottom - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x000000, 0).setStrokeStyle(2, accent, 1));
    this.root.add(this.add.rectangle(tx - 18, (viewTop + viewBottom) / 2, 2, viewH - 8, accent, 0.5));

    if (this.detailMaxScroll > 0) {
      this.root.add(this.add.text(right - 22, mBottom - 10, this.detailScroll < this.detailMaxScroll ? 'v scroll' : '^ top', {
        fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#8fa3b6'
      }).setOrigin(1, 1));
    }

    const close = this.add.rectangle(right - 26, mTop + 26, 36, 36, 0x3d2a2d, 0.97)
      .setStrokeStyle(2, 0xff6b57, 1)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', closeDetail);
    this.root.add(close);
    this.root.add(this.add.text(right - 26, mTop + 26, 'X', {
      fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold', color: '#ffd5cc'
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
    bg.on('pointerdown', () => { this.detailId = enemy.id; this.detailScroll = 0; this.renderAll(); });
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
        fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#cdd9e6',
        align: 'center', wordWrap: { width: artW - 14 }
      }).setOrigin(0.5));
    }

    layer.add(this.add.text(textX, cy - 82, enemy.name, {
      fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: '#ffe1a3',
      align: 'center', wordWrap: { width: textW }
    }).setOrigin(0.5, 0));
    layer.add(this.add.text(textX, cy - 30, enemy.role, {
      fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#8df4ff',
      align: 'center', wordWrap: { width: textW }
    }).setOrigin(0.5, 0));
    this.addCodexChip(layer, textX, cy - 1, 108, enemy.source === 'encounter' ? enemy.typeHint : 'Concept', accent);
    layer.add(this.add.text(textX, cy + 8, enemy.district, {
      fontFamily: 'Arial', fontSize: '11px', color: '#8fa3b6',
      align: 'center', wordWrap: { width: textW }
    }).setOrigin(0.5, 0));
    layer.add(this.add.text(cx, cy + 76, enemy.varietyContribution, {
      fontFamily: 'Arial', fontSize: '11px', color: '#b9c7d6',
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
    scrim.on('pointerdown', () => { this.detailId = undefined; this.renderAll(); });
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
    const key = cardArtKey(card);
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
    const heading = (t: string, color: string) => { this.root.add(this.add.text(tx, yy, t, { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color })); yy += 17; };
    const para = (t: string, opts: { color?: string; size?: number; italic?: boolean }) => {
      const o = this.add.text(tx, yy, t, { fontFamily: opts.italic ? 'Georgia, serif' : 'Arial', fontSize: `${opts.size ?? 13}px`, fontStyle: opts.italic ? 'italic' : 'normal', color: opts.color ?? '#cfe0ef', lineSpacing: 3, wordWrap: { width: wrap } });
      this.root.add(o); yy += o.height;
    };

    // Title block.
    this.root.add(this.add.text(tx, yy, displayName(card), { fontFamily: 'Arial', fontSize: '27px', fontStyle: 'bold', color: '#ffe1a3', wordWrap: { width: wrap } })); yy += 38;
    this.root.add(this.add.text(tx, yy, `${cardLabel(card)}  ·  Cost ${card.cost}${flav?.bird ? `  ·  ${flav.bird}` : ''}`, { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#8fa3b6', wordWrap: { width: wrap } })); yy += 26;

    // Effect — base + preened (keywords highlighted, hoverable).
    heading('EFFECT', '#7f93a8');
    yy += renderRichText(this, this.root, tx, yy, card.text, { wrap, fontSize: 15, tooltips: true }) + 6;
    if (card.upgradedText && card.upgradedText !== card.text) {
      this.root.add(this.add.text(tx, yy, 'PREENED  +', { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#7fe39a' })); yy += 16;
      yy += renderRichText(this, this.root, tx, yy, card.upgradedText, { wrap, fontSize: 14, baseColor: '#bfe9cc', tooltips: true }) + 12;
    } else { yy += 6; }

    // Molt ability — base + preened.
    if (card.moltText) {
      heading('❂ MOLT ABILITY', '#c8923a');
      yy += renderRichText(this, this.root, tx, yy, card.moltText, { wrap, fontSize: 14, baseColor: '#ffc78f', bold: true, tooltips: true }) + 6;
      if (card.moltTextUpgraded && card.moltTextUpgraded !== card.moltText) {
        this.root.add(this.add.text(tx, yy, 'PREENED  +', { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#7fe39a' })); yy += 16;
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
    this.root.add(this.add.text(tx, yy, statStr, { fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: '#8df4ff', wordWrap: { width: wrap } })); yy += 30;

    if (!this.codexData && this.codexDataPending()) {
      heading('CODEX NOTES', '#c9a6ff');
      para(isAviary ? 'Loading Aviary notes and bird facts...' : 'Loading tarot notes and bird facts...', { color: '#d9c8ff', italic: true, size: 13 });
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
      this.root.add(this.add.text(tx, yy, isAviary ? 'SIGNAL' : 'UPRIGHT', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#9d86c8' })); yy += 15;
      para(meaning.upright, { color: '#cfd9ea', size: 13 }); yy += 8;
      this.root.add(this.add.text(tx, yy, isAviary ? 'SHADOW' : 'REVERSED', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#9d86c8' })); yy += 15;
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

    // Clip the scroll viewport (WebGL has no geometry masks, so we paint over the
    // overflow). Two layers: opaque "outside" covers hide anything that bled past
    // the panel edges (above mTop / below mBottom), and panel-bg "inside" curtains
    // restore the panel face over the header/footer scroll gaps. All interactive so
    // they also swallow hovers on keyword tokens scrolled out of view; the outside
    // covers double as click-to-close, matching the scrim.
    const closeDetail = () => { this.detailId = undefined; this.renderAll(); };
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
      fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: accentText,
      align: 'center', fixedWidth: dossierW - 18,
    }).setResolution(2).setOrigin(0.5));
    // Thin accent rule between art and text column (clipped to the viewport band).
    this.root.add(this.add.rectangle(tx - 14, (viewTop + viewBottom) / 2, 2, viewH - 8, Phaser.Display.Color.HexStringToColor(accent).color, 0.5));

    if (this.detailMaxScroll > 0) {
      this.root.add(this.add.text(right - 22, mBottom - 10, this.detailScroll < this.detailMaxScroll ? '▾ scroll' : '▴ top', { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#8fa3b6' }).setOrigin(1, 1));
    }

    const close = this.add.rectangle(right - 26, mTop + 26, 36, 36, 0x3d2a2d, 0.97).setStrokeStyle(2, 0xff6b57, 1).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => { this.detailId = undefined; this.renderAll(); });
    this.root.add(close);
    this.root.add(this.add.text(right - 26, mTop + 26, '✕', { fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold', color: '#ffd5cc' }).setOrigin(0.5));
  }

  private renderEnemyDetail(id: string) {
    const enemy = this.allCodexEnemies().find((entry) => entry.id === id);
    if (!enemy) return;
    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.76).setInteractive();
    scrim.on('pointerdown', () => { this.detailId = undefined; this.renderAll(); });
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
    this.root.add(this.add.rectangle(left + 32, mTop + 28, 158, 28, 0x07101c, 0.96).setStrokeStyle(1, accent, 0.9));
    this.root.add(this.add.text(left + 44, mTop + 36, 'ENEMY DOSSIER', {
      fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: accentText
    }).setResolution(2));

    const art = this.enemyArtAsset(enemy);
    const artBoxX = left + 220;
    this.root.add(this.add.rectangle(artBoxX, py + 8, 372, 512, 0x05080e, 0.58).setStrokeStyle(1, accent, 0.52));
    if (art && this.textures.exists(art.key)) {
      const fit = this.fittedTextureSize(art.key, 360, 500);
      const shadow = this.enemyShadowMetrics(art.key, artBoxX, py + 8, fit.w, fit.h, 360, 500);
      this.root.add(this.add.ellipse(shadow.x, shadow.y, shadow.w, shadow.h, 0x020409, 0.34));
      this.root.add(this.add.image(artBoxX, py + 8, art.key).setDisplaySize(fit.w, fit.h).setAlpha(0.99));
    } else {
      this.root.add(this.add.rectangle(artBoxX, py, 340, 480, 0x141d2b, 0.9).setStrokeStyle(1, 0x2a3a4d, 0.8));
      this.root.add(this.add.text(artBoxX, py, enemy.typeHint, {
        fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#cdd9e6',
        align: 'center', wordWrap: { width: 280 }
      }).setOrigin(0.5));
    }

    const tx = left + 430;
    const wrap = right - tx - 28;
    const viewTop = mTop + 20;
    const viewBottom = mBottom - 18;
    const viewH = viewBottom - viewTop;
    let yy = viewTop - this.detailScroll;
    const heading = (t: string, color: string) => {
      this.root.add(this.add.text(tx, yy, t, { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color }));
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
      fontFamily: 'Arial', fontSize: '29px', fontStyle: 'bold', color: '#ffe1a3',
      wordWrap: { width: wrap }
    }));
    yy += 40;
    this.root.add(this.add.text(tx, yy, `${enemy.source === 'encounter' ? 'Playable encounter' : enemy.species} / ${enemy.district} / ${enemy.role}`, {
      fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#8fa3b6',
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
    para(enemy.artPose, { size: 12, italic: true, color: '#b9c7d6' });

    const contentBottom = yy + this.detailScroll;
    const SCROLL_PAD = 16;
    this.detailMaxScroll = Math.max(0, (contentBottom - viewTop) - viewH + SCROLL_PAD);

    const closeDetail = () => { this.detailId = undefined; this.renderAll(); };
    this.root.add(this.add.rectangle(0, 0, GAME_WIDTH, mTop, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(0, mBottom, GAME_WIDTH, GAME_HEIGHT - mBottom, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(left + 1, mTop + 1, MW - 2, viewTop - mTop - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    this.root.add(this.add.rectangle(left + 1, viewBottom, MW - 2, mBottom - viewBottom - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x000000, 0).setStrokeStyle(2, accent, 1));
    this.root.add(this.add.rectangle(tx - 18, (viewTop + viewBottom) / 2, 2, viewH - 8, accent, 0.5));

    if (this.detailMaxScroll > 0) {
      this.root.add(this.add.text(right - 22, mBottom - 10, this.detailScroll < this.detailMaxScroll ? 'v scroll' : '^ top', {
        fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#8fa3b6'
      }).setOrigin(1, 1));
    }

    const close = this.add.rectangle(right - 26, mTop + 26, 36, 36, 0x3d2a2d, 0.97)
      .setStrokeStyle(2, 0xff6b57, 1)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', closeDetail);
    this.root.add(close);
    this.root.add(this.add.text(right - 26, mTop + 26, 'X', {
      fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold', color: '#ffd5cc'
    }).setOrigin(0.5));
  }
}

class RouteScene extends Phaser.Scene {
  private runState!: RunState;
  private selectableNodeIds = new Set<string>();
  private selectedNodeId: string | undefined;
  private nodeChoiceOpen = false;
  private nodeChoiceNodeId: string | undefined;
  private cardPickerMode: 'preen' | 'release' | undefined;
  private deckOverlayOpen = false;
  private flockOverlayOpen = false;
  private marketOpen = false;
  private confirmExitOpen = false;
  private marketNodeId: string | undefined;
  private marketMessage = '';
  private marketBoughtCard = false;
  private marketBoughtRouteMark = false;
  private marketBoughtPreen = false;
  private inspectedCardId: string | undefined;
  private hoverCardDetail?: Phaser.GameObjects.Container;
  private cardReviewScroll = 0;
  private routeNodeIconArtRequested = false;

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
    this.cardPickerMode = undefined;
    this.deckOverlayOpen = false;
    this.flockOverlayOpen = false;
    this.marketOpen = false;
    this.marketNodeId = undefined;
    this.marketMessage = '';
    this.marketBoughtCard = false;
    this.marketBoughtRouteMark = false;
    this.marketBoughtPreen = false;
    this.inspectedCardId = undefined;
    this.hoverCardDetail = undefined;
    this.cardReviewScroll = 0;
    this.routeNodeIconArtRequested = false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#08101d');
    this.cameras.main.fadeIn(200);
    this.queueRouteNodeIconArtLoad();
    this.renderAll();

    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.deckOverlayOpen || this.flockOverlayOpen) return;
      // Commit the selected node if it is reachable, else the first available.
      const target = (this.selectedNodeId && this.selectableNodeIds.has(this.selectedNodeId))
        ? this.selectedNodeId
        : this.getSelectableNodes()[0]?.id;
      if (target) this.commitRouteNode(target);
    });
    this.input.keyboard?.on('keydown-ESC', () => {
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
      this.confirmExitOpen = true; // leaving a run is destructive — confirm first
      this.renderAll();
    });
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      if (!this.deckOverlayOpen || this.marketOpen) return;
      this.scrollDeck(deltaY > 0 ? 1 : -1);
    });
  }

  private renderAll() {
    this.children.removeAll(true);
    this.hoverCardDetail = undefined;
    this.renderBackdrop();
    this.renderRouteMap();
    if (this.deckOverlayOpen) this.renderMapDeckOverlay();
    if (this.flockOverlayOpen) this.renderRouteFlockOverlay();
    if (this.marketOpen) this.renderMarketOverlay();
    if (this.nodeChoiceOpen) this.renderNodeChoiceOverlay();
    if (this.cardPickerMode) this.renderCardPickerOverlay();
    if (this.confirmExitOpen) this.renderConfirmExitOverlay();
    this.updateTextState();
    persistActiveRun(this.runState); // checkpoint: resume lands back on the route map
  }

  private queueOptionalCardArtLoad() {
    const ids = new Set(this.runState.deck.map((card) => card.id));
    const offer = this.marketCardOffer();
    if (offer) ids.add(offer.id);
    queueRuntimeImageAssets(
      this,
      [...ids].map((id) => cardArtAssets[id]),
      'Optional card art failed to load on route map',
      () => this.renderAll()
    );
  }

  private queueRouteNodeIconArtLoad() {
    if (this.routeNodeIconArtRequested) return;
    this.routeNodeIconArtRequested = true;
    queueRuntimeImageAssets(
      this,
      Object.values(routeNodeIconAssets),
      'Route node icon failed to load',
      () => this.renderAll()
    );
  }

  private routeEventBackdropAsset(node?: RouteNode) {
    return node ? ROUTE_EVENT_BACKDROP_ASSETS[node.type] : undefined;
  }

  private queueRouteEventBackdropArtLoad(node?: RouteNode) {
    queueRuntimeImageAssets(
      this,
      [this.routeEventBackdropAsset(node)],
      'Route event backdrop failed to load',
      () => this.renderAll()
    );
  }

  private renderRouteEventBackdrop(node?: RouteNode, opacity = 0.74) {
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
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 66, GAME_WIDTH, 132, 0x020409, hasBackdrop ? 0.46 : 0.18);
    this.add.rectangle(GAME_WIDTH / 2, 24, GAME_WIDTH - 100, 2, accent, hasBackdrop ? 0.42 : 0.24);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 28, GAME_WIDTH - 100, 2, accent, hasBackdrop ? 0.36 : 0.22);
  }

  private renderConfirmExitOverlay() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.86)
      .setInteractive({ useHandCursor: false });
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 640, 286, 0x0d1420, 0.98)
      .setStrokeStyle(3, 0xff7a6e, 0.92);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 78, 'Abandon this run?', {
      fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffe1a3', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24, 'Your progress on this run will be lost.', {
      fontFamily: 'Arial', fontSize: '16px', color: '#b9c7d6', align: 'center', wordWrap: { width: 540 }
    }).setOrigin(0.5);

    const keep = this.add.rectangle(GAME_WIDTH / 2 - 140, GAME_HEIGHT / 2 + 56, 230, 54, 0x122235, 0.98)
      .setStrokeStyle(2, 0x7ab8d6, 0.95).setInteractive({ useHandCursor: true });
    keep.on('pointerdown', () => { this.confirmExitOpen = false; this.renderAll(); });
    this.add.text(GAME_WIDTH / 2 - 140, GAME_HEIGHT / 2 + 56, 'Keep Playing', {
      fontFamily: 'Arial', fontSize: '18px', fontStyle: 'bold', color: '#dbe6f0'
    }).setOrigin(0.5);

    const abandon = this.add.rectangle(GAME_WIDTH / 2 + 140, GAME_HEIGHT / 2 + 56, 230, 54, 0x2a1014, 0.98)
      .setStrokeStyle(2, 0xff7a6e, 0.95).setInteractive({ useHandCursor: true });
    abandon.on('pointerdown', () => { clearActiveRun(); this.scene.start('MenuScene'); });
    this.add.text(GAME_WIDTH / 2 + 140, GAME_HEIGHT / 2 + 56, 'Abandon Run', {
      fontFamily: 'Arial', fontSize: '18px', fontStyle: 'bold', color: '#ffd0c9'
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 108, 'Esc to keep playing', {
      fontFamily: 'Arial', fontSize: '13px', color: '#6f8296'
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

    this.add.text(80, 42, currentMap().name, {
      fontFamily: 'Arial',
      fontSize: '34px',
      fontStyle: 'bold',
      color: '#ffe1a3',
      stroke: '#000000',
      strokeThickness: 4
    });
    this.add.text(82, 84, this.routeSubtitle(), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#b9c7d6',
      wordWrap: { width: 660 }
    });

    this.renderRouteStatusRail();

    renderFieldButton(this, (obj) => {}, 822, 56, 116, 38, 'Flock', true, () => this.openFlockOverlay(), UI_FIELD.cyan);
    renderFieldButton(this, (obj) => {}, 960, 56, 116, 38, 'Deck', true, () => this.openDeckOverlay(), UI_FIELD.gold);
    renderFieldButton(this, (obj) => {}, 1098, 56, 116, 38, 'Back', true, () => { this.confirmExitOpen = true; this.renderAll(); }, UI_FIELD.cyan);
  }

  private routeLayout() {
    return {
      top: { y: 124 },
      map: { x: 52, y: 150, w: 836, h: 520, cx: 470, cy: 410 },
      graph: { left: 102, right: 838, top: 204, bottom: 522 },
      inspector: { x: 904, y: 150, w: 300, h: 500, cx: 1054, cy: 400 },
      footer: { x: 76, y: 604, w: 800, h: 56, cx: 476, cy: 632 }
    };
  }

  private routeStatusSummary() {
    return {
      cohesion: `${this.runState.currentHp}/${this.runMaxHp()}`,
      scrap: this.runState.scrap,
      deckSize: this.runState.deck.length,
      waymarks: this.runState.routeMarks.length,
      supplies: `${this.runState.supplies.length}/2`
    };
  }

  private renderRouteStatusRail() {
    const status = this.routeStatusSummary();
    const y = this.routeLayout().top.y;
    const chips: Array<{ label: string; value: string | number; width: number; color: number; text: string }> = [
      { label: 'Cohesion', value: status.cohesion, width: 140, color: 0x8fd6a0, text: '#dff5e7' },
      { label: 'Scrap', value: status.scrap, width: 96, color: 0x8df4ff, text: '#dffbff' }
    ];
    let x = 80;
    chips.forEach((chip) => {
      const cx = x + chip.width / 2;
      this.add.rectangle(cx, y, chip.width, 28, 0x07101a, 0.78)
        .setStrokeStyle(1, chip.color, 0.56);
      this.add.rectangle(cx, y - 13, chip.width - 14, 2, chip.color, 0.58);
      this.add.text(x + 10, y - 8, chip.label, {
        fontFamily: 'Arial',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#7f93a8'
      });
      this.add.text(x + chip.width - 10, y - 9, `${chip.value}`, {
        fontFamily: 'Arial',
        fontSize: '15px',
        fontStyle: 'bold',
        color: chip.text
      }).setOrigin(1, 0);
      x += chip.width + 10;
    });
    const kitW = 342;
    const kitCx = x + kitW / 2;
    this.add.rectangle(kitCx, y, kitW, 28, 0x07101a, 0.72)
      .setStrokeStyle(1, 0xd8a840, 0.5);
    this.add.rectangle(kitCx, y - 13, kitW - 14, 2, 0xd8a840, 0.5);
    this.add.text(kitCx, y - 9, `Deck ${status.deckSize}   /   Waymarks ${status.waymarks}   /   Supplies ${status.supplies}`, {
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffe1a3'
    }).setOrigin(0.5, 0);
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
      lines.lineStyle(
        lit ? 3 : primaryPreview ? 3 : available ? 2.5 : secondaryPreview ? 2 : 2,
        lit ? 0x6fd69a : primaryPreview ? 0xffe1a3 : available ? 0x7ab8d6 : secondaryPreview ? 0x7ab8d6 : 0x263b52,
        lit ? 0.78 : primaryPreview ? 0.78 : available ? 0.62 : secondaryPreview ? 0.42 : 0.28
      );
      lines.lineBetween(from.x + 32, from.y, to.x - 32, to.y);
      if (available || primaryPreview) {
        const mx = from.x * 0.35 + to.x * 0.65;
        const my = from.y * 0.35 + to.y * 0.65;
        lines.fillStyle(primaryPreview ? 0xffe1a3 : 0x7ab8d6, primaryPreview ? 0.9 : 0.72);
        lines.fillCircle(mx, my, primaryPreview ? 3.5 : 3);
      }
    });

    currentMap().nodes.forEach((node) => this.renderRouteNode(node, this.selectableNodeIds.has(node.id)));

    this.renderSelectedNodePanel();
    this.renderRouteLegend();
    this.renderRouteLog();

    this.add.text(96, 692, 'Click a crossing to inspect it   /   Enter: take selected   /   Esc: back', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#91a6b8'
    });
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

  // An icon key so every crossing type is identifiable without hovering.
  private renderRouteLegend() {
    const footer = this.routeLayout().footer;
    const types: RouteNode['type'][] = ['street', 'rival', 'boss', 'basin', 'nest', 'market', 'signal', 'cache'];
    const typeY = footer.y + 21;
    const riskY = footer.y + 47;
    const left = footer.x + 18;
    this.add.rectangle(footer.cx + 5, footer.cy + 5, footer.w, footer.h, 0x020409, 0.3);
    this.add.rectangle(footer.cx, footer.cy, footer.w, footer.h, 0x07101a, 0.78).setStrokeStyle(1, 0xd8a840, 0.28);
    this.add.rectangle(footer.cx, footer.y + 7, footer.w - 26, 2, 0xd8a840, 0.38);
    this.add.text(left, typeY - 20, 'LEGEND', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#7f93a8' });

    let cx = left;
    for (const t of types) {
      this.add.circle(cx + 9, typeY, 10, 0x111a27, 0.98).setStrokeStyle(1.5, 0x49606d, 0.75);
      this.renderRouteNodeTypeIcon(t, cx + 9, typeY, 20);
      const label = routeNodeTypeLabel(t).replace(' Encounter', '').replace(' Workshop', '').replace('Rooftop ', '');
      this.add.text(cx + 23, typeY, label, { fontFamily: 'Arial', fontSize: '12px', color: '#cdd9e6' }).setOrigin(0, 0.5);
      cx += 23 + label.length * 6.8 + 16;
    }

    this.add.text(left, riskY, 'COMBAT RISK', { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#7f93a8' }).setOrigin(0, 0.5);
    const risks: Array<[RouteNode['risk'], string]> = [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];
    let rx = left + 90;
    for (const [r, lbl] of risks) {
      this.add.circle(rx + 6, riskY, 6, routeNodeRiskColor(r), 1).setStrokeStyle(1.5, 0x0a121c, 0.8);
      this.add.text(rx + 16, riskY, lbl, { fontFamily: 'Arial', fontSize: '13px', color: routeNodeRiskHex(r) }).setOrigin(0, 0.5);
      rx += 16 + lbl.length * 7.5 + 22;
    }
    this.add.text(rx + 6, riskY, '(combat pip)', { fontFamily: 'Arial', fontSize: '11px', color: '#6a7d90' }).setOrigin(0, 0.5);
  }

  // Two-step flow: clicking a node selects it (shows this panel); the confirm
  // button commits (next-level-implementation-spec Phase 2 Selected Node Panel).
  private renderSelectedNodePanel() {
    const panel = this.routeLayout().inspector;
    const px = panel.cx;
    const py = panel.cy;
    const pw = panel.w;
    const ph = panel.h;
    const top = panel.y;
    const left = panel.x + 20;
    const frame = renderFieldPanel(this, (obj) => {}, px, py, pw, ph, {
      eyebrow: 'Route Board',
      accent: UI_FIELD.cyan,
      fill: 0x07101a
    });

    const node = this.selectedNodeId
      ? currentMap().nodes.find((candidate) => candidate.id === this.selectedNodeId)
      : undefined;
    if (!node) {
      this.add.text(px, top + 88, 'Click a crossing glyph to see\nits risk, reward, and lesson.', {
        fontFamily: 'Arial', fontSize: '15px', color: '#91a6b8', align: 'center'
      }).setOrigin(0.5);
      this.renderInspectorBossPrep(left, top + 170, pw - 40);
      return;
    }

    const detail = this.nodeDetail(node);
    let yy = top + 22;
    yy += 26;
    this.add.circle(panel.x + pw - 50, frame.top + 56, 30, 0x111a27, 0.92).setStrokeStyle(1.5, 0x49606d, 0.74);
    this.renderRouteNodeTypeIcon(node.type, panel.x + pw - 50, frame.top + 56, 50);
    const title = this.add.text(left, yy, detail.title, {
      fontFamily: 'Arial',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffe1a3',
      lineSpacing: 1,
      wordWrap: { width: pw - 112 },
      maxLines: 2
    });
    yy += title.height + 10;
    this.add.text(left, yy, `${detail.type}  /  ${node.risk.toUpperCase()} RISK`, { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: routeNodeRiskHex(node.risk) });
    yy += 30;
    this.add.text(left, yy, detail.lesson, { fontFamily: 'Arial', fontSize: '14px', color: '#cdd9e6', lineSpacing: 2, wordWrap: { width: pw - 40 } });
    yy += Math.max(60, Math.min(82, 24 + Math.ceil(detail.lesson.length / 44) * 18));
    if (detail.rewards) {
      this.add.text(left, yy, 'REWARD BIAS', { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#7f93a8' });
      yy += 18;
      this.add.text(left, yy, detail.rewards, { fontFamily: 'Arial', fontSize: '13px', color: '#8df4ff', wordWrap: { width: pw - 40 } });
      yy += 42;
    }
    const badgeHeight = this.renderInspectorRewardBadges(node, left, yy, pw - 40);
    yy += badgeHeight + (badgeHeight > 0 ? 20 : 0);
    this.renderInspectorBossPrep(left, Math.min(Math.max(yy, top + 276), top + ph - 200), pw - 40);

    if (this.selectableNodeIds.has(node.id)) {
      renderFieldButton(this, (obj) => {}, px, top + ph - 40, pw - 44, 42, 'Take this route', true, () => this.commitRouteNode(node.id), UI_FIELD.green);
    } else {
      this.add.text(px, top + ph - 40, 'Not reachable from here.', { fontFamily: 'Arial', fontSize: '13px', color: '#7f93a8' }).setOrigin(0.5);
    }
  }

  private renderInspectorRewardBadges(node: RouteNode, left: number, top: number, width: number) {
    const badges = this.routeRewardBadges(node).slice(0, 5);
    if (badges.length === 0) return 0;
    this.add.text(left, top, 'LIKELY FINDS', {
      fontFamily: 'Arial',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#7f93a8'
    });
    const gap = Math.min(48, width / Math.max(1, badges.length));
    const startX = left + 17;
    const badgeY = top + 30;
    badges.forEach((badge, index) => {
      const bx = startX + index * gap;
      this.add.circle(bx, badgeY, 15, 0x07101c, 0.98)
        .setStrokeStyle(1.5, badge.color, 0.94);
      this.add.text(bx, badgeY - 1, badge.icon, {
        fontFamily: 'Arial',
        fontSize: '12px',
        fontStyle: 'bold',
        color: badge.text,
        stroke: '#020409',
        strokeThickness: 2
      }).setOrigin(0.5);
    });
    return 58;
  }

  private renderInspectorBossPrep(left: number, top: number, width: number) {
    const prep = this.bossPrepReadiness();
    const cx = left + width / 2;
    this.add.rectangle(cx, top + 68, width, 136, 0x120f0a, 0.74).setStrokeStyle(1, 0xffb86b, 0.5);
    this.add.rectangle(cx, top + 4, width - 22, 2, 0xffb86b, 0.48);
    this.add.text(left + 12, top + 12, 'BOSS PREP', {
      fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#ffb86b'
    });
    this.add.text(left + 12, top + 31, prep.bossName, {
      fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: '#ffe1a3', wordWrap: { width: width - 24 }
    });
    this.add.text(left + 12, top + 55, `Pressure: ${prep.pressure}`, {
      fontFamily: 'Arial', fontSize: '11px', color: '#ffb38a', lineSpacing: 1, wordWrap: { width: width - 24 }, maxLines: 2
    });
    this.add.text(left + 12, top + 84, `Prep: ${prep.usefulNodes.join(', ') || 'none ahead'}`, {
      fontFamily: 'Arial', fontSize: '11px', color: '#8df4ff', lineSpacing: 1, wordWrap: { width: width - 24 }, maxLines: 2
    });
    this.add.text(left + 12, top + 100,
      `Cover ${prep.readiness.cover} / Damage ${prep.readiness.damage} / Recovery ${prep.readiness.recovery} / Molt ${prep.readiness.moltSafety} / Supplies ${prep.readiness.supplies}`,
      { fontFamily: 'Arial', fontSize: '10px', color: '#cdd9e6', wordWrap: { width: width - 24 }, maxLines: 2 }
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
          profile.bossRouteMarkChoices ? `${profile.bossRouteMarkChoices} boss Waymarks` : ''
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
    const current = this.runState.currentRouteNodeId === node.id;
    const selected = this.selectedNodeId === node.id;
    const isBoss = node.type === 'boss';
    const radius = isBoss ? 38 : 30;
    // Icons carry node type now; the plate stays neutral and the ring carries route state.
    const fillColor = selectable ? 0x122235 : completed ? 0x0f1d18 : 0x0c1420;
    const fillAlpha = completed ? 0.68 : selectable ? 0.94 : 0.86;
    const strokeColor = selected ? 0x9fe9ff : selectable ? 0x8fb0c6 : current ? 0xd8a840 : completed ? 0x6fd69a : 0x49606d;
    const strokeWidth = selected ? 2.5 : selectable ? 2 : current ? 2 : 1.5;
    const strokeAlpha = selected ? 0.96 : selectable ? 0.74 : current ? 0.82 : completed ? 0.76 : 0.52;

    // Current and reachable states use fine rings; selection is handled by focus ticks.
    if (current) {
      this.add.circle(x, y, radius + 6, 0xd8a840, 0).setStrokeStyle(1.5, 0xd8a840, 0.34);
    }
    if (selectable && !selected) {
      this.add.circle(x, y, radius + 5, 0x7ab8d6, 0.03).setStrokeStyle(1, 0x7ab8d6, 0.22);
    }
    const circle = this.add.circle(x, y, radius, fillColor, fillAlpha)
      .setStrokeStyle(strokeWidth, strokeColor, strokeAlpha);
    if (selected) this.renderSelectedRouteNodeFocus(x, y, radius);
    // Every node is hoverable for the full preview; selectable nodes commit-select on click.
    circle.setInteractive({ useHandCursor: selectable });
    if (selectable) circle.on('pointerdown', () => this.selectRouteNode(node.id));
    let tip: Phaser.GameObjects.Container | undefined;
    circle.on('pointerover', () => { tip = this.showNodeTooltip(node, x, y - radius - 8); });
    circle.on('pointerout', () => { tip?.destroy(true); tip = undefined; });

    this.renderRouteNodeTypeIcon(node.type, x, y, isBoss ? 66 : 52, completed ? 0.55 : 1);
    this.renderRouteRewardBadges(node, x, y, radius, completed);

    // Risk pip (bottom-left) for combat crossings, where risk actually varies.
    if (node.type === 'street' || node.type === 'rival' || node.type === 'boss') {
      this.add.circle(x - radius + 8, y + radius - 8, 6, routeNodeRiskColor(node.risk), 1)
        .setStrokeStyle(1.5, 0x0a121c, 0.8);
    }
    // Completed check (top-right).
    if (completed) {
      this.add.circle(x + radius - 7, y - radius + 7, 7, 0x6fd69a, 1);
    }
  }

  private renderSelectedRouteNodeFocus(x: number, y: number, radius: number) {
    const r = radius + 8;
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
    this.add.circle(x, y, radius + 5, 0x24d0d6, 0).setStrokeStyle(1, 0x24d0d6, 0.28);
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
      fontFamily: 'Arial',
      fontSize: `${Math.max(11, Math.round(size * 0.45))}px`,
      fontStyle: 'bold',
      color: alpha < 1 ? '#7c8da0' : '#ffffff',
      stroke: '#0a121c',
      strokeThickness: 3
    }).setOrigin(0.5).setAlpha(alpha);
  }

  private renderRouteRewardBadges(node: RouteNode, x: number, y: number, radius: number, completed: boolean) {
    const badges = this.routeRewardBadges(node).slice(0, 3);
    if (badges.length === 0) return;
    const gap = 16;
    const startX = x - ((badges.length - 1) * gap) / 2;
    const by = y + radius + 9;
    const alpha = completed ? 0.55 : 0.95;
    badges.forEach((badge, index) => {
      const bx = startX + index * gap;
      this.add.circle(bx, by, 8, 0x07101c, 0.96 * alpha)
        .setStrokeStyle(1.5, badge.color, alpha);
      this.add.text(bx, by - 1, badge.icon, {
        fontFamily: 'Arial',
        fontSize: '10px',
        fontStyle: 'bold',
        color: badge.text,
        stroke: '#020409',
        strokeThickness: 2
      }).setOrigin(0.5).setAlpha(alpha);
    });
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
    const line2 = `${detail.type} / ${node.risk} risk`;
    const width = Math.max(detail.title.length, line2.length) * 7 + 26;
    const graph = this.routeLayout().graph;
    const cx = Math.max(graph.left + width / 2, Math.min(graph.right - width / 2, x));
    const top = anchorY - 22;
    const container = this.add.container(0, 0);
    container.add(this.add.rectangle(cx, top, width, 44, 0x05161f, 0.98).setStrokeStyle(1, 0x7ab8d6, 0.95));
    container.add(this.add.text(cx, top - 9, detail.title, { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#ffe1a3' }).setOrigin(0.5));
    container.add(this.add.text(cx, top + 10, line2, { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: routeNodeRiskHex(node.risk) }).setOrigin(0.5));
    return container;
  }

  private nodePosition(node: RouteNode) {
    const columns = currentMap().columns;
    const columnNodes = columns[node.column] ?? [node.id];
    const laneIndex = Math.max(0, columnNodes.indexOf(node.id));
    // Spread evenly across the graph area (left of the detail panel) so any number
    // of columns/lanes fits without overflow.
    const { left: leftX, right: rightX, top, bottom } = this.routeLayout().graph;
    const colCount = Math.max(1, columns.length);
    const x = colCount > 1 ? leftX + (node.column * (rightX - leftX)) / (colCount - 1) : (leftX + rightX) / 2;
    const laneGap = Math.min(114, (bottom - top - 42) / Math.max(1, columnNodes.length));
    const y = (top + bottom) / 2 + (laneIndex - (columnNodes.length - 1) / 2) * laneGap;
    return { x, y };
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
    if (currentCombatNodeIds().has(routeNodeId)) {
      this.scene.start('BattleScene', { routeNodeId, runState: cloneRunState(this.runState) });
      return;
    }
    const node = currentMap().nodes.find((candidate) => candidate.id === routeNodeId);
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
    this.runState.currentRouteNodeId = node.id;
    if (!this.runState.completedRouteNodeIds.includes(node.id)) {
      this.runState.completedRouteNodeIds.push(node.id);
    }
    this.nodeChoiceOpen = true;
    this.nodeChoiceNodeId = node.id;
    this.selectableNodeIds = new Set();
    this.renderAll();
  }

  private nodeChoiceList(node: RouteNode): Array<{ key: string; text: string; effects: string[]; locked: boolean; lockedText?: string }> {
    const nodeOption = (option: { id: string; label: string; effects: string[]; cost?: number }) => ({
      key: option.id,
      text: option.label,
      effects: option.effects,
      locked: option.cost !== undefined && this.runState.scrap < option.cost,
      lockedText: option.cost !== undefined ? `Need ${option.cost} Scrap` : undefined
    });
    if (node.type === 'basin') return alphaBasinSet.options.map(nodeOption);
    if (node.type === 'cache') {
      const bonus = this.routeMarkValue('cacheChoice', 'extraCacheChoice');
      return alphaCacheSet.options
        .slice(0, Math.min(alphaCacheSet.options.length, 5 + bonus))
        .map(nodeOption);
    }
    if (node.type === 'nest') {
      return alphaNestSet.options.map(nodeOption);
    }
    const signal = alphaSignalLibrary.get(node.payloadId);
    return (signal?.choices ?? []).map((choice) => ({
      key: choice.key,
      text: choice.text,
      effects: choice.outcomes,
      locked: !this.requirementsMet(choice.requirements),
      lockedText: choice.lockedText
    }));
  }

  private routeMarkValue(trigger: string, verb: string) {
    let total = 0;
    for (const id of this.runState.routeMarks ?? []) {
      const mark = alphaRouteMarkLibrary.get(id);
      if (!mark || mark.trigger !== trigger) continue;
      const parsed = parseEffect(mark.effect);
      if (parsed && parsed.name === verb) total += parseEffectValue(parsed.args[1] ?? parsed.args[0], 0);
    }
    return total;
  }

  private chooseNodeOption(key: string) {
    const node = currentMap().nodes.find((candidate) => candidate.id === this.nodeChoiceNodeId);
    if (!node) return;
    const choice = this.nodeChoiceList(node).find((entry) => entry.key === key);
    if (!choice || choice.locked) return;
    // Preen/Release defer to a card picker so the player chooses the card; other
    // effects resolve immediately.
    let pickerMode: 'preen' | 'release' | undefined;
    for (const effect of choice.effects) {
      const parsed = parseEffect(effect);
      if (parsed?.name === 'preenCard') { pickerMode = 'preen'; continue; }
      if (parsed?.name === 'releaseCard') { pickerMode = 'release'; continue; }
      this.resolveRouteEffect(effect);
    }
    if (node.type === 'signal') {
      const signalScrap = this.routeMarkValue('signalResolved', 'gainScrap');
      if (signalScrap > 0) this.runState.scrap += signalScrap;
      (this.runState.signalChoices ??= []).push({ signalId: node.payloadId, choiceKey: key });
    }
    this.runState.routeLog.push(`${node.label}: ${choice.text}`);
    this.runState.routeLog = this.runState.routeLog.slice(-8);
    if (pickerMode && this.pickerEligibleCards(pickerMode).length > 0) {
      this.cardPickerMode = pickerMode;
      this.nodeChoiceOpen = false;
      this.renderAll();
      return;
    }
    this.nodeChoiceOpen = false;
    this.nodeChoiceNodeId = undefined;
    this.scene.restart({ runState: cloneRunState(this.runState) });
  }

  private pickerEligibleCards(mode: 'preen' | 'release') {
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
        return { index, card, name: card.name, cost: card.cost, upgraded: !!saved.upgraded };
      });
  }

  private applyCardPick(index: number) {
    const saved = this.runState.deck[index];
    if (!saved) return;
    const name = cardLibrary[saved.id]?.name ?? saved.id;
    if (this.cardPickerMode === 'preen') {
      saved.upgraded = true;
      this.runState.routeLog.push(`Preened ${name}.`);
    } else {
      this.runState.routeLog.push(`Released ${name}.`);
      this.runState.deck.splice(index, 1);
    }
    this.cardPickerMode = undefined;
    this.runState.routeLog = this.runState.routeLog.slice(-8);
    this.scene.restart({ runState: cloneRunState(this.runState) });
  }

  private renderCardPickerOverlay() {
    const mode = this.cardPickerMode;
    if (!mode) return;
    const eligible = this.pickerEligibleCards(mode);
    const node = currentMap().nodes.find((candidate) => candidate.id === this.nodeChoiceNodeId);
    const accent = mode === 'preen' ? UI_FIELD.cyan : UI_FIELD.danger;
    this.renderRouteEventBackdrop(node, 0.82);
    const frame = renderFieldPanel(this, (obj) => {}, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8, 1040, 558, {
      eyebrow: node ? routeNodeTypeLabel(node.type) : 'Flock Workbench',
      title: mode === 'preen' ? 'Preen a Card' : 'Release a Card',
      subtitle: mode === 'preen' ? 'Choose the card the landmark workbench improves.' : 'Choose the card the flock leaves behind here.',
      accent,
      fill: mode === 'preen' ? 0x071824 : 0x1b1114
    });
    this.add.rectangle(frame.cx, frame.cy, frame.w - 36, frame.h - 36, 0x020409, 0.14);
    this.add.text(frame.left + 54, frame.top + 112, node?.label ?? 'Workshop stop', {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#8df4ff',
      wordWrap: { width: 360 },
      maxLines: 2
    });
    this.add.text(frame.left + 54, frame.top + 142, mode === 'preen' ? 'The flock gathers at a bright repair table, choosing one card to polish before moving on.' : 'The flock sorts the pack at the edge of the landmark, making room before the next crossing.', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#cdd9e6',
      lineSpacing: 2,
      wordWrap: { width: 360 }
    });
    eligible.slice(0, 12).forEach((entry, i) => {
      const x = frame.left + 520 + (i % 2) * 248;
      const y = frame.top + 122 + Math.floor(i / 2) * 64;
      const button = this.add.rectangle(x, y, 226, 50, 0x101b2a, 0.94).setStrokeStyle(1.5, accent, 0.74).setInteractive({ useHandCursor: true });
      button.on('pointerdown', () => this.applyCardPick(entry.index));
      button.on('pointerover', () => this.showHoverCardDetail(entry.card, mode === 'preen' ? 'Preen candidate' : 'Release candidate', entry.cost, x, y));
      button.on('pointerout', () => this.hideHoverCardDetail());
      this.add.circle(x - 92, y, 13, entry.cost === 0 ? 0x24d0d6 : 0xd8a840, 1);
      this.add.text(x - 92, y, `${entry.cost}`, { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#07101c' }).setOrigin(0.5);
      this.add.text(x - 72, y - 12, `${entry.name}${entry.upgraded ? '+' : ''}`, {
        fontFamily: 'Arial',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffe1a3',
        wordWrap: { width: 146 },
        maxLines: 2
      });
    });
  }

  private showHoverCardDetail(card: Card, zone: string, cost: number, anchorX: number, anchorY: number) {
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
      if (name === 'hasSupplySlot' && (this.runState.supplies ?? []).length >= 2) return false;
      if (name === 'mapIndexAtLeast' && (currentMap().index ?? 1) < n) return false;
    }
    return true;
  }

  // The route-effect interpreter: executes a single route-effect verb against the
  // run state (next-level-data-contracts §6.3).
  private resolveRouteEffect(effect: string) {
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
      case 'startNextCombatOpenSky': mod({ startOpenSky: true }); break;
      // revealNodes / skipNextStreet / removeRouteChoice are route-graph hints;
      // Alpha pre-reveals the whole map, so they are no-ops here.
      default: break;
    }
  }

  private grantRouteMark(selector: string) {
    let id = selector;
    if (selector === 'random' || selector === 'randomNonBoss' || selector === 'randomCommon' || selector === 'choice') {
      const pool = MARKET_ROUTE_MARK_IDS.filter((markId) => !this.hasRouteMark(markId));
      if (pool.length === 0) return;
      id = pool[Math.floor(Math.random() * pool.length)];
    }
    if (id && !this.hasRouteMark(id)) this.addRouteMark(id);
  }

  private grantSupply(selector: string) {
    if ((this.runState.supplies ?? []).length >= 2) return;
    let id = selector;
    if (selector === 'random' || selector === 'choice') {
      const ids = [...alphaSupplyLibrary.keys()];
      id = ids[Math.floor(Math.random() * ids.length)];
    }
    if (alphaSupplyLibrary.has(id)) this.runState.supplies.push(id);
  }

  private grantCard(selector: string) {
    const owned = new Set(this.runState.deck.map((card) => card.id));
    let pool = arcanaRewardPool.filter((id) => !owned.has(id));
    if (selector === 'randomCommonPlumesOrQuills') {
      pool = pool.filter((id) => {
        const card = cardLibrary[id];
        return card && card.runtime.rarity === 'common' && (card.runtime.suit === 'plumes' || card.runtime.suit === 'quills');
      });
    } else if (selector === 'randomCommon' || selector === 'chooseOneOfTwoCommon') {
      pool = pool.filter((id) => cardLibrary[id]?.runtime.rarity === 'common');
    }
    if (pool.length === 0) return;
    const granted = pool[Math.floor(Math.random() * pool.length)];
    this.runState.deck.push({ id: granted });
    discoverCards([granted]);
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
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#dbe6f0',
      lineSpacing: 4,
      wordWrap: { width: 400 },
      maxLines: 6
    });
    this.add.text(frame.left + 54, frame.bottom - 94, `Scrap ${this.runState.scrap}    /    Cohesion ${this.runState.currentHp}/${this.runMaxHp()}`, {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#8df4ff'
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
        fontFamily: 'Arial',
        fontSize: '16px',
        fontStyle: 'bold',
        color: choice.locked ? '#7f93a8' : '#ffe1a3',
        wordWrap: { width: 456 },
        maxLines: 1
      });
      this.add.text(x - 238, y + 2, choice.locked && choice.lockedText ? choice.lockedText : routeEffectSummary(choice.effects), {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: choice.locked ? '#ff9d4d' : '#b9c7d6',
        wordWrap: { width: 456 },
        maxLines: 2
      });
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
    if (!this.runState.completedRouteNodeIds.includes(node.id)) {
      this.runState.completedRouteNodeIds.push(node.id);
    }
    this.marketOpen = true;
    this.marketNodeId = node.id;
    this.marketMessage = 'Rooftop vendors spread their tarps between antenna masts. Each shelf has one good opening; once it is gone, it is gone.';
    this.marketBoughtCard = false;
    this.marketBoughtRouteMark = false;
    this.marketBoughtPreen = false;
    this.selectableNodeIds = new Set();
    this.renderAll();
  }

  private applyRouteNodeReward(node: RouteNode) {
    const recovery = routeNodeRecovery(node, this.runState.routeMarks);
    if (recovery > 0) this.runState.currentHp = Math.min(this.runMaxHp(), this.runState.currentHp + recovery);
    let signalScrap = 0;

    if (node.type === 'cache') {
      this.runState.scrap += CACHE_SCRAP_REWARD;
      const mark = this.firstUnownedRouteMark();
      if (mark) this.addRouteMark(mark.id);
    }

    if (node.type === 'signal') {
      signalScrap = this.routeMarkValue('signalResolved', 'gainScrap');
      if (signalScrap > 0) this.runState.scrap += signalScrap;
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
    this.queueOptionalCardArtLoad();
    const node = currentMap().nodes.find((candidate) => candidate.id === this.marketNodeId);
    this.renderRouteEventBackdrop(node, 0.86);
    const frame = renderFieldPanel(this, (obj) => {}, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8, 1080, 560, {
      eyebrow: 'Landmark Visit',
      title: node?.label ?? 'Market',
      subtitle: 'A bright stall line has unfolded across the crossing.',
      accent: UI_FIELD.gold,
      fill: UI_FIELD.panelWarm
    });
    this.add.rectangle(frame.left + 246, frame.cy + 38, 396, 414, 0x020409, 0.18).setStrokeStyle(1, UI_FIELD.gold, 0.22);
    this.add.text(frame.left + 54, frame.top + 116, `Scrap ${this.runState.scrap}`, {
      fontFamily: 'Arial',
      fontSize: '21px',
      fontStyle: 'bold',
      color: '#f0c36f'
    });
    this.add.text(frame.left + 54, frame.top + 150, this.marketMessage, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#d7c5a6',
      lineSpacing: 3,
      wordWrap: { width: 392 },
      maxLines: 4
    });

    this.renderMarketCardOffer(frame.left + 250, frame.top + 398);
    this.renderMarketRouteMarkOffer(frame.left + 740, frame.top + 290);
    this.renderMarketPreenOffer(frame.left + 740, frame.top + 452);

    renderCloseControl(this, (obj) => {}, frame.right - 80, frame.top + 56, () => this.leaveMarket());
  }

  private renderMarketCardOffer(x: number, y: number) {
    const offer = this.marketCardOffer();
    const enabled = !!offer && this.runState.scrap >= MARKET_CARD_PRICE;
    const panel = this.add.rectangle(x, y, 310, 310, 0x1a1711, 0.94)
      .setStrokeStyle(1, enabled ? 0xd8a840 : 0x6f6044, enabled ? 0.8 : 0.45);
    this.add.rectangle(x, y - 142, 270, 2, enabled ? 0xd8a840 : 0x6f6044, enabled ? 0.75 : 0.35);
    if (offer) {
      panel.setInteractive({ useHandCursor: false });
      panel.on('pointerover', () => this.showHoverCardDetail(offer, 'Market offer', MARKET_CARD_PRICE, x, y));
      panel.on('pointerout', () => this.hideHoverCardDetail());
    }
    this.add.text(x - 126, y - 132, 'Add to the Flock', marketOfferTitleStyle());
    this.add.text(x + 58, y - 132, `${MARKET_CARD_PRICE} Scrap`, marketOfferPriceStyle(enabled));
    if (offer) {
      const key = cardArtKey(offer);
      if (key && this.textures.exists(key)) {
        this.add.image(x, y + 28, key).setDisplaySize(138, 207).setAlpha(0.86);
      } else {
        this.add.rectangle(x, y + 28, 138, 207, 0x141f2f, 0.92)
          .setStrokeStyle(1, 0x6f6044, 0.75);
        this.add.text(x, y + 40, cardLabel(offer), {
          fontFamily: 'Arial',
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#7ab8d6',
          align: 'center',
          wordWrap: { width: 104 }
        }).setOrigin(0.5);
      }
      this.add.rectangle(x, y - 80, 264, 74, 0x05080e, 0.7)
        .setStrokeStyle(1, 0xd8a840, 0.25);
      this.add.text(x - 118, y - 108, displayName(offer), {
        fontFamily: 'Arial',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffe1a3',
        wordWrap: { width: 232 },
        maxLines: 2
      });
      this.add.text(x - 118, y - 56, `${offer.bird} / ${cardLabel(offer)}`, {
        fontFamily: 'Arial',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#7ab8d6',
        wordWrap: { width: 232 },
        maxLines: 1
      });
    } else {
      this.add.text(x - 126, y - 50, this.marketBoughtCard ? 'That recruitment lead has moved on.' : 'Every available crew card is already in the flock.', detailBodyStyle(250));
    }
    this.renderMarketButton(x, y + 132, 'Buy', enabled, () => this.buyMarketCard());
  }

  private renderMarketRouteMarkOffer(x: number, y: number) {
    const mark = this.marketRouteMarkOffer();
    const enabled = !!mark && this.runState.scrap >= mark.price;
    this.add.rectangle(x, y, 460, 132, 0x1a1711, 0.93)
      .setStrokeStyle(1, enabled ? 0xd8a840 : 0x6f6044, enabled ? 0.75 : 0.42);
    this.add.rectangle(x, y - 58, 420, 2, enabled ? 0xd8a840 : 0x6f6044, enabled ? 0.7 : 0.35);
    this.add.text(x - 204, y - 46, 'Waymark', marketOfferTitleStyle());
    this.add.text(x - 204, y - 18, mark ? `${mark.name} / ${mark.price} Scrap` : 'Sold out', marketOfferPriceStyle(enabled));
    this.add.text(x - 204, y + 12, mark ? mark.text : this.marketBoughtRouteMark ? 'The route-board pin is already claimed.' : 'No unclaimed marks remain in this market.', detailBodyStyle(292));
    this.renderMarketButton(x + 160, y + 30, 'Buy', enabled, () => this.buyMarketRouteMark());
  }

  private renderMarketPreenOffer(x: number, y: number) {
    const card = this.marketPreenCandidate();
    const price = this.marketPreenPrice();
    const enabled = !!card && this.runState.scrap >= price;
    const panel = this.add.rectangle(x, y, 460, 132, 0x14171a, 0.93)
      .setStrokeStyle(1, enabled ? 0x24d0d6 : 0x59606a, enabled ? 0.72 : 0.42);
    this.add.rectangle(x, y - 58, 420, 2, enabled ? 0x24d0d6 : 0x59606a, enabled ? 0.68 : 0.32);
    if (card) {
      panel.setInteractive({ useHandCursor: false });
      panel.on('pointerover', () => this.showHoverCardDetail(card, 'Preen candidate', price, x, y));
      panel.on('pointerout', () => this.hideHoverCardDetail());
    }
    this.add.text(x - 204, y - 46, 'Preen a Card', marketOfferTitleStyle());
    this.add.text(x - 204, y - 18, card ? `${displayName(card)} / ${price} Scrap` : 'No cards to preen', marketOfferPriceStyle(enabled));
    this.add.text(x - 204, y + 12, card ? 'Improve the first unpreened card in your flock deck.' : this.marketBoughtPreen ? 'The preening bench is packed away.' : 'Every card in the flock is already polished.', detailBodyStyle(292));
    this.renderMarketButton(x + 160, y + 30, 'Preen', enabled, () => this.buyMarketPreen());
  }

  private renderMarketButton(x: number, y: number, label: string, enabled: boolean, onClick: () => void) {
    renderFieldButton(this, (obj) => {}, x, y, 112, 34, label, enabled, onClick, UI_FIELD.gold);
  }

  private buyMarketCard() {
    const offer = this.marketCardOffer();
    if (!offer || this.runState.scrap < MARKET_CARD_PRICE) return;
    this.runState.scrap -= MARKET_CARD_PRICE;
    this.runState.deck.push({ id: offer.id, upgraded: offer.upgraded });
    this.marketBoughtCard = true;
    this.marketMessage = `${displayName(offer)} joins the flock.`;
    this.renderAll();
    this.queueOptionalCardArtLoad();
  }

  private buyMarketRouteMark() {
    const mark = this.marketRouteMarkOffer();
    if (!mark || this.runState.scrap < mark.price) return;
    this.runState.scrap -= mark.price;
    this.addRouteMark(mark.id);
    this.marketBoughtRouteMark = true;
    this.marketMessage = `${mark.name} is pinned to the route board.`;
    this.renderAll();
  }

  private buyMarketPreen() {
    const card = this.marketPreenCandidate();
    const price = this.marketPreenPrice();
    if (!card || this.runState.scrap < price) return;
    const saved = this.runState.deck.find((candidate) => candidate.id === card.id);
    if (!saved) return;
    saved.upgraded = true;
    this.runState.scrap -= price;
    this.marketBoughtPreen = true;
    this.marketMessage = `${card.name} is preened.`;
    this.renderAll();
  }

  private leaveMarket() {
    const node = currentMap().nodes.find((candidate) => candidate.id === this.marketNodeId);
    this.runState.routeLog.push(node ? `${node.label}: market business settled.` : 'Market business settled.');
    this.runState.routeLog = this.runState.routeLog.slice(-8);
    this.marketOpen = false;
    this.marketNodeId = undefined;
    this.marketMessage = '';
    this.scene.restart({ runState: cloneRunState(this.runState) });
  }

  private marketCardOffer() {
    if (this.marketBoughtCard) return undefined;
    const owned = new Set(this.runState.deck.map((card) => card.id));
    const id = arcanaRewardPool.find((candidate) => !owned.has(candidate));
    return id ? cloneCard(id) : undefined;
  }

  private marketRouteMarkOffer() {
    if (this.marketBoughtRouteMark) return undefined;
    return routeMarks.find((mark) => !this.hasRouteMark(mark.id));
  }

  private marketPreenCandidate() {
    if (this.marketBoughtPreen) return undefined;
    const saved = this.runState.deck.find((card) => !card.upgraded);
    if (!saved) return undefined;
    const card = cloneCard(saved.id);
    card.upgraded = saved.upgraded;
    return card;
  }

  private marketPreenPrice() {
    return Math.max(35, MARKET_PREEN_PRICE - this.routeMarkValue('passive', 'reducePreenPrice'));
  }

  private firstUnownedRouteMark() {
    return routeMarks.find((mark) => !this.hasRouteMark(mark.id));
  }

  private addRouteMark(markId: string) {
    if (!this.runState.routeMarks.includes(markId)) this.runState.routeMarks.push(markId);
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
    this.inspectedCardId = undefined;
    this.cardReviewScroll = 0;
    this.renderAll();
    this.queueOptionalCardArtLoad();
  }

  private openFlockOverlay() {
    this.flockOverlayOpen = true;
    this.renderAll();
  }

  private closeFlockOverlay() {
    this.flockOverlayOpen = false;
    this.renderAll();
  }

  // The same Flock Stats table as in battle, sourced from the run deck so the
  // flock is examinable between fights (where build decisions are made).
  private renderRouteFlockOverlay() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.78)
      .setInteractive({ useHandCursor: false });
    this.add.text(260, 156, `Cohesion ${this.runState.currentHp}/${this.runMaxHp()}   ·   Scrap ${this.runState.scrap}   ·   Waymarks ${this.runState.routeMarks.length}`, {
      fontFamily: 'Arial', fontSize: '15px', color: '#8df4ff'
    });
    const rows = buildFlockStatRows(cardsFromSave(this.runState.deck), this.runMaxHp());

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
    this.add.text(panelX, panelTop + 108, `Cohesion ${this.runState.currentHp}/${this.runMaxHp()}   /   Scrap ${this.runState.scrap}   /   Waymarks ${this.runState.routeMarks.length}`, {
      fontFamily: 'Arial', fontSize: '15px', color: '#8df4ff'
    }).setOrigin(0.5);
    renderFlockStatTable(this, () => {}, rows, 390, panelTop + 148);
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
    const frame = renderFieldPanel(this, (obj) => {}, GAME_WIDTH / 2, GAME_HEIGHT / 2, 1060, 570, {
      eyebrow: 'Field Binder',
      title: `Deck Review (${this.mapDeckCards().length})`,
      subtitle: `Flock deck / Cohesion ${this.runState.currentHp}/${this.runMaxHp()}`,
      accent: UI_FIELD.gold
    });
    renderCloseControl(this, (obj) => {}, frame.right - 76, frame.top + 56, () => this.closeDeckOverlay());

    this.renderMapCardBrowser();
  }

  private renderMapCardBrowser() {
    const cards = this.mapDeckCards();
    this.add.text(140, 166, 'CARD INDEX', {
      fontFamily: 'Arial',
      fontSize: '11px',
      fontStyle: 'bold',
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
        fontFamily: 'Arial',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#07101c'
      }).setOrigin(0.5);
      this.add.text(x + 36, y + 5, displayName(card), {
        fontFamily: 'Arial',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffe1a3',
        wordWrap: { width: 170 }
      });
      this.add.text(x + 222, y + 6, `${cardLabel(card)} / ${zone}`, {
        fontFamily: 'Arial',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#7ab8d6'
      });
    });

    this.renderScrollButton(472, 214, 'Up', this.cardReviewScroll > 0, () => onScroll(-1));
    this.renderScrollButton(472, 610, 'Down', this.cardReviewScroll < scrollMax, () => onScroll(1));
    this.add.text(424, 632, `${this.cardReviewScroll + 1}-${this.cardReviewScroll + visible.length} / ${cards.length}`, {
      fontFamily: 'Arial',
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
        supplies: [...this.runState.supplies]
      },
      routeStatus: this.routeStatusSummary(),
      deckOverlayOpen: this.deckOverlayOpen,
      flockOverlayOpen: this.flockOverlayOpen,
      marketOpen: this.marketOpen,
      market: this.marketOpen
        ? {
            scrap: this.runState.scrap,
            cardOffer: this.marketCardOffer()?.id ?? '',
            routeMarkOffer: this.marketRouteMarkOffer()?.id ?? '',
            preenOffer: this.marketPreenCandidate()?.id ?? '',
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

  private renderRouteLog() {
    const footer = this.routeLayout().footer;
    const y = footer.y + 47;
    this.add.text(520, y, 'SIGNALS', {
      fontFamily: 'Arial',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#7f93a8'
    }).setOrigin(0, 0.5);
    const latest = this.runState.routeLog.slice(-2);
    this.add.text(575, y, latest.length > 0 ? latest[latest.length - 1] : 'The first route is open.', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#b9c7d6',
      wordWrap: { width: 285 }
    }).setOrigin(0, 0.5);
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
  private spark = 0;
  private turn = 1;
  private encounter = 1;
  private maxEncounters = 2;
  private currentRouteIndex = 0;
  private completedRouteNodeIds: string[] = [];
  private scrap = 0;
  private routeMarks: string[] = [];
  private runSupplies: string[] = [];
  private runLeaderId?: string;
  private runDifficulty = 0;
  private lastRunRewards?: ReturnType<typeof recordRun>;
  private runSignalChoices: SignalChoiceEvent[] = [];
  private runRewardEvents: CardRewardEvent[] = [];
  private runSuppliesUsed: string[] = [];
  private runCombatResults: CombatResultSummary[] = [];
  private freePreenNextDistrict = 0;
  private mode: GameMode = 'battle';
  private rewardChoices: Card[] = [];
  private upgradeChoices: Card[] = [];
  private log: string[] = [];
  private logDrawerOpen = false;
  private root!: Phaser.GameObjects.Container;
  // Persistent FX layer: renderAll() only clears `root`, so transient juice
  // (floating numbers, bursts) spawned here survives the synchronous redraw.
  private fxLayer!: Phaser.GameObjects.Container;
  private inspectOverlay: InspectOverlay | undefined;
  private inspectedCardId: string | undefined;
  private waymarkDrawerOpen = false;
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
  // Waymark per-combat latches: which once-per-combat marks have
  // fired, whether the first Open Sky increase has been softened, and the
  // per-turn card count that drives onNthCardThisTurn marks.
  private markFiredThisCombat = new Set<string>();
  private markFirstOpenSkyConsumed = false;
  private cardsPlayedThisTurn = 0;
  // Last-rendered formation state, so transitions fire a one-shot banner/FX.
  private lastFlockState: FlockState = 'holding';
  // Floating large-card preview shown while hovering a hand card.
  private cardPreview?: Phaser.GameObjects.Container;
  // Quills keystone: the first attack each turn hits harder (consumed on use).
  private firstAttackThisTurn = true;
  // renderAll() rebuilds the board, so one-shot enemy motion is queued here and
  // consumed by the next render instead of trying to animate destroyed objects.
  private enemyMotionCues = new Map<string, EnemyMotionCue>();
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
    this.spark = 0;
    this.turn = 1;
    this.encounter = initialRouteIndex + 1;
    this.maxEncounters = currentCombatNodes().length;
    this.currentRouteIndex = initialRouteIndex;
    this.completedRouteNodeIds = [...runState.completedRouteNodeIds];
    this.scrap = runState.scrap;
    this.routeMarks = [...runState.routeMarks];
    this.runSupplies = [...(runState.supplies ?? [])];
    this.runSignalChoices = [...(runState.signalChoices ?? [])];
    this.runRewardEvents = [...(runState.rewardEvents ?? [])];
    this.runSuppliesUsed = [...(runState.suppliesUsed ?? [])];
    this.runCombatResults = [...(runState.combatResults ?? [])];
    this.freePreenNextDistrict = runState.freePreenNextDistrict ?? 0;
    this.mode = 'battle';
    this.inspectOverlay = undefined;
    this.inspectedCardId = undefined;
    this.waymarkDrawerOpen = false;
    this.cardReviewScroll = 0;
    this.rewardChoices = [];
    this.upgradeChoices = [];
    this.log = [`${currentMap().name}: ${initialRouteNode.label} begins.`];
    this.optionalArtRequested = false;
    this.playedCardIdsThisCombat = new Set();
    this.playedSuitsThisTurn = new Set();
    this.statDealt = 0;
    this.statTaken = 0;
    this.statBlocked = 0;
    this.statCardsPlayed = 0;
    this.statDefeated = 0;
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
      case 'gainWingbeat':
        this.energy += value;
        break;
      case 'gainOpenSkyGuard':
        this.flock.openSkyGuard += value;
        break;
      case 'draw':
        this.drawCards(value);
        break;
      case 'heal':
        this.healFlock(value, markName);
        break;
      case 'bossDamageShield':
        if (currentCombatNodes()[this.currentRouteIndex]?.type === 'boss') {
          this.flock.block += value;
          floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 24, `+${value} Boss Cover`, '#ffe1a3');
        }
        break;
    }
  }

  private applyMarkTrigger(trigger: string) {
    for (const mark of this.ownedMarkDefs()) {
      if (mark.trigger !== trigger) continue;
      this.resolveMarkEffect(mark.effect, mark.name);
      this.logEvent(`${mark.name}: ${mark.description}`);
    }
  }

  // Sum the numeric arg of a verb across owned marks at a trigger (for passive
  // modifiers like quiet_landing's reduceOpenSky).
  private markValue(trigger: string, verb: string) {
    let total = 0;
    for (const mark of this.ownedMarkDefs()) {
      if (mark.trigger !== trigger) continue;
      const parsed = parseEffect(mark.effect);
      if (parsed && parsed.name === verb) total += parseEffectValue(parsed.args[1] ?? parsed.args[0], 0);
    }
    return total;
  }

  // Reset the per-combat latches and fire combatStart marks. Called once per
  // combat from create() (after fxLayer exists), so cover/wingbeat marks land
  // on turn 1 and aren't wiped by the next turn's energy/block reset.
  private applyCombatStartMarks() {
    this.markFiredThisCombat = new Set();
    this.markFirstOpenSkyConsumed = false;
    this.cardsPlayedThisTurn = 0;
    this.applyMarkTrigger('combatStart');
  }

  // onNthCardThisTurn(N) marks: fire once per combat the first time the player
  // has played N cards in a single turn.
  private checkNthCardMarks() {
    for (const mark of this.ownedMarkDefs()) {
      const nth = /^onNthCardThisTurn\((\d+)\)$/.exec(mark.trigger);
      if (!nth || this.cardsPlayedThisTurn !== Number(nth[1]) || this.markFiredThisCombat.has(mark.id)) continue;
      this.markFiredThisCombat.add(mark.id);
      this.resolveMarkEffect(mark.effect, mark.name);
      this.logEvent(`${mark.name}: ${mark.description}`);
    }
  }

  // mapStart marks grant their supply into the run as the flock enters the next
  // district (reused this.runSupplies flows into createRouteReturnState).
  private applyMapStartMarks() {
    for (const mark of this.ownedMarkDefs()) {
      if (mark.trigger !== 'mapStart') continue;
      const parsed = parseEffect(mark.effect);
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
      this.logDrawerOpen = false;
      this.renderAll();
    });
    this.input.keyboard?.on('keydown-ENTER', () => this.endTurn());
    this.input.keyboard?.on('keydown-F', () => this.scale.toggleFullscreen());
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
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
    const leader = getLeader(this.runLeaderId);
    const node = currentCombatNodes()[this.currentRouteIndex];
    const c = this.add.container(0, 0);
    const shade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.54);
    const topBand = this.add.rectangle(GAME_WIDTH / 2, 106, GAME_WIDTH, 70, 0x05080e, 0.84);
    const bottomBand = this.add.rectangle(GAME_WIDTH / 2, 610, GAME_WIDTH, 70, 0x05080e, 0.78);
    const line = this.add.rectangle(GAME_WIDTH / 2, 356, 760, 3, 0x8df4ff, 0.85).setAngle(-9);
    const leftLabel = this.add.text(74, 86, 'ROOFLINE CONTACT', {
      fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: '#8df4ff',
    });
    const title = this.add.text(74, 112, `${leader.name} / ${currentMap().name}`, {
      fontFamily: 'Georgia, serif', fontSize: '23px', fontStyle: 'bold', color: '#ffe1a3',
      stroke: '#000000', strokeThickness: 4,
    });
    const rightLabel = this.add.text(GAME_WIDTH - 74, 594, node?.label ?? 'Rooftop Fight', {
      fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold', color: '#ffd5cc',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(1, 0);
    const sub = this.add.text(GAME_WIDTH - 74, 620, 'Enemies sighted on the roofline.', {
      fontFamily: 'Arial', fontSize: '12px', color: '#b9c7d6',
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
    hideKwTooltip();
    enemyMoveContext = { flock: this.flock, turn: this.turn }; // keep conditional intents live
    this.normalizeSelectedEnemy();
    this.updateFormationFx();
    this.root.removeAll(true);
    this.renderBackdrop();
    this.renderTopBar();
    this.renderEnemyRow();
    this.renderFlockLeader();
    this.renderPiles();
    this.renderHand();
    this.renderSupplies();
    this.renderWaymarkShelf();
    this.renderCommandStrip();
    this.renderToast();
    if (this.mode === 'cardReward') this.renderCardReward();
    if (this.mode === 'upgradeReward') this.renderUpgradeReward();
    if (this.mode === 'runComplete' || this.mode === 'defeat') this.renderOutcome();
    if (this.inspectOverlay) this.renderInspectOverlay(this.inspectOverlay);
    if (this.logDrawerOpen) this.renderLogDrawer();
    if (this.waymarkDrawerOpen) this.renderWaymarkDrawer();
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

  private queueOptionalArtLoad() {
    if (this.optionalArtRequested) return;
    this.optionalArtRequested = true;

    const requestedAssets = uniqueImageAssets([
      this.currentBattlefieldAsset(),
      this.currentFlockLeaderArtAsset(),
      ...Object.values(waymarkArtAssets),
      ...this.allDeckCards().map((card) => cardArtAssets[card.id]),
      ...this.enemies
        .map((enemy) => enemyArtAssets[enemy.runtime.id] ?? enemyArtAssets[enemy.id])
        .filter((asset): asset is { key: string; url: string } => Boolean(asset))
    ]);

    this.queueImageAssets(requestedAssets, 'Optional art failed to load');
  }

  private currentRouteNode() {
    return currentCombatNodes()[this.currentRouteIndex];
  }

  private currentBattlefieldAsset() {
    return currentBattlefieldAsset(this.currentRouteNode());
  }

  private queueCardArtLoad(cards: Card[]) {
    const assets = uniqueImageAssets(cards.map((card) => cardArtAssets[card.id]));
    this.queueImageAssets(assets, 'Card art failed to load');
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
        return { x: 930, y: count >= 4 ? 205 : 215, scale: count >= 4 ? 0.78 : 0.84 };
      }
      const goonIndex = this.enemies.slice(0, index).filter((candidate) => candidate.runtime.type !== 'boss').length;
      return bossGoonViewAt(goonIndex, count - 1);
    }
    return enemyViewAt(index, count);
  }

  // HP-bar geometry for an enemy, matching renderEnemyRow so the drain animation
  // (damageEnemy) lines up. Identical to ENEMY_HP_BAR for the single-enemy case.
  private enemyHpBar(enemy: Enemy): { x: number; y: number; w: number; h: number } {
    const { x, y, scale } = this.enemyView(enemy);
    return { x, y: y + 68 * scale, w: ENEMY_HP_BAR.w * scale, h: ENEMY_HP_BAR.h };
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
      const breathGroup = this.add.container(x, y);
      const poseGroup = this.add.container(0, 0);
      breathGroup.add(poseGroup);
      const shadow = this.add.ellipse(0, 34 * s, 112 * s, 22 * s, 0x020409, hasEnemyArt ? 0.38 : 0.26);
      poseGroup.add(shadow);
      const body = hasEnemyArt
        ? this.add.rectangle(0, -18 * s, 248 * s, 236 * s, 0x000000, 0.001)
          .setInteractive({ useHandCursor: true })
        : this.add.ellipse(0, 0, 174 * s, 136 * s, elite ? 0x5b3f6d : 0x6f4b35, 1)
          .setStrokeStyle(selected ? 5 : elite ? 4 : 2, frameColor, 1)
          .setInteractive({ useHandCursor: true });
      body.on('pointerdown', () => this.onEnemyClicked(enemy.id));
      poseGroup.add(body);
      if (hasEnemyArt && artAsset) {
        const source = this.textures.get(artAsset.key).getSourceImage() as HTMLImageElement;
        const fit = Math.min((236 * s) / source.width, (214 * s) / source.height);
        const art = this.add.image(0, -22 * s, artAsset.key)
          .setScale(fit)
          .setAlpha(0.99)
          .setInteractive({ useHandCursor: true });
        art.on('pointerdown', () => this.onEnemyClicked(enemy.id));
        poseGroup.add(art);
      } else {
        poseGroup.add(this.add.triangle(68 * s, -10 * s, 0, 0, 22 * s, 8 * s, 0, 16 * s, 0xe7c36a, 1));
        poseGroup.add(this.add.text(0, -10 * s, enemyInitials(enemy.name), {
          fontFamily: 'Arial',
          fontSize: `${Math.round(28 * s)}px`,
          fontStyle: 'bold',
          color: '#1b1110'
        }).setOrigin(0.5));
      }
      this.root.add(breathGroup);
      this.addEnemyBreathing(breathGroup, enemy, s);
      this.applyEnemyMotionCue(poseGroup, enemy, s);
      // Elite crest, clear above the intent badge so the tougher tier reads at a glance.
      if (elite) {
        this.root.add(this.add.text(x, y - 140 * s, '✦ ELITE', {
          fontFamily: 'Arial', fontSize: `${Math.round(13 * s)}px`, fontStyle: 'bold',
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
      this.root.add(this.add.text(hp.x, hp.y, `${enemy.name}  ${enemy.hp}/${enemy.maxHp}`, {
        fontFamily: 'Arial',
        fontSize: `${Math.round(18 * s)}px`,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5));

      // Intent badge: a colored ring you can read in under two seconds — the
      // number is incoming damage, the ring color is danger (next-level §2.2-2.3).
      const dmg = this.incomingAttackDamage(enemy);
      const isBrace = dmg === 0 && move.effects.some((effect) => effect.includes('gainCover'));
      const hasDebuff = move.effects.some((effect) => /applyWinded|applyOpenSky|addSnag/.test(effect));
      const ringColor = dmg > 0
        ? (dmg <= 6 ? 0xf5d38a : dmg <= 10 ? 0xff9d4d : 0xff5247)
        : isBrace ? 0x7ab8d6 : 0xc98bff;
      const badgeValue = dmg > 0 ? `${dmg}` : isBrace ? `${intentCoverValue(move)}` : '!';
      const intentSide = x > GAME_WIDTH - 210 * s ? -1 : 1;
      const bx = x + intentSide * (ENEMY_HP_BAR.w * s / 2 + 38 * s);
      const by = hp.y;
      const badge = this.add.circle(bx, by, 24 * s, 0x10171f, 0.96)
        .setStrokeStyle(dmg >= 11 ? 5 : 3, ringColor, 1);
      this.attachTooltip(
        badge,
        move.label,
        dmg > 0
          ? `Incoming attack: ${dmg} damage${hasDebuff ? ' plus a debuff' : ''}.`
          : isBrace
            ? `Enemy braces for ${intentCoverValue(move)} Cover.`
            : 'Applies pressure — a debuff or special move.'
      );
      this.root.add(badge);
      this.root.add(this.add.text(bx, by, badgeValue, {
        fontFamily: 'Arial', fontSize: `${Math.round(21 * s)}px`, fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(0.5));
      if (hasDebuff && dmg > 0) {
        this.root.add(this.add.circle(bx + 20 * s, by - 17 * s, 7 * s, 0xc98bff, 1));
        this.root.add(this.add.text(bx + 20 * s, by - 17 * s, '!', {
          fontFamily: 'Arial', fontSize: `${Math.round(12 * s)}px`, fontStyle: 'bold', color: '#170f1e'
        }).setOrigin(0.5));
      }
      this.root.add(this.add.text(bx, by + 32 * s, move.label, {
        fontFamily: 'Arial', fontSize: `${Math.round(13 * s)}px`, fontStyle: 'bold',
        color: '#ffe1a3', stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5));

      if (enemy.block > 0 || enemy.weak > 0) {
        this.root.add(this.add.text(x, y + 95 * s, enemyStatus(enemy), {
          fontFamily: 'Arial',
          fontSize: `${Math.round(15 * s)}px`,
          color: '#b9c7d6'
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
        fontFamily: 'Arial',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#ffe1a3',
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

    group.add(this.add.text(0, 150, leader.name, {
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffe1a3',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5));

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
  private renderTopBar() {
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
    const barBg = this.add.rectangle(FLOCK_HP_BAR.x, FLOCK_HP_BAR.y, FLOCK_HP_BAR.w, FLOCK_HP_BAR.h, 0x0e1a12, 0.95)
      .setStrokeStyle(1, 0x000000, 0.5).setInteractive({ useHandCursor: true });
    barBg.on('pointerdown', () => this.openOverlay('flock'));
    this.attachTooltip(barBg, 'Cohesion', 'Flock survival — reach 0 and the run ends. Click for full Flock Stats.');
    this.root.add(barBg);
    this.root.add(this.add.rectangle(left + (FLOCK_HP_BAR.w * fbFrac) / 2, FLOCK_HP_BAR.y, Math.max(2, FLOCK_HP_BAR.w * fbFrac), FLOCK_HP_BAR.h - 6, fbFrac > 0.34 ? 0x4fa777 : 0xe2b24a, 0.95));
    this.root.add(this.add.text(FLOCK_HP_BAR.x, FLOCK_HP_BAR.y, `Cohesion  ${this.flock.hp}/${this.flock.maxHp}`, { fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: '#eaf6ee', stroke: '#0a1410', strokeThickness: 3 }).setOrigin(0.5));

    // Formation badge + Flow pips (row 2, under the bar).
    const stateLabel = fstate === 'surging' ? 'SURGING' : fstate === 'scattered' ? 'SCATTERED' : 'HOLDING';
    this.root.add(this.add.text(left, row2, stateLabel, { fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: fstate === 'surging' ? '#8df4ff' : fstate === 'scattered' ? '#ff9d6b' : '#ffe1a3' }).setOrigin(0, 0.5));
    const flowX0 = left + 94;
    for (let i = 0; i < this.flock.flowMax; i += 1) {
      this.root.add(this.add.circle(flowX0 + i * 15, row2, 5, i < this.flock.flow ? stateAccent : 0x26333f, i < this.flock.flow ? 1 : 0.85).setStrokeStyle(1, 0x0a1410, 0.6));
    }
    this.root.add(this.add.text(flowX0 + this.flock.flowMax * 15 + 6, row2, 'Flow', { fontFamily: 'Arial', fontSize: '10px', color: '#7f93a6' }).setOrigin(0, 0.5));

    // Cover badge + statuses (row 1, right of the bar).
    const coverX = left + FLOCK_HP_BAR.w + 70;
    const cover = this.flock.block;
    this.root.add(this.add.rectangle(coverX, FLOCK_HP_BAR.y, 92, 28, 0x10202c, cover > 0 ? 0.97 : 0.5).setStrokeStyle(2, cover > 0 ? 0x7ab8d6 : 0x2a3a4d, cover > 0 ? 1 : 0.6));
    this.root.add(this.add.text(coverX, FLOCK_HP_BAR.y, `◈ ${cover} Cover`, { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: cover > 0 ? '#9fdcf0' : '#5f7488' }).setOrigin(0.5));
    let stx = coverX + 58;
    for (const entry of flockStatusEntries(this.flock)) {
      const t = this.add.text(stx, FLOCK_HP_BAR.y, entry.label, { fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: entry.kind === 'debuff' ? '#ff9d4d' : '#8fd6a0' }).setOrigin(0, 0.5);
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
      const txt = this.add.text(chipX, row2, `${on ? '★' : ''}${label} ${n}`, { fontFamily: 'Arial', fontSize: on ? '12px' : '11px', fontStyle: on ? 'bold' : 'normal', color: on ? hex : '#74879a' }).setOrigin(0, 0.5);
      this.root.add(txt);
      chipX += txt.width + 14;
    }

    // Run resources (row 1, mid-right).
    this.renderChip(792, FLOCK_HP_BAR.y + 1, 118, 'Resonance', `${this.spark}/5`, 0x8df4ff, 'Plumes tempo resource, capped at 5.');
    this.renderChip(916, FLOCK_HP_BAR.y + 1, 96, 'Scrap', `${this.scrap}`, 0x8df4ff, 'Currency for Markets and services.');
    this.renderChip(1024, FLOCK_HP_BAR.y + 1, 120, 'Waymarks', `${this.routeMarks.length}`, 0xc9a6ff, 'Click to inspect found artifact items.', () => {
      this.waymarkDrawerOpen = !this.waymarkDrawerOpen;
      this.inspectOverlay = undefined;
      this.logDrawerOpen = false;
      this.renderAll();
    });

    // Map info (far right).
    const routeNode = currentCombatNodes()[this.currentRouteIndex];
    this.root.add(this.add.text(1262, 36, `Rooftop ${this.encounter}/${this.maxEncounters} · Beat ${this.turn}`, { fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: '#f5d38a' }).setOrigin(1, 0.5));
    this.root.add(this.add.text(1262, 58, `${currentMap().name}: ${routeNode.label}`, { fontFamily: 'Arial', fontSize: '12px', color: '#b9c7d6' }).setOrigin(1, 0.5));
  }


  private renderChip(cx: number, cy: number, width: number, label: string, value: string, accent: number, tip?: string, onClick?: () => void) {
    const rect = this.add.rectangle(cx, cy, width, 38, 0x0b1017, 0.58).setStrokeStyle(1, accent, 0.42);
    if (onClick) {
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerdown', onClick);
    }
    if (tip) this.attachTooltip(rect, label, tip);
    this.root.add(rect);
    this.root.add(this.add.rectangle(cx, cy - 17, width - 18, 2, accent, 0.72));
    this.root.add(this.add.text(cx - width / 2 + 10, cy - 14, label.toUpperCase(), {
      fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#91a6b8'
    }));
    this.root.add(this.add.text(cx - width / 2 + 10, cy + 1, value, {
      fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold', color: '#e7eef7'
    }));
    this.root.add(this.add.circle(cx + width / 2 - 12, cy, 5, accent, 1));
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
      fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#ffe1a3'
    });
    const bodyText = this.add.text(clampedX - width / 2 + 12, top + 26, body, {
      fontFamily: 'Arial', fontSize: '11px', color: '#cdd9e6', wordWrap: { width: width - 24 }
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

  // Compact End Turn (Roost) lives in the right-hand control column, with the
  // card's own face now carrying its effect text (no wide command strip needed).
  private renderCommandStrip() {
    // Wingbeats (energy) orb — lower-left, above the draw pile.
    const ex = 88;
    const ey = 458;
    const maxEnergy = 3 + this.nextTurnEnergyBonus;
    this.root.add(this.add.circle(ex, ey, 36, 0x14233a, 0.97).setStrokeStyle(3, 0xf5d38a, 1));
    this.root.add(this.add.text(ex, ey - 8, `${this.energy}`, {
      fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffe7a8'
    }).setOrigin(0.5));
    this.root.add(this.add.text(ex, ey + 17, `/ ${maxEnergy} Wingbeats`, {
      fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#b7a06a'
    }).setOrigin(0.5));

    // Roost / End Turn — lower-right, above the discard pile.
    const bx = 1192;
    const by = 470;
    const roost = this.add.rectangle(bx, by, 130, 86, 0x3d2a2d, 0.97)
      .setStrokeStyle(2, 0xff6b57, 1)
      .setInteractive({ useHandCursor: true });
    roost.on('pointerover', () => roost.setFillStyle(0x52383b, 0.98));
    roost.on('pointerout', () => roost.setFillStyle(0x3d2a2d, 0.97));
    roost.on('pointerdown', () => this.endTurn());
    this.root.add(roost);
    this.root.add(this.add.text(bx, by - 12, 'Roost', {
      fontFamily: 'Arial', fontSize: '24px', fontStyle: 'bold', color: '#ffd5cc'
    }).setOrigin(0.5));
    this.root.add(this.add.text(bx, by + 18, 'End Turn', {
      fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#e8b9b0'
    }).setOrigin(0.5));
  }

  // Draw and discard render as real stacks of card-backs in the bottom corners.
  private renderPiles() {
    this.renderPile(this.drawPilePos(), this.drawPile.length, 'DRAW', 0x24d0d6, () => this.openOverlay('deck'));
    this.renderPile(this.discardPilePos(), this.discardPile.length, 'DISCARD', 0xd8a840, () => this.openOverlay('discard'));
  }

  private renderPile(pos: { x: number; y: number }, count: number, label: string, accent: number, onClick: () => void) {
    const { x, y } = pos;
    const w = 88;
    const h = 132;
    const has = count > 0;
    // Stacked backs for a "deck" look (more layers when fuller).
    const layers = Math.min(4, Math.max(1, Math.ceil(count / 5)));
    for (let i = layers - 1; i >= 1; i -= 1) {
      this.root.add(this.add.rectangle(x - i * 3, y - i * 3, w, h, 0x101d33, 0.95).setStrokeStyle(2, has ? accent : 0x2a3a4d, 0.55));
    }
    const top = this.add.rectangle(x, y, w, h, has ? 0x16243c : 0x0c1018, has ? 0.99 : 0.45)
      .setStrokeStyle(2, has ? accent : 0x2a3a4d, has ? 1 : 0.5)
      .setInteractive({ useHandCursor: true });
    top.on('pointerover', () => top.setFillStyle(0x1d3050, 0.99));
    top.on('pointerout', () => top.setFillStyle(has ? 0x16243c : 0x0c1018, has ? 0.99 : 0.45));
    top.on('pointerdown', onClick);
    this.attachTooltip(top, label === 'DRAW' ? 'Draw Pile' : 'Discard Pile', 'Click to inspect the cards.');
    this.root.add(top);
    // Card-back motif: a couple of inset diamonds.
    this.root.add(this.add.rectangle(x, y - 6, 30, 30, accent, has ? 0.18 : 0.08).setStrokeStyle(1.5, accent, has ? 0.7 : 0.3).setAngle(45));
    // Count badge.
    this.root.add(this.add.circle(x, y + h / 2 - 2, 18, 0x07101c, 1).setStrokeStyle(2, accent, 1));
    this.root.add(this.add.text(x, y + h / 2 - 2, `${count}`, { fontFamily: 'Arial', fontSize: '18px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5));
    this.root.add(this.add.text(x, y + h / 2 + 22, label, { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#8fa3b6' }).setOrigin(0.5));
  }

  private renderHand() {
    this.hideCardPreview(); // a redraw destroys the hovered rect; drop its stale preview
    hideKwTooltip();
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
    rect.on('pointerdown', () => this.onCardClicked(card.instanceId));
    this.root.add(rect);

    // Full card illustration shown at its true 2:3 aspect (no stretching).
    const key = cardArtKey(card);
    if (key && this.textures.exists(key)) {
      this.root.add(this.add.image(cx, HAND_Y, key).setDisplaySize(CARD_W - 4, CARD_H - 4).setAlpha(canPay ? 1 : 0.55));
    } else {
      this.root.add(this.add.rectangle(cx, HAND_Y, CARD_W - 4, CARD_H - 4, 0x141d2b, 0.92));
    }

    // Name banner (top) over a scrim so it reads against the art.
    this.root.add(this.add.rectangle(cx, top + 16, CARD_W - 4, 26, 0x05080e, 0.66));
    this.root.add(this.add.text(x + 34, top + 8, displayName(card), {
      fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: canPay ? '#ffe7b0' : '#9aa7b6', wordWrap: { width: CARD_W - 44 }
    }));
    if (contract.usesMolt) {
      this.root.add(this.add.rectangle(x + CARD_W - 43, top + 16, 70, 18, 0x2a1208, 0.88).setStrokeStyle(1, 0xff9d4d, 0.78));
      this.root.add(this.add.text(x + CARD_W - 43, top + 9, 'MOLT', {
        fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#ffc78f', align: 'center'
      }).setOrigin(0.5, 0));
    }

    // Cost badge (top-left).
    this.root.add(this.add.circle(x + 16, top + 16, 14, this.effectiveCost(card) === 0 ? 0x24d0d6 : 0xe8b830, 1).setStrokeStyle(2, 0x05080e, 0.9));
    this.root.add(this.add.text(x + 16, top + 16, `${this.effectiveCost(card)}`, {
      fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: '#06101c'
    }).setOrigin(0.5));

    // Effect text in a translucent panel over the lower third (readable in-hand,
    // art stays undistorted above it).
    const panelH = 72;
    this.root.add(this.add.rectangle(cx, bottom - panelH / 2 - 3, CARD_W - 6, panelH, 0x05080e, 0.82));
    this.root.add(this.add.rectangle(cx, bottom - panelH - 3, CARD_W - 6, 2, accent, 0.85));
    // Mechanical keywords are highlighted in their color (hover one for its meaning).
    renderRichText(this, this.root, cx, bottom - panelH + 5, contract.text, {
      wrap: CARD_W - 16, fontSize: 12, align: 'center', lineSpacing: 2, tooltips: this.mode === 'battle',
    });

    // Hovering a hand card shows a big floating preview (art + full info).
    rect.on('pointerover', () => this.showCardPreview(card));
    rect.on('pointerout', () => this.hideCardPreview());
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
    const key = cardArtKey(card);
    if (key && this.textures.exists(key)) c.add(this.add.image(cx, cy, key).setDisplaySize(w, h));
    else c.add(this.add.rectangle(cx, cy, w, h, 0x141d2b, 0.95));

    // Name banner + cost.
    c.add(this.add.rectangle(cx, top + 22, w - 4, 40, 0x05080e, 0.72));
    c.add(this.add.text(cx - w / 2 + 52, top + 9, displayName(card), { fontFamily: 'Arial', fontSize: '21px', fontStyle: 'bold', color: '#ffe7b0', wordWrap: { width: w - 72 } }));
    c.add(this.add.circle(cx - w / 2 + 26, top + 24, 20, this.effectiveCost(card) === 0 ? 0x24d0d6 : 0xe8b830, 1).setStrokeStyle(2, 0x05080e, 0.9));
    c.add(this.add.text(cx - w / 2 + 26, top + 24, `${this.effectiveCost(card)}`, { fontFamily: 'Arial', fontSize: '23px', fontStyle: 'bold', color: '#06101c' }).setOrigin(0.5));

    // Info panel (effect + Molt ability + Flock Stats) over the lower portion.
    const panelH = card.moltText ? 152 : 118;
    c.add(this.add.rectangle(cx, bottom - panelH / 2 - 4, w - 4, panelH, 0x05080e, 0.92));
    c.add(this.add.rectangle(cx, bottom - panelH - 4, w - 4, 2, accent, 0.85));
    let py = bottom - panelH + 6;
    if (contract.usesMolt) {
      c.add(this.add.text(cx, py, 'MOLT ACTIVE', {
        fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#ffc78f'
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
    c.add(this.add.text(cx, bottom - 12, statStr, { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#8df4ff', align: 'center', wordWrap: { width: w - 20 } }).setOrigin(0.5, 1));

    this.fxLayer.add(c);
    this.cardPreview = c;
  }

  // The log is no longer a permanent panel — only the latest event shows, as a
  // compact toast over the right of the battlefield. (Full-log drawer is a
  // follow-up once a structured, color-coded log-event type lands.)
  private renderToast() {
    const latest = this.log[this.log.length - 1];
    if (!latest) return;
    const cx = 770;
    const y = 436;
    const pill = this.add.rectangle(cx, y, 540, 30, 0x0a1019, 0.72)
      .setStrokeStyle(1, 0x2a3a4d, 0.6)
      .setInteractive({ useHandCursor: true });
    pill.on('pointerdown', () => { this.logDrawerOpen = !this.logDrawerOpen; this.renderAll(); });
    this.root.add(pill);
    this.root.add(this.add.text(cx + 250, y, 'Log >', {
      fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#7f93a8'
    }).setOrigin(1, 0.5));
    this.root.add(this.add.text(cx - 256, y, latest, {
      fontFamily: 'Arial', fontSize: '14px', color: '#cdd9e6', wordWrap: { width: 470 }
    }).setOrigin(0, 0.5));
  }

  // Supplies are a tactical item layer (carried between fights). They sit on the
  // left edge of the (now-open) board, below the top bar.
  private renderSupplies() {
    this.root.add(this.add.text(30, 130, 'SUPPLIES', {
      fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#7f93a8'
    }));
    for (let i = 0; i < 2; i += 1) {
      const x = 98;
      const y = 162 + i * 50;
      const id = this.runSupplies[i];
      const supply = id ? alphaSupplyLibrary.get(id) : undefined;
      const box = this.add.rectangle(x, y, 152, 44, supply ? 0x14202e : 0x0b1018, supply ? 0.97 : 0.5)
        .setStrokeStyle(2, supply ? 0x8fd6a0 : 0x2a3a4d, supply ? 0.95 : 0.5);
      this.root.add(box);
      if (supply && this.mode === 'battle') {
        box.setInteractive({ useHandCursor: true });
        box.on('pointerdown', () => this.useSupply(i));
        this.attachTooltip(box, supply.name, `${supply.description} (click to use)`);
        this.root.add(this.add.text(x - 66, y - 9, supply.name, {
          fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#dffaeb', wordWrap: { width: 120 }
        }));
        this.root.add(this.add.text(x + 66, y + 12, 'use', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#8fd6a0' }).setOrigin(1, 0.5));
      } else {
        this.root.add(this.add.text(x, y, 'empty', { fontFamily: 'Arial', fontSize: '10px', color: '#566778' }).setOrigin(0.5));
      }
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
      case 'economy': return 'Routecraft';
      case 'suit': return 'Suit Engine';
      case 'molt': return 'Molt';
      case 'bossPrep': return 'Boss';
      default: return mark.family;
    }
  }

  private waymarkTooltip(mark: RuntimeRouteMark) {
    return `${this.waymarkFamilyLabel(mark)} / ${mark.rarity}\n${mark.description}\n${mark.trigger} -> ${mark.effect}${mark.flavorText ? `\n${mark.flavorText}` : ''}`;
  }

  private renderWaymarkIconButton(mark: RuntimeRouteMark, x: number, y: number, size: number, onClick?: () => void) {
    const accent = this.waymarkAccent(mark);
    const artAsset = waymarkArtAssets[mark.id];
    this.root.add(this.add.rectangle(x, y, size, size, 0x07101c, 0.97).setStrokeStyle(2, accent, 0.95));
    if (artAsset && this.textures.exists(artAsset.key)) {
      this.root.add(this.add.image(x, y, artAsset.key).setDisplaySize(size - 8, size - 8));
    } else {
      this.root.add(this.add.text(x, y - 1, waymarkGlyph(mark), {
        fontFamily: 'Arial', fontSize: `${Math.round(size * 0.48)}px`, fontStyle: 'bold', color: '#e7eef7'
      }).setOrigin(0.5));
    }
    const hitbox = this.add.rectangle(x, y, size, size, 0x000000, 0.001)
      .setInteractive({ useHandCursor: Boolean(onClick) });
    if (onClick) hitbox.on('pointerdown', onClick);
    this.attachTooltip(hitbox, mark.name, this.waymarkTooltip(mark));
    this.root.add(hitbox);
  }

  private renderWaymarkShelf() {
    const marks = this.ownedMarkDefs();
    this.root.add(this.add.text(30, 246, 'WAYMARKS', {
      fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#7f93a8'
    }));

    if (marks.length === 0) {
      const empty = this.add.rectangle(98, 280, 152, 44, 0x0b1018, 0.5)
        .setStrokeStyle(2, 0x2a3a4d, 0.5)
        .setInteractive({ useHandCursor: true });
      empty.on('pointerdown', () => { this.waymarkDrawerOpen = true; this.renderAll(); });
      this.attachTooltip(empty, 'Waymarks', 'Found artifact items will appear here.');
      this.root.add(empty);
      this.root.add(this.add.text(98, 280, 'none found', { fontFamily: 'Arial', fontSize: '10px', color: '#566778' }).setOrigin(0.5));
      return;
    }

    const visibleCount = marks.length > 4 ? 3 : 4;
    const visible = marks.slice(0, visibleCount);
    visible.forEach((mark, index) => {
      const x = 54 + (index % 2) * 58;
      const y = 280 + Math.floor(index / 2) * 58;
      this.renderWaymarkIconButton(mark, x, y, 48, () => {
        this.waymarkDrawerOpen = true;
        this.inspectOverlay = undefined;
        this.logDrawerOpen = false;
        this.renderAll();
      });
    });

    if (marks.length > visible.length) {
      const more = this.add.rectangle(112, 338, 48, 48, 0x0d1420, 0.97)
        .setStrokeStyle(2, 0xc9a6ff, 0.95)
        .setInteractive({ useHandCursor: true });
      more.on('pointerdown', () => { this.waymarkDrawerOpen = true; this.renderAll(); });
      this.attachTooltip(more, 'More Waymarks', `${marks.length - visible.length} more found artifact items. Click to inspect all.`);
      this.root.add(more);
      this.root.add(this.add.text(112, 338, `+${marks.length - visible.length}`, {
        fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: '#d9c8ff'
      }).setOrigin(0.5));
    }
  }

  private renderWaymarkDrawer() {
    const marks = this.ownedMarkDefs();
    const w = 620;
    const h = 392;
    const left = 176;
    const top = 112;
    this.root.add(this.add.rectangle(left + w / 2, top + h / 2, w, h, 0x07101c, 0.985).setStrokeStyle(2, 0xc9a6ff, 0.95));
    this.root.add(this.add.text(left + 22, top + 18, 'Found Waymarks', {
      fontFamily: 'Arial', fontSize: '22px', fontStyle: 'bold', color: '#ffe1a3'
    }));
    this.root.add(this.add.text(left + 24, top + 48, `${marks.length} artifact item${marks.length === 1 ? '' : 's'} carried this run`, {
      fontFamily: 'Arial', fontSize: '12px', color: '#9fb1c4'
    }));

    const close = this.add.rectangle(left + w - 28, top + 26, 32, 30, 0x2a1a1c, 0.96)
      .setStrokeStyle(1, 0xff6b57, 0.9)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => { this.waymarkDrawerOpen = false; this.renderAll(); });
    this.root.add(close);
    this.root.add(this.add.text(left + w - 28, top + 26, 'X', {
      fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: '#ffd5cc'
    }).setOrigin(0.5));

    if (marks.length === 0) {
      this.root.add(this.add.text(left + 24, top + 112, 'No Waymarks found yet. Signals, Caches, Rival Crews, Markets, and bosses can add them.', {
        fontFamily: 'Arial', fontSize: '15px', color: '#cdd9e6', wordWrap: { width: w - 48 }
      }));
      return;
    }

    marks.forEach((mark, index) => {
      const col = index % 8;
      const row = Math.floor(index / 8);
      const x = left + 48 + col * 68;
      const y = top + 108 + row * 64;
      this.renderWaymarkIconButton(mark, x, y, 52);
      this.root.add(this.add.text(x, y + 33, mark.name, {
        fontFamily: 'Arial', fontSize: '9px', fontStyle: 'bold', color: '#cdd9e6',
        align: 'center', wordWrap: { width: 64 }
      }).setOrigin(0.5, 0));
    });
  }

  private useSupply(index: number) {
    if (this.mode !== 'battle') return;
    const id = this.runSupplies[index];
    const supply = id ? alphaSupplyLibrary.get(id) : undefined;
    if (!supply) return;
    supply.effects.forEach((effect) => this.applySupplyEffect(effect));
    this.runSupplies.splice(index, 1);
    this.runSuppliesUsed.push(id);
    this.logEvent(`Used ${supply.name}.`);
    this.renderAll();
  }

  private applySupplyEffect(effect: string) {
    const parsed = parseEffect(effect);
    if (!parsed) return;
    const n = Number(parsed.args[0]) || 0;
    switch (parsed.name) {
      case 'healCohesion': case 'heal': this.flock.hp = Math.min(this.flock.maxHp, this.flock.hp + n); break;
      case 'gainResonance': this.spark = Math.min(5, this.spark + n); break;
      case 'draw': this.drawCards(n); break;
      case 'gainCover': this.flock.block += n; break;
      case 'gainWingbeat': this.energy += n; break;
      case 'reduceNextOpenSky': case 'gainOpenSkyGuard': this.flock.openSkyGuard += n; break;
      default: break;
    }
  }

  private renderLogDrawer() {
    const w = 460;
    const h = 320;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.root.add(this.add.rectangle(cx, cy, w, h, 0x0a121d, 0.97).setStrokeStyle(2, 0x49606d, 0.95));
    this.root.add(this.add.text(cx - w / 2 + 20, cy - h / 2 + 16, 'Signals — recent', {
      fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold', color: '#f5d38a'
    }));
    const close = this.add.rectangle(cx + w / 2 - 26, cy - h / 2 + 24, 30, 28, 0x2a1a1c, 0.96)
      .setStrokeStyle(1, 0xff6b57, 0.9)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => { this.logDrawerOpen = false; this.renderAll(); });
    this.root.add(close);
    this.root.add(this.add.text(cx + w / 2 - 26, cy - h / 2 + 24, 'X', { fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: '#ffd5cc' }).setOrigin(0.5));
    this.root.add(this.add.text(cx - w / 2 + 20, cy - h / 2 + 52, this.log.slice(-12).reverse(), {
      fontFamily: 'Arial', fontSize: '14px', color: '#cdd9e6', lineSpacing: 7, wordWrap: { width: w - 40 }
    }));
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
      fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#7f93a8'
    }).setOrigin(0.5));
    const labels = entries.map(([label, rank]) => `${label}: ${rank}`);
    const widths = labels.map((label) => label.length * 8 + 22);
    let sx = GAME_WIDTH / 2 - widths.reduce((a, b) => a + b, 0) / 2;
    entries.forEach(([label, rank], index) => {
      this.root.add(this.add.text(sx, y, `${label}: ${rank}`, {
        fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: tone(rank)
      }).setOrigin(0, 0.5));
      sx += widths[index];
    });
  }

  private renderCardReward() {
    this.queueCardArtLoad(this.rewardChoices);
    this.renderRewardBackdrop('Add to the Flock', 'Choose one new crew card — or skip for Scrap.');
    this.renderDeckNeeds(182);
    this.rewardChoices.forEach((card, index) => {
      this.renderChoiceCard(card, 336 + index * 304, 402, () => this.chooseRewardCard(card.id));
    });
    const skip = this.add.rectangle(GAME_WIDTH / 2, 652, 324, 48, 0x2a2320, 0.96)
      .setStrokeStyle(2, 0xd8a840, 0.9)
      .setInteractive({ useHandCursor: true });
    skip.on('pointerdown', () => this.skipCardReward());
    this.root.add(skip);
    this.root.add(this.add.text(GAME_WIDTH / 2, 652, `Skip - take +${REWARD_SKIP_SCRAP} Scrap`, {
      fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: '#ffe1a3'
    }).setOrigin(0.5));
  }

  private renderUpgradeReward() {
    this.queueCardArtLoad(this.upgradeChoices);
    this.renderRewardBackdrop('Preen a Card', 'Choose one owned crew card to improve.');
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
      fontFamily: 'Arial',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#8df4ff'
    }).setOrigin(0.5));
    this.root.add(this.add.text(GAME_WIDTH / 2, 92, title, {
      fontFamily: 'Arial',
      fontSize: '42px',
      fontStyle: 'bold',
      color: '#ffe1a3',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5));
    this.root.add(this.add.text(GAME_WIDTH / 2, 136, subtitle, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#b9c7d6'
    }).setOrigin(0.5));
  }

  private renderChoiceCard(card: Card, x: number, y: number, onClick: () => void) {
    const cardW = 220;
    const cardH = 294;
    const rect = this.add.rectangle(x, y, cardW, cardH, 0x161b27, 0.98)
      .setStrokeStyle(3, card.upgraded ? 0x24d0d6 : card.type === 'major' ? 0xd8a840 : 0x7ab8d6, 1)
      .setInteractive({ useHandCursor: true });
    rect.on('pointerdown', onClick);
    rect.on('pointerover', () => this.showChoiceCardDetail(card, x, y));
    rect.on('pointerout', () => this.hideCardPreview());
    this.root.add(rect);
    this.renderChoiceCardArt(card, x, y);

    this.root.add(this.add.circle(x - 88, y - 124, 17, card.cost === 0 ? 0x24d0d6 : 0xd8a840, 1));
    this.root.add(this.add.text(x - 88, y - 124, `${card.cost}`, {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#07101c'
    }).setOrigin(0.5));

    this.root.add(this.add.rectangle(x, y - 74, cardW - 8, 94, 0x05080e, 0.82));
    this.root.add(this.add.text(x - 86, y - 108, displayName(card), {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffe1a3',
      wordWrap: { width: 170 },
      maxLines: 2
    }));
    this.root.add(this.add.text(x - 86, y - 50, card.bird, {
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#91a6b8',
      wordWrap: { width: 170 },
      maxLines: 1
    }));
    this.root.add(this.add.rectangle(x, y + 62, cardW - 8, 126, 0x05080e, 0.86));
    this.root.add(this.add.text(x - 86, y + 8, displayText(card), {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#dce8f2',
      lineSpacing: 1,
      wordWrap: { width: 170 },
      maxLines: 4
    }));
    this.root.add(this.add.text(x - 86, y + 114, cardLabel(card), {
      fontFamily: 'Arial',
      fontSize: '12px',
      fontStyle: 'bold',
      color: card.type === 'major' ? '#d8a840' : '#7f93a8'
    }));
    const needTags = this.cardNeedTags(card);
    if (needTags.length > 0) {
      this.root.add(this.add.text(x - 86, y + 132, needTags.join('  /  '), {
        fontFamily: 'Arial',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffcf6b',
        wordWrap: { width: 170 },
        maxLines: 2
      }));
    }
  }

  private showChoiceCardDetail(card: Card, anchorX: number, anchorY: number) {
    this.hideCardPreview();
    const detail = renderFloatingCardDetail(this, card, card.upgraded ? 'Preen choice' : 'Reward choice', card.cost, anchorX, anchorY);
    this.fxLayer.add(detail);
    this.cardPreview = detail;
  }

  private renderChoiceCardArt(card: Card, x: number, y: number) {
    const key = cardArtKey(card);
    if (!key || !this.textures.exists(key)) return;

    const art = this.add.image(x, y, key)
      .setDisplaySize(216, 288)
      .setAlpha(0.95);
    this.root.add(art);
    this.root.add(this.add.rectangle(x, y, 216, 288, 0x05101a, 0.36));
  }

  private openOverlay(overlay: InspectOverlay) {
    this.inspectOverlay = overlay;
    this.selectedInstanceId = undefined;
    this.inspectedCardId = undefined;
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

    const frame = renderFieldPanel(this, (obj) => this.root.add(obj), GAME_WIDTH / 2, GAME_HEIGHT / 2, 1060, 570, {
      accent: overlay === 'flock' ? UI_FIELD.cyan : UI_FIELD.gold
    });
    renderCloseControl(this, (obj) => this.root.add(obj), frame.right - 76, frame.top + 56, () => this.closeOverlay());

    if (overlay === 'flock') {
      this.renderFlockStatsOverlay();
      return;
    }

    const cards = overlay === 'deck'
      ? this.deckReviewCards()
      : overlay === 'draw'
        ? this.drawPile.map((card) => ({ card, zone: 'Deck' }))
        : this.discardPile.map((card) => ({ card, zone: 'Discard' }));
    const title = overlay === 'deck' ? `Deck Review (${this.allDeckCards().length})` : `Discard (${cards.length})`;
    this.renderCardReviewOverlay(title, cards);
  }

  private renderCardReviewOverlay(title: string, cards: Array<{ card: Card; zone: string }>) {
    this.root.add(this.add.text(140, 86, title, {
      fontFamily: 'Arial',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffe1a3'
    }));

    this.root.add(this.add.text(140, 126, `Draw ${this.drawPile.length} / Hand ${this.hand.length} / Discard ${this.discardPile.length}`, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#b9c7d6'
    }));

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
        fontFamily: 'Arial',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#07101c'
      }).setOrigin(0.5));
      this.root.add(this.add.text(x + 36, y + 5, displayName(card), {
        fontFamily: 'Arial',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffe1a3',
        wordWrap: { width: 170 }
      }));
      this.root.add(this.add.text(x + 222, y + 6, `${cardLabel(card)} / ${zone}`, {
        fontFamily: 'Arial',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#7ab8d6'
      }));
    });

    this.renderCardReviewScrollButton(472, 214, 'Up', this.cardReviewScroll > 0, () => this.scrollCardReview(-1));
    this.renderCardReviewScrollButton(
      472,
      610,
      'Down',
      this.cardReviewScroll < Math.max(0, sorted.length - CARD_REVIEW_VISIBLE_ROWS),
      () => this.scrollCardReview(1)
    );
    this.root.add(this.add.text(424, 632, `${this.cardReviewScroll + 1}-${this.cardReviewScroll + Math.min(CARD_REVIEW_VISIBLE_ROWS, sorted.length - this.cardReviewScroll)} / ${sorted.length}`, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#91a6b8'
    }));

    if (selectedEntry) {
      this.renderCardDetailPanel(selectedEntry.card, selectedEntry.zone);
    } else {
      this.root.add(this.add.text(662, 190, 'Select a card to examine it.', {
        fontFamily: 'Arial',
        fontSize: '20px',
        fontStyle: 'bold',
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
        ? this.drawPile.map((card) => ({ card, zone: 'Deck' }))
        : this.discardPile.map((card) => ({ card, zone: 'Discard' }));
    this.cardReviewScroll = clamp(this.cardReviewScroll + delta, 0, Math.max(0, cards.length - CARD_REVIEW_VISIBLE_ROWS));
    this.renderAll();
  }

  private renderCardReviewScrollButton(x: number, y: number, label: string, enabled: boolean, onClick: () => void) {
    renderFieldButton(this, (obj) => this.root.add(obj), x, y, 72, 28, label, enabled, onClick, UI_FIELD.gold);
  }

  private getInspectedCardEntry(cards: Array<{ card: Card; zone: string }>) {
    return cards.find(({ card }) => card.id === this.inspectedCardId) ?? cards[0];
  }

  private renderCardDetailPanel(card: Card, zone: string) {
    const accent = card.upgraded ? 0x24d0d6 : card.type === 'major' ? 0xd8a840 : 0x7ab8d6;
    const contract = this.activeCardContract(card);
    renderFieldPanel(this, (obj) => this.root.add(obj), 842, 360, 590, 430, { accent, fill: UI_FIELD.ink });

    this.renderDetailCardArt(card);

    this.root.add(this.add.circle(542, 176, 18, this.effectiveCost(card) === 0 ? 0x24d0d6 : 0xd8a840, 1));
    this.root.add(this.add.text(542, 176, `${this.effectiveCost(card)}`, {
      fontFamily: 'Arial',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#07101c'
    }).setOrigin(0.5));

    this.root.add(this.add.text(840, 164, displayName(card), {
      fontFamily: 'Arial',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#ffe1a3',
      wordWrap: { width: 270 }
    }));
    this.root.add(this.add.text(840, 214, `${card.bird} / ${cardLabel(card)} / ${zone}`, {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#7ab8d6',
      wordWrap: { width: 270 }
    }));
    this.root.add(this.add.text(840, 242, `Target: ${targetLabel(contract.target)}  Role: ${card.role.toUpperCase()}`, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: contract.usesMolt ? '#ffc78f' : '#b9c7d6'
    }));

    this.root.add(this.add.text(840, 292, contract.usesMolt ? 'Current Effect (Molt)' : 'Current Effect', detailHeaderStyle()));
    this.root.add(this.add.text(840, 318, contract.text, detailBodyStyle(270)));

    this.root.add(this.add.text(840, 398, contract.usesMolt ? 'Normal Effect' : 'Preened Effect', detailHeaderStyle()));
    this.root.add(this.add.text(840, 424, contract.usesMolt ? displayText(card) : card.upgraded ? 'Already preened.' : card.upgradedText, detailBodyStyle(270)));

    this.root.add(this.add.text(840, 504, 'Flock Stats', detailHeaderStyle()));
    const stats = cardStatRows(card);
    this.root.add(this.add.text(840, 530, stats.length > 0 ? stats.join('   ') : 'None', {
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      color: stats.length > 0 ? '#8df4ff' : '#91a6b8',
      wordWrap: { width: 270 }
    }));
  }

  private renderDetailCardArt(card: Card) {
    const key = cardArtKey(card);
    if (!key || !this.textures.exists(key)) {
      this.root.add(this.add.rectangle(660, 382, 250, 375, 0x141f2f, 0.95)
        .setStrokeStyle(1, 0x49606d, 0.8));
      this.root.add(this.add.text(660, 382, cardLabel(card), {
        fontFamily: 'Arial',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#7ab8d6',
        wordWrap: { width: 190 },
        align: 'center'
      }).setOrigin(0.5));
      return;
    }

    const art = this.add.image(660, 382, key)
      .setDisplaySize(250, 375)
      .setAlpha(0.92);
    this.root.add(art);
  }

  private renderFlockStatsOverlay() {
    this.root.add(this.add.text(140, 86, 'Flock Stats', {
      fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#ffe1a3'
    }));
    this.root.add(this.add.text(140, 126, 'Base values plus passive stats from owned cards.', {
      fontFamily: 'Arial', fontSize: '16px', color: '#b9c7d6'
    }));
    renderFlockStatTable(this, (obj) => this.root.add(obj), this.flockStatRows(), 140, 168);
    this.root.add(this.add.text(140, 558, 'Flock Stats update when cards join, leave, or are preened.', {
      fontFamily: 'Arial', fontSize: '15px', color: '#91a6b8'
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
      fontFamily: 'Georgia, serif', fontSize: '44px', fontStyle: 'bold',
      color: win ? '#ffe1a3' : '#ffb2a4', stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5));
    this.root.add(this.add.text(cx, 212, win
      ? 'The flyway is restored — every district answers to the flock.'
      : `Scattered at ${currentMap().name}${killedBy ? ` by ${killedBy}` : ''}.`, {
      fontFamily: 'Arial', fontSize: '16px', color: '#b9c7d6', align: 'center', wordWrap: { width: 540 }
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
        fontFamily: 'Arial', fontSize: '16px', color: '#8fa3b6'
      }).setOrigin(0, 0.5));
      this.root.add(this.add.text(cx + 250, ry, row[1], {
        fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: '#eaf1f8'
      }).setOrigin(1, 0.5));
    });

    const rewards = this.lastRunRewards;
    if (rewards && (rewards.newLeaders.length || rewards.newAchievements.length)) {
      const parts: string[] = [];
      if (rewards.newLeaders.length) parts.push(`New Leader — ${rewards.newLeaders.map((id) => getLeader(id).name).join(', ')}`);
      if (rewards.newAchievements.length) parts.push(`Achievement — ${rewards.newAchievements.map((id) => achievements.find((a) => a.id === id)?.name ?? id).join(', ')}`);
      this.root.add(this.add.text(cx, 240, `★ ${parts.join('    ·    ')}`, {
        fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: '#ffe07a', align: 'center', wordWrap: { width: 540 }
      }).setOrigin(0.5));
    }

    const runBack = this.add.rectangle(cx - 130, 552, 236, 52, 0x122235, 0.98)
      .setStrokeStyle(2, 0xd8a840, 1).setInteractive({ useHandCursor: true });
    runBack.on('pointerdown', () => this.scene.start('RouteScene'));
    this.root.add(runBack);
    this.root.add(this.add.text(cx - 130, 552, 'Run It Back', {
      fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#ffe1a3'
    }).setOrigin(0.5));

    const toMenu = this.add.rectangle(cx + 130, 552, 236, 52, 0x141d2b, 0.98)
      .setStrokeStyle(2, 0x7ab8d6, 0.95).setInteractive({ useHandCursor: true });
    toMenu.on('pointerdown', () => this.scene.start('MenuScene'));
    this.root.add(toMenu);
    this.root.add(this.add.text(cx + 130, 552, 'Main Menu', {
      fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#dbe6f0'
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
    this.renderAll();
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
    this.playCardCastFx(playedCard, enemyId, handIndexBeforePlay, handSizeBeforePlay, contract);

    const outcome = this.resolveCardEffects(playedCard, enemyId, contract);
    if (playedCard.runtime.suit) {
      this.playedSuitsThisTurn.add(playedCard.runtime.suit);
      this.triggerFledglingSuitRally(playedCard);
    }
    this.playedCardIdsThisCombat.add(playedCard.id);
    this.checkNthCardMarks(); // rooftop_shortcut-style Waymarks that trigger on the Nth card

    // (Molt is now a whole-turn transform stance — it no longer breaks on the
    // next card. It ends in endTurn, leaving the flock briefly Open Sky.)

    // A snag like Bad Directions shuffles itself back into the draw pile instead
    // of discarding, so it keeps clogging the hand until removed at a deck node.
    if (outcome.returnSelfToDraw) this.addCardToDrawRandom(playedCard);
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
    const key = cardArtKey(card);
    if (key && this.textures.exists(key)) {
      c.add(this.add.image(0, 0, key).setDisplaySize(CARD_W - 6, CARD_H - 6));
    } else {
      c.add(this.add.rectangle(0, 0, CARD_W - 6, CARD_H - 6, 0x141d2b, 0.96));
    }
    c.add(this.add.rectangle(0, -CARD_H / 2 + 16, CARD_W - 6, 26, 0x05080e, 0.72));
    c.add(this.add.text(-CARD_W / 2 + 34, -CARD_H / 2 + 8, displayName(card), {
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffe7b0',
      wordWrap: { width: CARD_W - 44 },
    }));
    c.add(this.add.circle(-CARD_W / 2 + 16, -CARD_H / 2 + 16, 14, this.effectiveCost(card) === 0 ? 0x24d0d6 : 0xe8b830, 1)
      .setStrokeStyle(2, 0x05080e, 0.9));
    c.add(this.add.text(-CARD_W / 2 + 16, -CARD_H / 2 + 16, `${this.effectiveCost(card)}`, {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
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
    const state: EffectResolutionState = { previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false };
    for (const effect of effects) {
      this.resolveCardEffect(effect, card, enemyId, state);
    }
    return state;
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
        state.previousDamageDefeated = this.damageEnemy(enemyId, value, displayName(card), card);
        this.buildFlow(state);
        break;
      case 'damagePierce':
        state.previousDamageDefeated = this.damageEnemy(enemyId, value, displayName(card), card, true);
        this.buildFlow(state);
        break;
      case 'damageAll':
        state.previousDamageDefeated = false;
        this.enemies
          .filter((enemy) => enemy.hp > 0)
          .forEach((enemy) => {
            if (this.damageEnemy(enemy.id, value, displayName(card), card)) state.previousDamageDefeated = true;
          });
        this.buildFlow(state);
        break;
      case 'gainCover':
        this.gainBlock(value, displayName(card), card);
        this.buildFlow(state);
        break;
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
          state.previousDamageDefeated = this.damageEnemy(enemyId, burst, displayName(card), card);
          this.logEvent(`${displayName(card)} releases ${spent} Resonance for ${burst} damage.`);
          const rbView = this.enemyView(this.getEnemy(enemyId));
          floatingText(this, this.fxLayer, rbView.x, rbView.y - 90, 'Resonance Burst!', '#8df4ff');
          this.sparkBurst(rbView.x, rbView.y - 22, 0x8df4ff, 30, 210);
        }
        this.spark = 0;
        state.spentResonance = spent > 0;
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
          state.previousDamageDefeated = this.damageEnemy(enemyId, burst, displayName(card), card);
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
        const removed = Math.min(enemy.block, value);
        enemy.block -= removed;
        this.logEvent(`${displayName(card)} strips ${removed} Cover from ${enemy.name}.`);
        const rcView = this.enemyView(enemy);
        floatingText(this, this.fxLayer, rcView.x, rcView.y - 84, `-${removed} Cover`, '#8df4ff');
        this.coverImpactFx(rcView.x, rcView.y, 0x8df4ff);
        break;
      }
      case 'enterMolt':
        this.flock.molt = true;
        this.flock.exposed = false;
        this.flock.exposedTurns = 0;
        this.logEvent('The flock turns through Molt.');
        floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 30, 'Molt!', '#ff9d4d');
        burst(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y, 0xff9d4d, 10);
        break;
      case 'gainOpenSkyGuard':
        this.flock.openSkyGuard += value;
        this.logEvent(`Open Sky Guard rises by ${value}.`);
        break;
      case 'returnDiscard':
        this.returnDiscardToHand();
        break;
      case 'nextCoverBonus':
        this.pendingNestCoverBonus += value;
        this.logEvent(`Next Nest Cover gains +${value}.`);
        break;
      case 'nextTurnDraw':
        this.nextTurnDrawBonus += value;
        this.logEvent(`Next turn draw gains +${value}.`);
        break;
      case 'gainEnergyNextTurn':
        this.nextTurnEnergyBonus += value;
        this.logEvent(`${displayName(card)} banks +${value} Wingbeat for next turn.`);
        break;
      case 'shuffleSelfToDraw':
        state.returnSelfToDraw = true;
        this.logEvent(`${displayName(card)} tangles back into the draw pile.`);
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
    if (condition === 'targetBelowHalf') return enemy ? enemy.hp <= enemy.maxHp / 2 : false;
    if (condition === 'targetIntendsAttack') return enemy ? moveDealsDamage(currentMove(enemy)) : false;
    if (condition === 'targetHasCover') return enemy ? enemy.block > 0 : false;
    if (condition === 'targetWinded') return enemy ? enemy.weak > 0 : false;
    const windedAtLeast = condition.match(/^windedAtLeast\((\d+)\)$/);
    if (windedAtLeast) return enemy ? enemy.weak >= Number(windedAtLeast[1]) : false; // rewards stacking Winded
    if (condition === 'hasResonance') return this.spark > 0;
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
    this.logEvent('Perfect Brace: the flock gains +1 Flow.');
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

  private damageEnemy(enemyId: string, amount: number, source: string, card?: Card, pierceCover = false) {
    const enemy = this.getLivingEnemy(enemyId);
    if (!enemy) return false;
    let damage = amount + (this.flockStats().damage ?? 0);
    if (this.flock.weak > 0) damage = Math.floor(damage * 0.75);
    // Formation state: Surging birds press harder, Scattered birds flail.
    const formation = this.flockState();
    if (formation === 'surging') damage += 2;
    else if (formation === 'scattered') damage = Math.max(0, Math.floor(damage * 0.75));
    // Quills keystone: the first attack each turn lands +2.
    if (this.firstAttackThisTurn && this.keystoneActive('quills')) damage += 2;
    this.firstAttackThisTurn = false;
    const blocked = pierceCover ? 0 : Math.min(enemy.block, damage);
    if (!pierceCover) {
      enemy.block -= blocked;
      damage -= blocked;
    }
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
    let block = amount + (this.flockStats().cover ?? 0);
    if (card?.runtime.suit === 'nests' && this.pendingNestCoverBonus > 0) {
      block += this.pendingNestCoverBonus;
      this.pendingNestCoverBonus = 0;
    }
    const formation = this.flockState();
    if (formation === 'surging') block += 2;
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
    return true;
  }

  private endTurn() {
    if (this.mode !== 'battle') {
      return;
    }

    while (this.hand.length > 0) {
      const card = this.hand.pop();
      if (card) this.discardPile.push(card);
    }
    this.selectedInstanceId = undefined;
    // Molting is a one-turn transform stance: it ends now, leaving the flock
    // briefly Open Sky (the cost of shedding into Molt) for the enemy's swing.
    if (this.flock.molt) {
      this.flock.molt = false;
      this.flock.exposed = true;
      this.flock.exposedTurns = 1;
      this.logEvent('The flock sheds out of Molt — Open Sky.');
    }
    this.resolveEnemyTurn();
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
    this.firstAttackThisTurn = true;
    this.playedSuitsThisTurn = new Set();
    if (this.flock.frail > 0) this.flock.frail -= 1;
    if (this.flock.weak > 0) this.flock.weak -= 1;
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

  private resolveEnemyTurn() {
    const attackers = this.enemies.filter((candidate) => candidate.hp > 0);
    if (attackers.length === 0) return;

    banner(this, this.fxLayer, GAME_WIDTH / 2, 140, 'Enemy Turn', '#ff9d6b');
    this.enemies.forEach((enemy) => { enemy.block = 0; });

    // Each living enemy telegraphs and resolves its own move, in board order.
    for (const enemy of attackers) {
      if (enemy.hp <= 0 || this.flock.hp <= 0) continue;
      enemyMoveContext = { flock: this.flock, turn: this.turn }; // branch on live state per attacker
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
        enemy.block += value;
        this.logEvent(`${enemy.name} ducks into ${value} Cover.`);
        {
          const view = this.enemyView(enemy);
          this.coverImpactFx(view.x, view.y, 0x7ab8d6);
          floatingText(this, this.fxLayer, view.x, view.y - 74, `+${value} Cover`, '#7ab8d6');
        }
        break;
      case 'heal':
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + value);
        this.logEvent(`${enemy.name} scavenges ${value} health.`);
        {
          const view = this.enemyView(enemy);
          this.pulseRing(view.x, view.y - 12, 0x8fd6a0, 58, 440);
          this.sparkBurst(view.x, view.y - 12, 0x8fd6a0, 10, 95);
        }
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
      case 'addSnagToDiscard': {
        const snagId = parsed.args[0];
        if (snagId && cardLibrary[snagId]) {
          this.discardPile.push(cloneCard(snagId));
          this.logEvent(`${enemy.name} tangles the route — ${cardLibrary[snagId].runtime.displayName} drops into your discard.`);
        }
        break;
      }
      case 'addSnagToDraw': {
        const snagId = parsed.args[0];
        if (snagId && cardLibrary[snagId]) {
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
  private checkEnemyCondition(condition: string, enemy: Enemy) {
    return evaluateEnemyCondition(condition, enemy, this.flock, this.turn);
  }

  private incomingAttackDamage(enemy: Enemy) {
    // Incoming damage is the sum of the current move's damage(flock, N) effects.
    return currentMove(enemy).effects.reduce((total, effect) => {
      const parsed = parseEffect(effect);
      if (!parsed || parsed.name !== 'damage') return total;
      return total + parseEffectValue(parsed.args[1] ?? parsed.args[0], 0) + enemy.nextAttackBonus;
    }, 0);
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
    let damage = amount + enemy.nextAttackBonus + mods.enemyDamageBonus;
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
    this.runRewardEvents.push({ offered: this.rewardChoices.map((card) => card.id), skipped: true, fallback: 'scrap' });
    this.scrap += REWARD_SKIP_SCRAP;
    this.logEvent(`Skipped the card reward for +${REWARD_SKIP_SCRAP} Scrap.`);
    this.rewardChoices = [];
    this.resolvePostCardReward();
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
      this.applyMapStartMarks(); // reopened_roofline-style Waymarks stock the next district
      const advanceState = this.createRouteReturnState(completedNodeId);
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
    this.flock.block = 0;
    this.flock.molt = false;
    this.flock.exposed = false;
    this.flock.exposedTurns = 0;
    this.flock.frail = 0;
    this.flock.weak = 0;
    this.flock.openSkyGuard = this.flockStats().openSkyGuard ?? 0;
    this.applyFlockStats(false);

    const routeNode = currentCombatNodes()[this.currentRouteIndex];
    const scrapReward = combatScrapReward(routeNode);
    const streetBonus = routeNode?.type === 'street' ? this.markValue('afterStreetEncounter', 'gainScrap') : 0;
    this.scrap += scrapReward + streetBonus;

    const awardedMark = this.combatRouteMarkReward(routeNode);
    if (awardedMark && !this.routeMarks.includes(awardedMark.id)) {
      this.routeMarks.push(awardedMark.id);
    }

    const routeLog = [
      `${currentMap().name}: ${routeNode?.label ?? 'Encounter'} cleared. +${scrapReward + streetBonus} Scrap.`,
      ...(awardedMark ? [`${awardedMark.name} Waymark claimed.`] : []),
      ...this.log.slice(-3)
    ];

    return {
      deck: saveCards(this.allDeckCards()),
      leaderId: this.runLeaderId,
      difficulty: this.runDifficulty,
      seed: activeSeed,
      currentHp: Math.min(this.flock.maxHp, this.flock.hp + 3),
      scrap: this.scrap,
      routeMarks: [...this.routeMarks],
      supplies: [...this.runSupplies],
      mapIndex: activeMapIndex,
      completedRouteNodeIds: [...this.completedRouteNodeIds],
      currentRouteNodeId: completedNodeId,
      routeLog,
      nextCombat: undefined,
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

  private currentCombatResult(routeNode: RouteNode | undefined, nodeId: string): CombatResultSummary {
    return {
      encounterId: routeNode?.payloadId ?? '',
      nodeId,
      nodeType: routeNode?.type ?? 'street',
      enemyIds: this.enemies.map((enemy) => enemy.runtime.id),
      turnsTaken: this.turn,
      damageDealt: this.statDealt,
      cohesionLost: this.statTaken,
      killedByMove: this.flock.hp <= 0 ? this.enemies.find((enemy) => enemy.hp > 0)?.name : undefined
    };
  }

  private combatRouteMarkReward(routeNode: RouteNode | undefined) {
    if (!routeNode) return undefined;
    const profile = rewardProfileForRouteNode(routeNode);
    const guaranteed = routeNode.type === 'rival' || routeNode.type === 'boss' || profile?.routeMarkGuaranteed;
    const chance = profile?.routeMarkChance ?? 0;
    const rolled = chance > 0 && deterministicChance(`${activeSeed}:${routeNode.id}:route-mark`, chance);
    if (!guaranteed && !rolled) return undefined;
    return routeMarks.find((mark) => !this.routeMarks.includes(mark.id));
  }

  private drawToHandSize() {
    const plumesKeystone = this.keystoneActive('plumes') ? 1 : 0; // Plumes keystone: +1 hand size
    this.drawCards(Math.max(0, 5 + plumesKeystone + (this.flockStats().draw ?? 0) + this.nextTurnDrawBonus - this.hand.length));
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

  private returnDiscardToHand() {
    const index = this.discardPile.findIndex((card) => card.type !== 'molt');
    if (index < 0) {
      this.logEvent('No route memory is ready to return.');
      return;
    }
    const [card] = this.discardPile.splice(index, 1);
    this.hand.push(card);
    this.logEvent(`${displayName(card)} returns from discard.`);
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
        this.rewardChoices = this.createRewardChoices();
        if (this.rewardChoices.length > 0) {
          this.mode = 'cardReward';
        } else {
          this.logEvent('No new crew cards remain.');
          this.resolvePostCardReward();
        }
      }
      this.logEvent('The rooftop is clear.');
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
      combatResults
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
          target: card.target,
          activeTarget: contract.target,
          activeText: contract.text,
          usesMolt: contract.usesMolt
        };
      }),
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
      target: entry.card.target,
      activeTarget: contract.target,
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
  const totalById = new Map<string, number>();
  runtimes.forEach((r) => totalById.set(r.id, (totalById.get(r.id) ?? 0) + 1));
  const seenById = new Map<string, number>();
  return runtimes.map((runtime) => {
    const seen = seenById.get(runtime.id) ?? 0;
    seenById.set(runtime.id, seen + 1);
    const duplicated = (totalById.get(runtime.id) ?? 1) > 1;
    return {
      id: duplicated ? `${runtime.id}#${seen}` : runtime.id,
      name: duplicated ? `${runtime.name} ${String.fromCharCode(65 + seen)}` : runtime.name,
      hp: runtime.health,
      maxHp: runtime.health,
      block: 0,
      weak: 0,
      intentIndex: 0,
      hitThisTurn: false,
      nextAttackBonus: 0,
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
    return /\b(?:gainCover|heal|overhealCover|loseCohesion|draw|discard|discardUpTo|gainWingbeat|loseWingbeat|gainResonance|spendResonance|enterMolt|gainOpenSkyGuard|returnDiscard|nextCoverBonus|nextTurnDraw|gainEnergyNextTurn|shuffleSelfToDraw)\(/.test(body);
  });
}

function inferActiveTarget(baseTarget: TargetType, effects: string[]): TargetType {
  if (effectsNeedEnemyTarget(effects)) return 'enemy';
  if (effectsHitAllEnemies(effects)) return 'allEnemies';
  if (baseTarget === 'choice') return 'choice';
  if (effectsOnlyAffectFlock(effects)) return baseTarget === 'none' ? 'none' : 'self';
  return baseTarget;
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
    usesMolt,
    label: usesMolt ? 'Molt' : 'Normal',
  };
}

const STATUS_TOOLTIPS: Record<string, string> = {
  winded: "Winded reduces the flock's attack output and ticks down each turn.",
  openSky: 'Open Sky increases incoming damage until it ticks down.',
  openSkyGuard: 'Open Sky Guard cancels Open Sky damage increases — one per point.',
  molt: 'Molt: while in this stance, every card plays its alternate Molt ability instead of its normal effect. Ends your turn Open Sky.',
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
  if (flock.exposed) entries.push({ id: 'openSky', label: 'Open Sky', kind: kindOf('openSky') });
  if (flock.frail > 0) entries.push({ id: 'ruffled', label: `Ruffled ${flock.frail}`, kind: 'debuff' });
  if (flock.molt) entries.push({ id: 'molt', label: 'Molt', kind: kindOf('molt') });
  if (flock.openSkyGuard > 0) entries.push({ id: 'openSkyGuard', label: `Open Sky Guard ${flock.openSkyGuard}`, kind: kindOf('openSkyGuard') });
  return entries.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'debuff' ? -1 : 1));
}

// Board placement for enemy `index` of `count`. One enemy keeps the classic
// anchor (ENEMY_FX_X/Y, full size); 2-3 fan out around x=900, and 4 uses a
// compact two-row stage so HP/intent badges do not pile up in one horizontal run.
function enemyViewAt(index: number, count: number): { x: number; y: number; scale: number } {
  if (count <= 1) return { x: ENEMY_FX_X, y: ENEMY_FX_Y, scale: 1 };
  const layouts: Record<number, Array<{ x: number; y: number; scale: number }>> = {
    2: [
      { x: 760, y: ENEMY_FX_Y, scale: 0.86 },
      { x: 1040, y: ENEMY_FX_Y, scale: 0.86 },
    ],
    3: [
      { x: 690, y: 242, scale: 0.7 },
      { x: 910, y: 230, scale: 0.74 },
      { x: 1110, y: 252, scale: 0.7 },
    ],
    4: [
      { x: 705, y: 200, scale: 0.62 },
      { x: 1060, y: 200, scale: 0.62 },
      { x: 765, y: 330, scale: 0.58 },
      { x: 1115, y: 330, scale: 0.58 },
    ],
  };
  return layouts[Math.min(4, count)]?.[index] ?? layouts[4][layouts[4].length - 1];
}

function bossGoonViewAt(index: number, count: number): { x: number; y: number; scale: number } {
  const layouts: Record<number, Array<{ x: number; y: number; scale: number }>> = {
    1: [
      { x: 730, y: 300, scale: 0.66 },
    ],
    2: [
      { x: 700, y: 315, scale: 0.62 },
      { x: 1135, y: 315, scale: 0.62 },
    ],
    3: [
      { x: 680, y: 315, scale: 0.58 },
      { x: 1160, y: 315, scale: 0.58 },
      { x: 930, y: 345, scale: 0.56 },
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
  'Resonance Burst': { color: '#8df4ff', def: 'A Plumes payoff that spends all of your banked Resonance at once for a large effect.' },
  Winded: { color: '#c98bff', def: 'A Quills counter. High Winded weakens the flock’s hits but supercharges Winded-payoff cards; it ticks down over time.' },
  'Winded Burst': { color: '#c98bff', def: 'A Quills payoff that converts accumulated Winded into a burst of damage.' },
  Molt: { color: '#ff9d4d', def: 'A transform stance. While Molting, every card plays its alternate Molt ability instead of its normal effect. The turn ends Open Sky.' },
  'Open Sky': { color: '#ffe1a3', def: 'Exposed. Incoming damage is increased until it ticks down. Open Sky Guard cancels it, one point per stack.' },
  'Open Sky Guard': { color: '#cfe3a3', def: "Cancels Open Sky's damage increase — one point per stack." },
  Flow: { color: '#67d4e6', def: 'A rising meter. Holding Flow shifts the flock into stronger formations; an unblocked hit breaks it.' },
  Surge: { color: '#8df4ff', def: 'The peak formation from high Flow — the flock attacks and defends at its best.' },
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

let activeKwTooltip: Phaser.GameObjects.Container | undefined;
function hideKwTooltip() { activeKwTooltip?.destroy(true); activeKwTooltip = undefined; }
function showKwTooltip(scene: Phaser.Scene, kw: string, atX: number, atY: number) {
  hideKwTooltip();
  const def = KEYWORDS[kw];
  if (!def) return;
  const w = 248;
  const title = scene.add.text(10, 8, kw.toUpperCase(), { fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: def.color });
  const body = scene.add.text(10, 8 + title.height + 4, def.def, { fontFamily: 'Arial', fontSize: '12px', color: '#dbe6f2', lineSpacing: 2, wordWrap: { width: w - 20 } });
  const h = 8 + title.height + 4 + body.height + 10;
  const stroke = Phaser.Display.Color.HexStringToColor(def.color).color;
  const bg = scene.add.rectangle(0, 0, w, h, 0x0a1018, 0.98).setOrigin(0, 0).setStrokeStyle(2, stroke, 1);
  const c = scene.add.container(0, 0, [bg, title, body]).setDepth(99999);
  let px = atX - w / 2;
  let py = atY - h - 10;
  px = Math.max(8, Math.min(GAME_WIDTH - w - 8, px));
  if (py < 8) py = atY + 24;
  c.setPosition(px, py);
  activeKwTooltip = c;
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
  const base = { fontFamily: 'Arial', fontSize: `${fontSize}px` };
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
  if (zone === 'Deck') return 1;
  if (zone === 'Discard') return 2;
  return 3;
}

function tableHeaderStyle() {
  return {
    fontFamily: 'Arial',
    fontSize: '14px',
    fontStyle: 'bold',
    color: '#91a6b8'
  };
}

function tableCellStyle(color: string) {
  return {
    fontFamily: 'Arial',
    fontSize: '16px',
    fontStyle: 'bold',
    color
  };
}

function marketOfferTitleStyle() {
  return {
    fontFamily: 'Arial',
    fontSize: '16px',
    fontStyle: 'bold',
    color: '#ffe1a3'
  };
}

function marketOfferPriceStyle(enabled: boolean) {
  return {
    fontFamily: 'Arial',
    fontSize: '14px',
    fontStyle: 'bold',
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
      fontFamily: 'Arial',
      fontSize: '10px',
      fontStyle: 'bold',
      color: UI_FIELD.muted
    }));
  }
  if (opts.title) {
    addUi(addTo, scene.add.text(left + 36, top + (opts.eyebrow ? 46 : 30), opts.title, {
      fontFamily: 'Arial',
      fontSize: '28px',
      fontStyle: 'bold',
      color: UI_FIELD.warm,
      stroke: '#020409',
      strokeThickness: 3
    }));
  }
  if (opts.subtitle) {
    addUi(addTo, scene.add.text(left + 36, top + (opts.title ? 76 : 44), opts.subtitle, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#b9c7d6',
      wordWrap: { width: w - 220 }
    }));
  }
  return { left, right, top, bottom, cx, cy, w, h };
}

function renderCloseControl(scene: Phaser.Scene, addTo: UiAdd, x: number, y: number, onClick: () => void) {
  const hit = addUi(addTo, scene.add.rectangle(x, y, 86, 30, 0x020409, 0.05)
    .setInteractive({ useHandCursor: true }));
  const label = addUi(addTo, scene.add.text(x, y - 7, 'Close', {
    fontFamily: 'Arial',
    fontSize: '13px',
    fontStyle: 'bold',
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
  const text = addUi(addTo, scene.add.text(x, y - 8, label, {
    fontFamily: 'Arial',
    fontSize: '14px',
    fontStyle: 'bold',
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

function inspectedCardPayload(entry: { card: Card; zone: string } | undefined, costOverride?: number) {
  if (!entry) return undefined;
  return {
    id: entry.card.id,
    name: displayName(entry.card),
    bird: entry.card.bird,
    zone: entry.zone,
    cost: costOverride ?? entry.card.cost,
    type: entry.card.type,
    target: entry.card.target,
    baseText: entry.card.text,
    upgradedText: entry.card.upgradedText,
    flockStats: Object.entries(entry.card.runtime.flockStats).map(([key, value]) => ({
      label: flockStatLabel(key),
      value
    }))
  };
}

function renderFloatingCardDetail(scene: Phaser.Scene, card: Card, zone: string, cost: number, anchorX: number, anchorY: number) {
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
  const container = scene.add.container(0, 0);
  const add = (child: Phaser.GameObjects.GameObject) => { container.add(child); return child; };

  add(scene.add.rectangle(cx, cy, w + 8, h + 8, 0x06090f, 0.99).setStrokeStyle(3, accent, 1));
  const key = cardArtKey(card);
  if (key && scene.textures.exists(key)) {
    add(scene.add.image(cx, cy, key).setDisplaySize(w, h).setAlpha(0.98));
  } else {
    add(scene.add.rectangle(cx, cy, w, h, 0x141d2b, 0.95));
    add(scene.add.text(cx, cy - 42, cardLabel(card), {
      fontFamily: 'Arial', fontSize: '18px', fontStyle: 'bold', color: '#7ab8d6',
      wordWrap: { width: w - 50 }, align: 'center'
    }).setOrigin(0.5));
  }

  add(scene.add.rectangle(cx, top + 24, w - 4, 44, 0x05080e, 0.76));
  add(scene.add.text(left + 52, top + 9, displayName(card), {
    fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#ffe7b0', wordWrap: { width: w - 72 }
  }));
  add(scene.add.circle(left + 26, top + 24, 20, cost === 0 ? 0x24d0d6 : 0xe8b830, 1).setStrokeStyle(2, 0x05080e, 0.9));
  add(scene.add.text(left + 26, top + 24, `${cost}`, {
    fontFamily: 'Arial', fontSize: '23px', fontStyle: 'bold', color: '#06101c'
  }).setOrigin(0.5));

  add(scene.add.rectangle(cx, top + 60, w - 4, 24, 0x05080e, 0.68));
  add(scene.add.text(cx, top + 54, `${card.bird} / ${cardLabel(card)} / ${zone}`, {
    fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#8df4ff',
    align: 'center', wordWrap: { width: w - 16 }
  }).setOrigin(0.5, 0));

  const panelH = card.moltText ? 190 : 166;
  add(scene.add.rectangle(cx, bottom - panelH / 2 - 4, w - 4, panelH, 0x05080e, 0.93));
  add(scene.add.rectangle(cx, bottom - panelH - 4, w - 4, 2, accent, 0.85));
  let yy = bottom - panelH + 8;
  const tx = left + 16;
  const wrap = w - 32;
  add(scene.add.text(tx, yy, 'Current Effect', {
    fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#ffe1a3'
  }));
  yy += 15;
  const current = add(scene.add.text(tx, yy, displayText(card), {
    fontFamily: 'Arial', fontSize: '12px', color: '#dce8f2', lineSpacing: 1, wordWrap: { width: wrap }, maxLines: 2
  })) as Phaser.GameObjects.Text;
  yy += current.height + 8;
  add(scene.add.text(tx, yy, 'Preened Effect', {
    fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#ffe1a3'
  }));
  yy += 15;
  const upgraded = add(scene.add.text(tx, yy, card.upgraded ? 'Already preened.' : card.upgradedText, {
    fontFamily: 'Arial', fontSize: '12px', color: '#cfe0ef', lineSpacing: 1, wordWrap: { width: wrap }, maxLines: 2
  })) as Phaser.GameObjects.Text;
  yy += upgraded.height + 8;
  if (card.moltText && yy < bottom - 40) {
    add(scene.add.text(tx, yy, 'Molt Ability', {
      fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#ffc78f'
    }));
    yy += 15;
    const molt = add(scene.add.text(tx, yy, card.upgraded && card.moltTextUpgraded ? card.moltTextUpgraded : card.moltText, {
      fontFamily: 'Arial', fontSize: '11px', color: '#ffc78f', fontStyle: 'bold', lineSpacing: 1, wordWrap: { width: wrap }, maxLines: 3
    })) as Phaser.GameObjects.Text;
    yy += molt.height + 7;
  }
  add(scene.add.text(tx, Math.min(yy, bottom - 28), 'Flock Stats', {
    fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#ffe1a3'
  }));
  const stats = cardStatRows(card);
  add(scene.add.text(tx, bottom - 16, stats.length > 0 ? stats.join('   ') : 'None', {
    fontFamily: 'Arial',
    fontSize: '11px',
    fontStyle: 'bold',
    color: stats.length > 0 ? '#8df4ff' : '#91a6b8',
    align: 'center',
    wordWrap: { width: wrap }
  }).setOrigin(0, 1));
  return container;
}

function renderSceneCardDetail(scene: Phaser.Scene, card: Card, zone: string, cost: number) {
  const accent = card.upgraded ? 0x24d0d6 : card.type === 'major' ? 0xd8a840 : 0x7ab8d6;
  renderFieldPanel(scene, (obj) => {}, 842, 360, 590, 430, { accent, fill: UI_FIELD.ink });

  const key = cardArtKey(card);
  if (key && scene.textures.exists(key)) {
    scene.add.image(660, 382, key).setDisplaySize(250, 375).setAlpha(0.92);
  } else {
    scene.add.rectangle(660, 382, 250, 375, 0x141f2f, 0.95)
      .setStrokeStyle(1, 0x49606d, 0.8);
    scene.add.text(660, 382, cardLabel(card), {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#7ab8d6',
      wordWrap: { width: 190 },
      align: 'center'
    }).setOrigin(0.5);
  }

  scene.add.circle(542, 176, 18, cost === 0 ? 0x24d0d6 : 0xd8a840, 1);
  scene.add.text(542, 176, `${cost}`, {
    fontFamily: 'Arial',
    fontSize: '17px',
    fontStyle: 'bold',
    color: '#07101c'
  }).setOrigin(0.5);
  scene.add.text(840, 164, displayName(card), {
    fontFamily: 'Arial',
    fontSize: '26px',
    fontStyle: 'bold',
    color: '#ffe1a3',
    wordWrap: { width: 270 }
  });
  scene.add.text(840, 214, `${card.bird} / ${cardLabel(card)} / ${zone}`, {
    fontFamily: 'Arial',
    fontSize: '15px',
    fontStyle: 'bold',
    color: '#7ab8d6',
    wordWrap: { width: 270 }
  });
  scene.add.text(840, 242, `Target: ${targetLabel(card.target)}  Role: ${card.role.toUpperCase()}`, {
    fontFamily: 'Arial',
    fontSize: '14px',
    color: '#b9c7d6'
  });
  scene.add.text(840, 292, 'Current Effect', detailHeaderStyle());
  scene.add.text(840, 318, displayText(card), detailBodyStyle(270));
  scene.add.text(840, 398, 'Preened Effect', detailHeaderStyle());
  scene.add.text(840, 424, card.upgraded ? 'Already preened.' : card.upgradedText, detailBodyStyle(270));
  scene.add.text(840, 504, 'Flock Stats', detailHeaderStyle());
  const stats = cardStatRows(card);
  scene.add.text(840, 530, stats.length > 0 ? stats.join('   ') : 'None', {
    fontFamily: 'Arial',
    fontSize: '14px',
    fontStyle: 'bold',
    color: stats.length > 0 ? '#8df4ff' : '#91a6b8',
    wordWrap: { width: 270 }
  });
}

function detailHeaderStyle() {
  return {
    fontFamily: 'Arial',
    fontSize: '15px',
    fontStyle: 'bold',
    color: '#ffe1a3'
  };
}

function detailBodyStyle(width: number) {
  return {
    fontFamily: 'Arial',
    fontSize: '14px',
    color: '#dce8f2',
    lineSpacing: 3,
    wordWrap: { width }
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
  const rows = Object.entries(card.runtime.flockStats).map(([key, value]) => `${flockStatLabel(key)} +${value}`);
  if (card.upgraded) {
    rows.push(...Object.entries(card.runtime.upgrade.flockStats).map(([key, value]) => `${flockStatLabel(key)} +${value}`));
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

function routeNodeRiskColor(risk: RouteNode['risk']) {
  if (risk === 'low') return 0xd8a840;
  if (risk === 'medium') return 0xff9d4d;
  return 0xff5247;
}

function routeNodeRiskHex(risk: RouteNode['risk']) {
  if (risk === 'low') return '#f5d38a';
  if (risk === 'medium') return '#ff9d4d';
  return '#ff7a6e';
}

function routeNodeTypeLabel(type: RouteNode['type']) {
  switch (type) {
    case 'street': return 'Street Encounter';
    case 'rival': return 'Rival Crew';
    case 'boss': return 'Boss';
    case 'basin': return 'Basin';
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
    case 'basin': return 'A protected basin stop where the flock regroups under cover.';
    case 'nest': return 'A rooftop workshop landmark for tuning the flock before the next crossing.';
    case 'market': return 'A stall-lined landmark where route currency turns into momentum.';
    case 'signal': return 'A signal landmark where one choice changes the shape of the route.';
    case 'cache': return 'A hidden rooftop cache with one useful find waiting in the open.';
    default: return 'A marked crossing on the route.';
  }
}

function nonCombatLesson(type: RouteNode['type']) {
  switch (type) {
    case 'basin': return 'Recover Cohesion, take shelter for Open Sky Guard, or refill a Supply.';
    case 'nest': return 'Preen or Release a card, or buy a Waymark to shape the deck.';
    case 'market': return 'Spend Scrap on cards, Waymarks, Supplies, and Preen/Release.';
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

// Human-readable summary of route-effect verbs for the node-choice overlay.
function routeEffectSummary(effects: string[]): string {
  return effects.map((effect) => {
    const parsed = parseEffect(effect);
    if (!parsed) return effect;
    const a = parsed.args[0] ?? '';
    switch (parsed.name) {
      case 'gainScrap': return `+${a} Scrap`;
      case 'payScrap': return `Pay ${a} Scrap`;
      case 'loseCohesion': return `-${a} Cohesion`;
      case 'healCohesion': case 'heal': return `Heal ${a} Cohesion`;
      case 'healMissingPct': return `Heal ${a}% missing Cohesion`;
      case 'gainRouteMark': return alphaRouteMarkLibrary.get(a) ? `Gain ${alphaRouteMarkLibrary.get(a)!.name}` : 'Gain a Waymark';
      case 'gainSupply': return 'Gain a Supply';
      case 'gainSupplyChoice': return 'Choose a Supply';
      case 'gainCacheReward': return 'Open the cache';
      case 'addSnagToDiscard': case 'addSnagToDraw': return 'Add a Snag to the deck';
      case 'addCard': return 'Add a card to the flock';
      case 'preenCard': return `Preen ${a || 1}`;
      case 'releaseCard': return `Release ${a || 1}`;
      case 'gainOpenSkyGuard': return `+${a} Open Sky Guard next combat`;
      case 'reduceNextOpenSky': return `Soften next Open Sky by ${a}`;
      case 'enemyCoverNextCombat': return `Next enemy starts +${a} Cover`;
      case 'bossDamageShield': return `Boss fight starts +${a} Cover`;
      case 'extraCacheChoice': return `Caches offer +${a} choice`;
      case 'freePreenNextDistrict': return `Next district starts with ${a || 1} free Preen`;
      case 'startNextCombatOpenSky': return 'Next combat starts in Open Sky';
      case 'revealNodes': return `Reveal ${a} nodes`;
      case 'skipNextStreet': return 'Skip the next street encounter';
      case 'removeRouteChoice': return 'Close a route';
      default: return parsed.name;
    }
  }).join('   ·   ');
}

function nonCombatRewardBias(type: RouteNode['type']) {
  switch (type) {
    case 'basin': return 'Healing  ·  Open Sky Guard  ·  Supply';
    case 'nest': return 'Preen  ·  Release  ·  Waymark';
    case 'market': return 'Cards  ·  Waymarks  ·  Supplies';
    case 'signal': return 'Varies by choice';
    case 'cache': return 'Scrap  ·  Supply  ·  Waymark  ·  card  ·  heal';
    default: return '';
  }
}

function routeNodeRecovery(node: RouteNode, routeMarkIds: string[] = []) {
  if (node.type === 'basin') {
    const bonus = routeMarkIds.reduce((total, id) => {
      const mark = alphaRouteMarkLibrary.get(id);
      const parsed = mark?.trigger === 'basinHeal' ? parseEffect(mark.effect) : undefined;
      return parsed?.name === 'addHeal' ? total + parseEffectValue(parsed.args[1] ?? parsed.args[0], 0) : total;
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
  return {
    instanceId: '',
    id: runtime.id,
    name: runtime.displayName,
    type: runtime.id.startsWith('aviary_') ? 'aviary' : runtime.kind === 'legend' ? 'major' : runtime.kind === 'molt' ? 'molt' : 'minor',
    role: runtime.tags.includes('attack') ? 'attack' : runtime.tags.some((tag) => ['cover', 'heal'].includes(tag)) ? 'skill' : 'utility',
    target: runtime.target,
    cost: runtime.cost,
    text: formatEffects(runtime.effects),
    upgradedText: formatEffects(runtime.upgrade.effects),
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
let enemyMoveContext: { flock: Flock; turn: number } | null = null;

// The single source of truth for the closed enemy/pattern condition grammar
// (next-level-data-contracts §1.3). Used by both the per-effect gate
// (checkEnemyCondition) and the attack-pattern selector (evalPatternCondition),
// so authored `conditional` patterns branch on exactly the same rules cards do.
function evaluateEnemyCondition(condition: string, enemy: Enemy, flock: Flock, turn: number): boolean {
  const turnGate = condition.match(/^turn >= (\d+)$/);
  if (turnGate) return turn >= Number(turnGate[1]);
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
  return evaluateEnemyCondition(condition, enemy, enemyMoveContext.flock, enemyMoveContext.turn);
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
    .replace('spentResonance', 'spent Resonance')
    .replace('isMolting', 'Molting')
    .replace('openSky', 'Open Sky')
    .replace('fullCohesion', 'full Cohesion')
    .replace('cohesionBelowHalf', 'low Cohesion')
    .replace('defeatsEnemy', 'defeats enemy')
    .replace('fullyBlocksNextAttack', 'fully blocks next attack')
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
    case 'heal':
      return `Heal ${value}.`;
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
    case 'spendResonance':
      return `Spend ${value} Resonance.`;
    case 'resonanceBurst':
      return `Spend all Resonance: deal ${value} damage per point.`;
    case 'windedBurst':
      return `Consume the target's Winded: deal ${value} damage per stack.`;
    case 'applyWinded':
      return `Apply ${value} Winded.`;
    case 'enterMolt':
      return 'Enter Molt.';
    case 'gainOpenSkyGuard':
      return `Gain ${value} Open Sky Guard.`;
    case 'returnDiscard':
      return 'Return a card from discard.';
    case 'nextCoverBonus':
      return `Next Nest Cover +${value}.`;
    case 'nextTurnDraw':
      return `Draw ${value} next turn.`;
    case 'shuffleSelfToDraw':
      return 'Return this to the draw pile after play.';
    case 'bossDamageShield':
      return `Boss fights: gain ${value} Cover.`;
    case 'extraCacheChoice':
      return `Caches offer +${value} choice.`;
    case 'freePreenNextDistrict':
      return `Next district starts with ${value || 1} free Preen.`;
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
