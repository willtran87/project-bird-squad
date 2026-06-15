import Phaser from 'phaser';
import './style.css';
import splashUrl from '../assets/splash/bird-squad-canal-run-splash-v4.png';
import titleBirdUrl from '../assets/ui/bird-squad-title-bird-textured-v2.png';
import titleSquadUrl from '../assets/ui/bird-squad-title-squad-textured-v2.png';
import {
  alphaBasinSet,
  alphaCacheSet,
  alphaCardArtManifest,
  alphaCardSet,
  alphaEncounterLibrary,
  alphaEnemyLibrary,
  alphaMaps,
  alphaMapProfileLibrary,
  alphaMarketSet,
  alphaNestSet,
  alphaRewardProfileLibrary,
  alphaRouteMarkLibrary,
  alphaSignalLibrary,
  alphaStatusSet,
  alphaSupplyLibrary,
  getCardFlavor,
  getBirdFact,
  getCardMeaning,
  routeBlueprints,
} from './game/runtime-data';
import { generateRouteMap, hashSeed } from './game/route-gen';
import type { EnemyMove, RewardProfile, RouteNode, RuntimeCard, RuntimeEnemy, RuntimeRouteMap } from './game/types';
import { banner, burst, fadeRect, floatingText, impactRing, shakeCamera, strike } from './game/fx';
import { drawPanel } from './game/theme';
import { defaultLeaderId, flockLeaders, getLeader } from './game/leaders';
import { difficultyAdds, difficultyLabel, difficultyMods, MAX_DIFFICULTY } from './game/difficulty';
import { achievements, discoverCards, isLeaderUnlocked, leaderUnlockHints, loadAccount, recordRun, type PlayerAccount } from './game/meta';

type GameMode = 'menu' | 'routeSelection' | 'battle' | 'cardReward' | 'upgradeReward' | 'runComplete' | 'defeat';
type InspectOverlay = 'deck' | 'draw' | 'discard' | 'flock';
type CardType = 'major' | 'minor' | 'molt';
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

interface SavedCard {
  id: string;
  upgraded?: boolean;
}

interface NextCombatMods {
  openSkyGuard?: number;
  reduceNextOpenSky?: number;
  enemyCover?: number;
  startOpenSky?: boolean;
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
}

interface SignalChoiceEvent {
  signalId: string;
  choiceKey: string;
}

interface CardRewardEvent {
  offered: string[];
  picked?: string;
  skipped: boolean;
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
  hand: Array<{ id: string; name: string; bird: string; cost: number; type: CardType; target: TargetType }>;
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
  };
  inspectOverlay?: InspectOverlay;
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
const HAND_Y = 590;
const CARD_W = 164;
const CARD_H = 246; // true 2:3 card aspect (art is 1024x1536)
// Anchor points for combat FX (floating numbers / bursts), matching the
// enemy body (renderEnemyRow) and flock panel (renderFlock) positions.
const ENEMY_FX_X = 920;
const ENEMY_FX_Y = 250;
const FLOCK_FX_X = 230;
const FLOCK_FX_Y = 70;
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
const STARTING_SCRAP = 60;
// Market pricing is data-driven from alpha-market.json (next-level-implementation
// -spec "Market prices and services are data-driven").
const alphaMarketConfig = alphaMarketSet.markets[0];
const MARKET_CARD_PRICE = alphaMarketConfig.cardSlots.find((slot) => slot.rarity === 'common')?.price.base ?? 55;
const MARKET_PREEN_PRICE = alphaMarketConfig.services.find((service) => service.id === 'preen')?.basePrice ?? 100;
const MARKET_ROUTE_MARK_PRICE = alphaMarketConfig.routeMarkSlots[0]?.price.base ?? 110;
const PATCHED_HARNESS_DISCOUNT = Number(/reducePreenPrice\((\d+)\)/.exec(alphaRouteMarkLibrary.get('patched_harness')?.effect ?? '')?.[1] ?? 30);
const CACHE_SCRAP_REWARD = 45;
const SIGNAL_SCRAP_REWARD = 25;
const STREET_SCRAP_BONUS = 15;
const REWARD_SKIP_SCRAP = 20;
// Every playable card lives in one shared reward pool; weight post-combat offers
// by rarity so commons/uncommons are the staple and rares/legendaries stay scarce.
const REWARD_RARITY_WEIGHT: Record<string, number> = { common: 100, uncommon: 45, rare: 16, legendary: 5 };
const BATTLEFIELD_ASSETS: Record<string, { key: string; url: string }> = {
  map_01_rooftop_blocks: {
    key: 'battlefield-rooftop-blocks',
    url: '/assets/concept-art/rooftop-blocks-battle-backdrop-v3.png'
  },
  map_02_canal_markets: {
    key: 'battlefield-canal-markets',
    url: '/assets/concept-art/canal-markets-battle-backdrop-v2.png'
  },
  map_03_signal_spires: {
    key: 'battlefield-signal-spires',
    url: '/assets/concept-art/signal-spires-battle-backdrop-v2.png'
  },
  map_04_high_roost: {
    key: 'battlefield-high-roost',
    url: '/assets/concept-art/high-roost-battle-backdrop-v2.png'
  }
};
const DEFAULT_BATTLEFIELD_ASSET = BATTLEFIELD_ASSETS.map_01_rooftop_blocks;

// Route marks the market / cache / rewards can grant: every non-boss mark, all
// of which now fire real effects (combatStart cover/wingbeat/heal, onNthCard
// draw, firstOpenSky softening, plus the economy marks). Boss marks
// (crowbar_debt, reopened_roofline) stay boss-source only. Display text comes
// from alpha-route-marks.json, price from the market config.
const MARKET_ROUTE_MARK_IDS = [
  'chalk_wingmark', 'rooftop_shortcut', 'patched_harness', 'quiet_landing',
  'loose_change_tin', 'rain_gutter', 'wire_map', 'feather_tape',
];
const routeMarks: RouteMark[] = MARKET_ROUTE_MARK_IDS.map((id) => {
  const mark = alphaRouteMarkLibrary.get(id);
  return { id, name: mark?.name ?? id, text: mark?.description ?? '', price: MARKET_ROUTE_MARK_PRICE };
});

const cardArtAssets: Record<string, { key: string; url: string }> = Object.fromEntries(
  alphaCardArtManifest.cards
    .filter((entry) => entry.source)
    .map((entry) => [entry.cardId, {
      key: `card-${entry.cardId}`,
      url: `/${entry.source}`
    }])
);
const requestedOptionalArtKeys = new Set<string>();

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

function currentBattlefieldAsset() {
  return BATTLEFIELD_ASSETS[currentMap().id] ?? DEFAULT_BATTLEFIELD_ASSET;
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
    this.load.image('title-bird', titleBirdUrl);
    this.load.image('title-squad', titleSquadUrl);
  }

  create() {
    this.scene.start('MenuScene');
  }
}

class MenuScene extends Phaser.Scene {
  private selectedLeaderId = defaultLeaderId;
  private leaderPanels: Array<{ id: string; rect: Phaser.GameObjects.Rectangle; unlocked: boolean }> = [];
  private leaderBlurb?: Phaser.GameObjects.Text;
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
      .setAlpha(0.9);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.26);

    this.createAnimatedTitle();

    // Ascension stepper (clamped to the highest unlocked tier).
    this.selectedDifficulty = Math.min(this.selectedDifficulty, getMaxUnlockedTier());
    this.add.text(GAME_WIDTH / 2, 376, 'Ascension', {
      fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#8fa3b6'
    }).setOrigin(0.5);
    const dec = this.add.rectangle(GAME_WIDTH / 2 - 252, 400, 40, 40, 0x0d1420, 0.92)
      .setStrokeStyle(2, 0x7ab8d6, 0.9).setInteractive({ useHandCursor: true });
    dec.on('pointerdown', () => this.stepDifficulty(-1));
    this.add.text(GAME_WIDTH / 2 - 252, 399, '◂', { fontFamily: 'Arial', fontSize: '22px', color: '#dbe6f0' }).setOrigin(0.5);
    const inc = this.add.rectangle(GAME_WIDTH / 2 + 252, 400, 40, 40, 0x0d1420, 0.92)
      .setStrokeStyle(2, 0x7ab8d6, 0.9).setInteractive({ useHandCursor: true });
    inc.on('pointerdown', () => this.stepDifficulty(1));
    this.add.text(GAME_WIDTH / 2 + 252, 399, '▸', { fontFamily: 'Arial', fontSize: '22px', color: '#dbe6f0' }).setOrigin(0.5);
    this.difficultyLabelText = this.add.text(GAME_WIDTH / 2, 400, '', {
      fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#e8b830'
    }).setOrigin(0.5);
    this.difficultyDescText = this.add.text(GAME_WIDTH / 2, 426, '', {
      fontFamily: 'Arial', fontSize: '13px', color: '#9fb1c4', align: 'center', wordWrap: { width: 470 }
    }).setOrigin(0.5);
    this.updateDifficultyText();

    this.menuAccount = loadAccount();
    if (!isLeaderUnlocked(this.menuAccount, this.selectedLeaderId)) this.selectedLeaderId = defaultLeaderId;
    this.add.text(GAME_WIDTH / 2, 460, 'Choose your Flock Leader', {
      fontFamily: 'Arial', fontSize: '18px', fontStyle: 'bold', color: '#ffe1a3'
    }).setOrigin(0.5);
    this.leaderPanels = [];
    flockLeaders.forEach((leader, index) => {
      const px = 168 + index * 236;
      const py = 522;
      const unlocked = isLeaderUnlocked(this.menuAccount, leader.id);
      const rect = this.add.rectangle(px, py, 224, 80, unlocked ? 0x0d1420 : 0x0a0e15, unlocked ? 0.92 : 0.92)
        .setStrokeStyle(2, unlocked ? 0x2a4555 : 0x222a33, 0.9)
        .setInteractive({ useHandCursor: unlocked });
      if (unlocked) rect.on('pointerdown', () => this.selectLeader(leader.id));
      this.add.text(px, py - 20, leader.name, {
        fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: unlocked ? '#ffe1a3' : '#5a6675', align: 'center', wordWrap: { width: 208 }
      }).setOrigin(0.5);
      this.add.text(px, py + 18, unlocked ? `${leader.suit} · ${leader.bird}` : `🔒 ${leaderUnlockHints[leader.id] ?? 'Locked'}`, {
        fontFamily: 'Arial', fontSize: unlocked ? '12px' : '11px', color: unlocked ? '#9fb1c4' : '#6f7d8c', align: 'center', wordWrap: { width: 208 }
      }).setOrigin(0.5);
      this.leaderPanels.push({ id: leader.id, rect, unlocked });
    });
    this.leaderBlurb = this.add.text(GAME_WIDTH / 2, 580, '', {
      fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'italic', color: '#cdd9e6', align: 'center', wordWrap: { width: 880 }
    }).setOrigin(0.5);
    this.selectLeader(this.selectedLeaderId);

    const savedRun = hasActiveRun();
    if (savedRun) {
      this.makeMenuButton(GAME_WIDTH / 2, 622, 360, 46, 'Continue Run', 0xe8b830, '24px', () => this.continueRun());
      this.makeMenuButton(GAME_WIDTH / 2, 672, 300, 40, 'Start New Run', 0x7ab8d6, '18px', () => this.startRun());
    } else {
      this.makeMenuButton(GAME_WIDTH / 2, 636, 324, 54, 'Start Run', 0xd8a840, '28px', () => this.startRun());
    }
    this.input.keyboard?.on('keydown-ENTER', () => (savedRun ? this.continueRun() : this.startRun()));

    const profile = this.add.rectangle(GAME_WIDTH - 96, 40, 152, 44, 0x0d1420, 0.92)
      .setStrokeStyle(2, 0x7ab8d6, 0.9).setInteractive({ useHandCursor: true });
    profile.on('pointerover', () => profile.setFillStyle(0x1b2535, 0.96));
    profile.on('pointerout', () => profile.setFillStyle(0x0d1420, 0.92));
    profile.on('pointerdown', () => this.scene.start('ProfileScene'));
    this.add.text(GAME_WIDTH - 96, 40, 'Flock Record', {
      fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: '#dce8f2'
    }).setOrigin(0.5);

    const codex = this.add.rectangle(GAME_WIDTH - 258, 40, 152, 44, 0x0d1420, 0.92)
      .setStrokeStyle(2, 0x7ab8d6, 0.9).setInteractive({ useHandCursor: true });
    codex.on('pointerover', () => codex.setFillStyle(0x1b2535, 0.96));
    codex.on('pointerout', () => codex.setFillStyle(0x0d1420, 0.92));
    codex.on('pointerdown', () => this.scene.start('CodexScene'));
    this.add.text(GAME_WIDTH - 258, 40, 'Card Codex', {
      fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: '#dce8f2'
    }).setOrigin(0.5);
  }

  private stepDifficulty(delta: number) {
    this.selectedDifficulty = Math.max(0, Math.min(getMaxUnlockedTier(), this.selectedDifficulty + delta));
    this.updateDifficultyText();
  }

  private updateDifficultyText() {
    this.difficultyLabelText?.setText(difficultyLabel(this.selectedDifficulty));
    const locked = this.selectedDifficulty >= getMaxUnlockedTier() && this.selectedDifficulty < MAX_DIFFICULTY;
    this.difficultyDescText?.setText(
      difficultyAdds(this.selectedDifficulty) + (locked ? '\nWin this tier to unlock the next.' : ''),
    );
  }

  private makeMenuButton(x: number, y: number, w: number, h: number, text: string, color: number, fontSize: string, onClick: () => void) {
    const panel = this.add.rectangle(x, y, w, h, 0x0d1420, 0.92)
      .setStrokeStyle(2, color, 0.95)
      .setInteractive({ useHandCursor: true });
    const label = this.add.text(x, y, text, {
      fontFamily: 'Arial', fontSize, fontStyle: 'bold', color: '#ffe1a3', stroke: '#111111', strokeThickness: 4
    }).setOrigin(0.5);
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
      entry.rect.setStrokeStyle(selected ? 4 : 2, selected ? 0xe8b830 : 0x2a4555, selected ? 1 : 0.9);
      entry.rect.setFillStyle(selected ? 0x1b2535 : 0x0d1420, selected ? 0.96 : 0.92);
    });
    this.leaderBlurb?.setText(getLeader(id).blurb);
  }

  private startRun() {
    this.scene.start('RouteScene', { runState: createInitialRunState(this.selectedLeaderId, this.selectedDifficulty) });
  }

  private createAnimatedTitle() {
    const logo = this.add.container(GAME_WIDTH / 2, -210)
      .setAlpha(0)
      .setAngle(-2.5);

    const bird = this.add.image(-10, -54, 'title-bird')
      .setDisplaySize(302, 145)
      .setOrigin(0.5)
      .setAlpha(0);
    const squad = this.add.image(6, 43, 'title-squad')
      .setDisplaySize(335, 133)
      .setOrigin(0.5)
      .setAlpha(0);
    logo.add([bird, squad]);

    this.tweens.add({
      targets: logo,
      y: 166,
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

// Card Codex: a collection screen reachable from the menu. Shows every playable
// card grouped by suit; cards the player has encountered (started with, been
// offered, or picked up) show their art + text, the rest are silhouettes.
class CodexScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private activeTab = 0;
  private discovered = new Set<string>();
  private detailId?: string;
  private detailScroll = 0;
  private detailMaxScroll = 0;
  private gridScroll = 0;
  private gridMaxScroll = 0;
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

  constructor() {
    super('CodexScene');
  }

  create() {
    this.cameras.main.fadeIn(180);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.32);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.82);
    this.root = this.add.container(0, 0);
    this.discovered = new Set(loadAccount().discoveredCards);
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

  private queueArt() {
    const assets = this.allCards()
      .filter((c) => this.discovered.has(c.id))
      .map((c) => cardArtAssets[c.id])
      .filter((a) => a && !this.textures.exists(a.key) && !requestedOptionalArtKeys.has(a.key));
    if (assets.length === 0) return;
    assets.forEach((a) => { requestedOptionalArtKeys.add(a.key); this.load.image(a.key, a.url); });
    this.load.once('complete', () => this.renderAll());
    this.load.once('loaderror', () => { /* leave it as a text thumb */ });
    this.load.start();
  }

  private renderAll() {
    hideKwTooltip();
    this.root.removeAll(true);
    const all = this.allCards();
    const found = all.filter((c) => this.discovered.has(c.id)).length;
    const top = CodexScene.GRID_TOP;

    // 1) Scrollable grid of big, aspect-correct (2:3) cards. Drawn FIRST so the
    //    header/footer curtains below can hide anything scrolled out of view
    //    (WebGL doesn't support geometry masks, so we clip with opaque strips).
    const cards = this.allCards().filter(this.tabs[this.activeTab].match).sort((a, b) => a.id.localeCompare(b.id));
    const cols = 5;
    const cellW = 202;
    const cellH = 286;
    const gridLeft = (GAME_WIDTH - cols * cellW) / 2;
    const rows = Math.ceil(cards.length / cols);
    this.gridMaxScroll = Math.max(0, rows * cellH - (CodexScene.GRID_BOTTOM - top) + 12);
    this.gridScroll = Math.min(this.gridScroll, this.gridMaxScroll);

    const grid = this.add.container(0, -this.gridScroll);
    cards.forEach((card, i) => {
      const cx = gridLeft + (i % cols) * cellW + cellW / 2;
      const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
      // Cull rows fully outside the viewport (cheap + avoids drawing offscreen).
      if (cy - this.gridScroll < top - cellH || cy - this.gridScroll > CodexScene.GRID_BOTTOM + cellH) return;
      this.renderThumb(grid, card, cx, cy);
    });
    this.root.add(grid);

    // 2) Curtains hide grid overflow above/below the viewport.
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, top / 2, GAME_WIDTH, top, 0x070a11, 1));
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, (CodexScene.GRID_BOTTOM + GAME_HEIGHT) / 2, GAME_WIDTH, GAME_HEIGHT - CodexScene.GRID_BOTTOM, 0x070a11, 1));

    // 3) Header (title / counter / Back / tabs) on top of the curtain.
    this.root.add(this.add.text(40, 24, 'Card Codex', { fontFamily: 'Georgia, serif', fontSize: '34px', fontStyle: 'bold', color: '#ffe1a3', stroke: '#000000', strokeThickness: 4 }));
    this.root.add(this.add.text(42, 66, `${found} / ${all.length} cards discovered`, { fontFamily: 'Arial', fontSize: '15px', color: '#8fa3b6' }));

    const back = this.add.rectangle(GAME_WIDTH - 86, 42, 140, 44, 0x122235, 0.96).setStrokeStyle(2, 0xd8a840, 1).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('MenuScene'));
    this.root.add(back);
    this.root.add(this.add.text(GAME_WIDTH - 86, 42, 'Back', { fontFamily: 'Arial', fontSize: '18px', fontStyle: 'bold', color: '#ffe1a3' }).setOrigin(0.5));

    this.tabs.forEach((tab, i) => {
      const tx = 60 + i * 132;
      const active = i === this.activeTab;
      const tabCards = this.allCards().filter(tab.match);
      const got = tabCards.filter((c) => this.discovered.has(c.id)).length;
      const rect = this.add.rectangle(tx, 116, 124, 40, active ? 0x1d3047 : 0x0d1420, active ? 1 : 0.9)
        .setStrokeStyle(2, active ? 0x7ab8d6 : 0x2a3a4d, active ? 1 : 0.8).setInteractive({ useHandCursor: true });
      rect.on('pointerdown', () => { this.activeTab = i; this.detailId = undefined; this.gridScroll = 0; this.renderAll(); });
      this.root.add(rect);
      this.root.add(this.add.text(tx, 107, tab.label, { fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: active ? '#ffe1a3' : '#9fb1c4' }).setOrigin(0.5));
      this.root.add(this.add.text(tx, 125, `${got}/${tabCards.length}`, { fontFamily: 'Arial', fontSize: '10px', color: '#7f93a8' }).setOrigin(0.5));
    });

    if (this.gridMaxScroll > 0) {
      this.root.add(this.add.text(GAME_WIDTH - 30, CodexScene.GRID_BOTTOM + 6, this.gridScroll < this.gridMaxScroll ? 'scroll for more ▾' : '▴ scroll up', {
        fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#7f93a8'
      }).setOrigin(1, 0));
    }

    if (this.detailId) this.renderDetail(this.detailId);
  }

  private renderThumb(layer: Phaser.GameObjects.Container, card: Card, cx: number, cy: number) {
    // The art is a complete 2:3 card illustration — show it whole, undistorted.
    const aw = 184;
    const ah = Math.round(aw * 1.5); // exact 2:3, no smashing
    const w = aw + 8;
    const h = ah + 8;
    const found = this.discovered.has(card.id);
    const accent = card.type === 'major' ? 0xd8a840 : card.type === 'molt' ? 0xc56cff : suitAccentColor(card);
    const bg = this.add.rectangle(cx, cy, w, h, found ? 0x0e131d : 0x0a0d13, found ? 1 : 0.9)
      .setStrokeStyle(found ? 3 : 2, found ? accent : 0x232b35, found ? 1 : 0.7)
      .setInteractive({ useHandCursor: found });
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
    } else {
      layer.add(this.add.text(cx, cy - 14, '?', { fontFamily: 'Georgia, serif', fontSize: '72px', fontStyle: 'bold', color: '#2f3a47' }).setOrigin(0.5));
      layer.add(this.add.text(cx, cy + 84, 'Undiscovered', { fontFamily: 'Arial', fontSize: '12px', color: '#566778' }).setOrigin(0.5));
    }
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
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x0c1420, 0.995).setStrokeStyle(2, 0x7ab8d6, 1));

    // Large card art on the left, at the art's true 2:3 aspect (no distortion).
    const key = cardArtKey(card);
    const artW = 320;
    const artH = artW * 1.5;
    const artX = left + 24 + artW / 2;
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
    const viewBottom = mBottom - 16;
    const viewH = viewBottom - viewTop;
    const flav = getCardFlavor(card.id);
    const meaning = getCardMeaning(card.id);
    const accent = card.type === 'major' ? '#d8a840' : card.type === 'molt' ? '#c56cff' : `#${suitAccentColor(card).toString(16).padStart(6, '0')}`;
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

    // Tarot meaning — keyword line + upright + reversed.
    if (meaning) {
      heading('🔮  TAROT MEANING', '#c9a6ff');
      if (meaning.core) { para(meaning.core, { color: '#d9c8ff', italic: true, size: 13 }); yy += 8; }
      this.root.add(this.add.text(tx, yy, 'UPRIGHT', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#9d86c8' })); yy += 15;
      para(meaning.upright, { color: '#cfd9ea', size: 13 }); yy += 8;
      this.root.add(this.add.text(tx, yy, 'REVERSED', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#9d86c8' })); yy += 15;
      para(meaning.reversed, { color: '#b9a7bd', size: 13 }); yy += 14;
    }

    // Real-world bird facts.
    const fact = getBirdFact(flav?.bird ?? card.bird);
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
    this.root.add(this.add.rectangle(0, 0, GAME_WIDTH, mTop, 0x070a11, 0.97).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(0, mBottom, GAME_WIDTH, GAME_HEIGHT - mBottom, 0x070a11, 0.97).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(left + 1, mTop + 1, MW - 2, viewTop - mTop - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    this.root.add(this.add.rectangle(left + 1, viewBottom, MW - 2, mBottom - viewBottom - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    // Redraw the panel border crisply over the covers.
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x000000, 0).setStrokeStyle(2, 0x7ab8d6, 1));
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
  private inspectedCardId: string | undefined;
  private cardReviewScroll = 0;
  private optionalCardArtRequested = false;

  constructor() {
    super('RouteScene');
  }

  init(data: RouteSceneData = {}) {
    this.runState = cloneRunState(data.runState ?? createInitialRunState());
    activeMapIndex = this.runState.mapIndex ?? 0;
    activeSeed = this.runState.seed ?? 'alpha';
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
    this.inspectedCardId = undefined;
    this.cardReviewScroll = 0;
    this.optionalCardArtRequested = false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#08101d');
    this.cameras.main.fadeIn(200);
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
    if (this.optionalCardArtRequested) return;
    this.optionalCardArtRequested = true;
    const assets = Object.values(cardArtAssets).filter((asset) => !this.textures.exists(asset.key) && !requestedOptionalArtKeys.has(asset.key));
    if (assets.length === 0) return;
    assets.forEach((asset) => {
      requestedOptionalArtKeys.add(asset.key);
      this.load.image(asset.key, asset.url);
    });
    this.load.once('complete', () => this.renderAll());
    this.load.once('loaderror', (file: { key?: string }) => {
      console.warn(`Optional card art failed to load on route map: ${file.key ?? 'unknown'}`);
    });
    this.load.start();
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
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(0.48);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.62);
    this.add.rectangle(GAME_WIDTH / 2, 398, 1120, 462, 0x09111e, 0.9)
      .setStrokeStyle(2, 0xd8a840, 0.82);

    this.add.text(56, 28, 'Bird Squad', {
      fontFamily: 'Arial',
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#f5d38a'
    });
    this.add.text(96, 92, currentMap().name, {
      fontFamily: 'Arial',
      fontSize: '34px',
      fontStyle: 'bold',
      color: '#ffe1a3',
      stroke: '#000000',
      strokeThickness: 4
    });
    this.add.text(98, 142, this.routeSubtitle(), {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#b9c7d6'
    });

    this.add.text(96, 170, `Scrap ${this.runState.scrap}   Route Marks ${this.runState.routeMarks.length}`, {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#8df4ff'
    });

    const back = this.add.rectangle(1118, 96, 124, 42, 0x111a27, 0.96)
      .setStrokeStyle(2, 0x7ab8d6, 0.85)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => { this.confirmExitOpen = true; this.renderAll(); });
    this.add.text(1118, 96, 'Back', {
      fontFamily: 'Arial',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#dce8f2'
    }).setOrigin(0.5);

    const flock = this.add.rectangle(822, 96, 124, 42, 0x111a27, 0.96)
      .setStrokeStyle(2, 0x7ab8d6, 0.9)
      .setInteractive({ useHandCursor: true });
    flock.on('pointerdown', () => this.openFlockOverlay());
    this.add.text(822, 96, 'Flock', {
      fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold', color: '#dce8f2'
    }).setOrigin(0.5);

    const deck = this.add.rectangle(970, 96, 124, 42, 0x111a27, 0.96)
      .setStrokeStyle(2, 0xd8a840, 0.9)
      .setInteractive({ useHandCursor: true });
    deck.on('pointerdown', () => this.openDeckOverlay());
    this.add.text(970, 96, 'Deck', {
      fontFamily: 'Arial',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#ffe1a3'
    }).setOrigin(0.5);
  }

  private renderRouteMap() {
    const positions = new Map(currentMap().nodes.map((node) => [node.id, this.nodePosition(node)]));
    const onChosenPath = new Set(this.runState.completedRouteNodeIds);
    const lines = this.add.graphics();
    currentMap().edges.forEach((edge) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) return;
      // Route lines are subdued unless they connect completed (chosen-path) nodes.
      const lit = onChosenPath.has(edge.from) && onChosenPath.has(edge.to);
      lines.lineStyle(lit ? 4 : 3, lit ? 0x4f7a52 : 0x263b52, lit ? 0.9 : 0.55);
      lines.lineBetween(from.x + 32, from.y, to.x - 32, to.y);
    });

    currentMap().nodes.forEach((node) => this.renderRouteNode(node, this.selectableNodeIds.has(node.id)));

    this.renderSelectedNodePanel();
    this.renderRouteLog();
    this.renderRouteLegend();

    this.add.text(96, 690, 'Click a crossing to inspect it   ·   Enter: take selected   ·   Esc: back', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#7f93a8'
    });
  }

  // A color/glyph key so every crossing type is identifiable without hovering.
  private renderRouteLegend() {
    const types: RouteNode['type'][] = ['street', 'rival', 'boss', 'basin', 'nest', 'market', 'signal', 'cache'];
    const stripCx = 476;
    const typeY = 606;
    const riskY = 636;
    const left = 96;
    this.add.rectangle(stripCx, 621, 800, 78, 0x0a1320, 0.92).setStrokeStyle(1, 0x2a3a4d, 0.85);
    this.add.text(left, typeY - 22, 'LEGEND', { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#7f93a8' });

    let cx = left;
    for (const t of types) {
      this.add.circle(cx + 10, typeY, 10, routeNodeTypeColor(t), 0.95).setStrokeStyle(1.5, 0xffffff, 0.45);
      this.add.text(cx + 10, typeY, routeNodeGlyph(t), {
        fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#ffffff', stroke: '#0a121c', strokeThickness: 2
      }).setOrigin(0.5);
      const label = routeNodeTypeLabel(t).replace(' Encounter', '').replace(' Workshop', '').replace('Rooftop ', '');
      this.add.text(cx + 26, typeY, label, { fontFamily: 'Arial', fontSize: '13px', color: routeNodeTypeHex(t) }).setOrigin(0, 0.5);
      cx += 26 + label.length * 7.5 + 20;
    }

    this.add.text(left, riskY, 'COMBAT RISK', { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#7f93a8' }).setOrigin(0, 0.5);
    const risks: Array<[RouteNode['risk'], string]> = [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];
    let rx = left + 90;
    for (const [r, lbl] of risks) {
      this.add.circle(rx + 6, riskY, 6, routeNodeRiskColor(r), 1).setStrokeStyle(1.5, 0x0a121c, 0.8);
      this.add.text(rx + 16, riskY, lbl, { fontFamily: 'Arial', fontSize: '13px', color: routeNodeRiskHex(r) }).setOrigin(0, 0.5);
      rx += 16 + lbl.length * 7.5 + 22;
    }
    this.add.text(rx + 6, riskY, '(pip on combat crossings)', { fontFamily: 'Arial', fontSize: '12px', color: '#6a7d90' }).setOrigin(0, 0.5);
  }

  // Two-step flow: clicking a node selects it (shows this panel); the confirm
  // button commits (next-level-implementation-spec Phase 2 Selected Node Panel).
  private renderSelectedNodePanel() {
    const px = 1052;
    const py = 392;
    const pw = 300;
    this.add.rectangle(px, py, pw, 432, 0x0c1420, 0.95).setStrokeStyle(2, 0x2a3a4d, 0.92);

    const node = this.selectedNodeId
      ? currentMap().nodes.find((candidate) => candidate.id === this.selectedNodeId)
      : undefined;
    if (!node) {
      this.add.text(px, py, 'Click a crossing glyph to see\nits risk, reward, and lesson.', {
        fontFamily: 'Arial', fontSize: '15px', color: '#91a6b8', align: 'center'
      }).setOrigin(0.5);
      return;
    }

    const detail = this.nodeDetail(node);
    const left = px - pw / 2 + 20;
    let yy = py - 198;
    this.add.text(left, yy, detail.title, { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#ffe1a3', wordWrap: { width: pw - 40 } });
    yy += 36;
    this.add.text(left, yy, `${detail.type}  ·  ${node.risk.toUpperCase()} RISK`, { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: routeNodeRiskHex(node.risk) });
    yy += 30;
    this.add.text(left, yy, detail.lesson, { fontFamily: 'Arial', fontSize: '14px', color: '#cdd9e6', lineSpacing: 2, wordWrap: { width: pw - 40 } });
    yy += 88;
    if (detail.rewards) {
      this.add.text(left, yy, 'REWARD BIAS', { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#7f93a8' });
      yy += 18;
      this.add.text(left, yy, detail.rewards, { fontFamily: 'Arial', fontSize: '13px', color: '#8df4ff', wordWrap: { width: pw - 40 } });
      yy += 48;
    }
    if (detail.bossPrep) {
      this.add.text(left, yy, detail.bossPrep, { fontFamily: 'Arial', fontSize: '13px', color: '#ffb38a', wordWrap: { width: pw - 40 } });
    }

    if (this.selectableNodeIds.has(node.id)) {
      const btn = this.add.rectangle(px, py + 178, pw - 44, 46, 0x274536, 0.96)
        .setStrokeStyle(2, 0x6fd69a, 1)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this.commitRouteNode(node.id));
      this.add.text(px, py + 178, 'Take this route', { fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: '#dffaeb' }).setOrigin(0.5);
    } else {
      this.add.text(px, py + 178, 'Not reachable from here.', { fontFamily: 'Arial', fontSize: '13px', color: '#7f93a8' }).setOrigin(0.5);
    }
  }

  private nodeDetail(node: RouteNode) {
    const encounter = alphaEncounterLibrary.get(node.payloadId);
    const profile = encounter ? alphaRewardProfileLibrary.get(encounter.rewardProfileId) : undefined;
    const rewards = profile
      ? [
          Array.isArray(profile.scrap) ? `${profile.scrap[0]}-${profile.scrap[1]} Scrap` : profile.scrap !== undefined ? `${profile.scrap} Scrap` : '',
          profile.cardReward ? 'new card' : '',
          profile.preenGuaranteed ? 'Preen' : profile.preenChance ? `${Math.round(profile.preenChance * 100)}% Preen` : '',
          profile.routeMarkGuaranteed ? 'Route Mark' : profile.routeMarkChance ? `${Math.round(profile.routeMarkChance * 100)}% Route Mark` : '',
          profile.bossRouteMarkChoices ? `${profile.bossRouteMarkChoices} boss Route Marks` : ''
        ].filter(Boolean).join('  ·  ')
      : nonCombatRewardBias(node.type);
    const bossPrep = node.type === 'boss'
      ? `Final crossing. ${encounter?.name ?? 'The boss'} tests Cover and Molt restraint.`
      : node.type === 'rival'
        ? 'Rival Crew — an optional boss-prep bet for richer rewards.'
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
    const typeColor = routeNodeTypeColor(node.type);
    // Fill = TYPE (always, so the crossing reads by color); ring = state.
    const fillAlpha = completed ? 0.34 : selectable ? 0.98 : 0.74;
    const strokeColor = selected ? 0x24d0d6 : selectable ? 0xffffff : current ? typeColor : typeColor;
    const strokeWidth = selected ? 6 : selectable ? 4 : current ? 4 : 2;
    const strokeAlpha = selected || selectable || current ? 1 : 0.55;

    // The current node pulses in its type color; selectable nodes get a bright ring.
    if (current) {
      this.add.circle(x, y, radius + 8, typeColor, 0).setStrokeStyle(2, typeColor, 0.5);
    }
    const circle = this.add.circle(x, y, radius, typeColor, fillAlpha)
      .setStrokeStyle(strokeWidth, strokeColor, strokeAlpha);
    // Every node is hoverable for the full preview; selectable nodes commit-select on click.
    circle.setInteractive({ useHandCursor: selectable });
    if (selectable) circle.on('pointerdown', () => this.selectRouteNode(node.id));
    let tip: Phaser.GameObjects.Container | undefined;
    circle.on('pointerover', () => { tip = this.showNodeTooltip(node, x, y - radius - 8); });
    circle.on('pointerout', () => { tip?.destroy(true); tip = undefined; });

    this.add.text(x, y, routeNodeGlyph(node.type), {
      fontFamily: 'Arial',
      fontSize: isBoss ? '30px' : '24px',
      fontStyle: 'bold',
      color: completed ? '#7c8da0' : '#ffffff',
      stroke: '#0a121c',
      strokeThickness: 3
    }).setOrigin(0.5);

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

  private showNodeTooltip(node: RouteNode, x: number, anchorY: number) {
    const detail = this.nodeDetail(node);
    const line2 = `${detail.type} · ${node.risk} risk`;
    const width = Math.max(detail.title.length, line2.length) * 7 + 26;
    const cx = Math.max(width / 2 + 6, Math.min(900 - width / 2, x));
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
    const leftX = 92;
    const rightX = 872;
    const colCount = Math.max(1, columns.length);
    const x = colCount > 1 ? leftX + (node.column * (rightX - leftX)) / (colCount - 1) : (leftX + rightX) / 2;
    const laneGap = Math.min(112, 376 / Math.max(1, columnNodes.length));
    const y = 388 + (laneIndex - (columnNodes.length - 1) / 2) * laneGap;
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
    if (node.type === 'basin') return alphaBasinSet.options.map((option) => ({ key: option.id, text: option.label, effects: option.effects, locked: false }));
    if (node.type === 'cache') return alphaCacheSet.options.map((option) => ({ key: option.id, text: option.label, effects: option.effects, locked: false }));
    if (node.type === 'nest') {
      return alphaNestSet.options.map((option) => ({
        key: option.id,
        text: option.label,
        effects: option.effects,
        locked: option.cost !== undefined && this.runState.scrap < option.cost,
        lockedText: option.cost !== undefined ? `Need ${option.cost} Scrap` : undefined
      }));
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
      if (this.hasRouteMark('wire_map')) this.runState.scrap += SIGNAL_SCRAP_REWARD;
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
        const card = cardLibrary[saved.id];
        return { index, name: card.name, cost: card.cost, upgraded: !!saved.upgraded };
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
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.82).setInteractive({ useHandCursor: false });
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 720, 470, 0x0d1420, 0.98).setStrokeStyle(3, mode === 'preen' ? 0x24d0d6 : 0xff6b57, 0.95);
    this.add.text(GAME_WIDTH / 2, 152, mode === 'preen' ? 'Preen a Card' : 'Release a Card', {
      fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffe1a3', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 192, mode === 'preen' ? 'Choose a card to improve.' : 'Choose a card to remove from the flock.', {
      fontFamily: 'Arial', fontSize: '15px', color: '#b9c7d6'
    }).setOrigin(0.5);
    eligible.slice(0, 12).forEach((entry, i) => {
      const x = GAME_WIDTH / 2 - 165 + (i % 2) * 330;
      const y = 236 + Math.floor(i / 2) * 48;
      const button = this.add.rectangle(x, y, 312, 42, 0x1d2c40, 0.97).setStrokeStyle(2, 0x7ab8d6, 0.9).setInteractive({ useHandCursor: true });
      button.on('pointerdown', () => this.applyCardPick(entry.index));
      this.add.circle(x - 134, y, 12, entry.cost === 0 ? 0x24d0d6 : 0xd8a840, 1);
      this.add.text(x - 134, y, `${entry.cost}`, { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#07101c' }).setOrigin(0.5);
      this.add.text(x - 114, y, `${entry.name}${entry.upgraded ? '+' : ''}`, { fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: '#ffe1a3', wordWrap: { width: 230 } }).setOrigin(0, 0.5);
    });
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
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.82).setInteractive({ useHandCursor: false });
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 760, 470, 0x0d1420, 0.98).setStrokeStyle(3, 0xd8a840, 0.95);
    this.add.text(GAME_WIDTH / 2, 162, signal?.title ?? routeNodeTypeLabel(node.type), {
      fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffe1a3', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 206, signal?.prompt ?? nonCombatLesson(node.type), {
      fontFamily: 'Arial', fontSize: '15px', color: '#b9c7d6', align: 'center', wordWrap: { width: 680 }
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 248, `Scrap ${this.runState.scrap}    Cohesion ${this.runState.currentHp}/${this.runMaxHp()}`, {
      fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: '#8df4ff'
    }).setOrigin(0.5);
    choices.forEach((choice, index) => {
      const y = 300 + index * 58;
      const button = this.add.rectangle(GAME_WIDTH / 2, y, 660, 50, choice.locked ? 0x101827 : 0x1d2c40, choice.locked ? 0.6 : 0.97)
        .setStrokeStyle(2, choice.locked ? 0x49606d : 0x7ab8d6, choice.locked ? 0.5 : 0.95);
      if (!choice.locked) {
        button.setInteractive({ useHandCursor: true });
        button.on('pointerdown', () => this.chooseNodeOption(choice.key));
      }
      this.add.text(GAME_WIDTH / 2 - 312, y - 11, choice.text, {
        fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: choice.locked ? '#7f93a8' : '#ffe1a3'
      });
      this.add.text(GAME_WIDTH / 2 - 312, y + 9, choice.locked && choice.lockedText ? choice.lockedText : routeEffectSummary(choice.effects), {
        fontFamily: 'Arial', fontSize: '12px', color: choice.locked ? '#ff9d4d' : '#9fb1c4', wordWrap: { width: 620 }
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
    this.marketMessage = 'Rooftop vendors spread their tarps between antenna masts.';
    this.selectableNodeIds = new Set();
    this.renderAll();
  }

  private applyRouteNodeReward(node: RouteNode) {
    const recovery = routeNodeRecovery(node, this.runState.routeMarks);
    if (recovery > 0) this.runState.currentHp = Math.min(this.runMaxHp(), this.runState.currentHp + recovery);

    if (node.type === 'cache') {
      this.runState.scrap += CACHE_SCRAP_REWARD;
      const mark = this.firstUnownedRouteMark();
      if (mark) this.addRouteMark(mark.id);
    }

    if (node.type === 'signal' && this.hasRouteMark('wire_map')) {
      this.runState.scrap += SIGNAL_SCRAP_REWARD;
    }

    if (node.type === 'nest') {
      const preened = this.preenFirstAvailableCard();
      this.runState.routeLog.push(routeNodeResolutionText(node, { recovery, preened }));
      return;
    }

    this.runState.routeLog.push(routeNodeResolutionText(node, {
      recovery,
      scrap: node.type === 'cache' ? CACHE_SCRAP_REWARD : node.type === 'signal' && this.hasRouteMark('wire_map') ? SIGNAL_SCRAP_REWARD : 0
    }));
  }

  private renderMarketOverlay() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.78)
      .setInteractive({ useHandCursor: false });
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 940, 520, 0x0d1420, 0.98)
      .setStrokeStyle(3, 0xd8a840, 0.95);
    this.add.text(210, 110, 'Market', {
      fontFamily: 'Arial',
      fontSize: '40px',
      fontStyle: 'bold',
      color: '#ffe1a3',
      stroke: '#000000',
      strokeThickness: 5
    });
    this.add.text(210, 158, `Scrap ${this.runState.scrap}`, {
      fontFamily: 'Arial',
      fontSize: '19px',
      fontStyle: 'bold',
      color: '#8df4ff'
    });
    this.add.text(210, 188, this.marketMessage, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#b9c7d6',
      wordWrap: { width: 820 }
    });

    this.renderMarketCardOffer(250, 372);
    this.renderMarketRouteMarkOffer(640, 286);
    this.renderMarketPreenOffer(640, 430);

    const leave = this.add.rectangle(1010, 110, 124, 40, 0x33252b, 0.98)
      .setStrokeStyle(2, 0xff6b57, 0.95)
      .setInteractive({ useHandCursor: true });
    leave.on('pointerdown', () => this.leaveMarket());
    this.add.text(1010, 110, 'Leave', {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffd5cc'
    }).setOrigin(0.5);
  }

  private renderMarketCardOffer(x: number, y: number) {
    const offer = this.marketCardOffer();
    const enabled = !!offer && this.runState.scrap >= MARKET_CARD_PRICE;
    this.add.rectangle(x, y, 270, 340, 0x141f2f, 0.97)
      .setStrokeStyle(2, enabled ? 0xd8a840 : 0x49606d, enabled ? 0.95 : 0.65);
    this.add.text(x - 108, y - 148, 'Add to the Flock', marketOfferTitleStyle());
    this.add.text(x - 108, y - 122, `${MARKET_CARD_PRICE} Scrap`, marketOfferPriceStyle(enabled));
    if (offer) {
      const key = cardArtKey(offer);
      if (key && this.textures.exists(key)) {
        this.add.image(x, y - 12, key).setDisplaySize(148, 222).setAlpha(0.78);
      }
      this.add.text(x - 108, y - 70, displayName(offer), {
        fontFamily: 'Arial',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffe1a3',
        wordWrap: { width: 216 }
      });
      this.add.text(x - 108, y - 22, `${offer.bird} / ${cardLabel(offer)}`, {
        fontFamily: 'Arial',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#7ab8d6',
        wordWrap: { width: 216 }
      });
      this.add.text(x - 108, y + 30, displayText(offer), detailBodyStyle(216));
    } else {
      this.add.text(x - 108, y - 50, 'Every available crew card is already in the flock.', detailBodyStyle(216));
    }
    this.renderMarketButton(x, y + 142, 'Buy', enabled, () => this.buyMarketCard());
  }

  private renderMarketRouteMarkOffer(x: number, y: number) {
    const mark = this.marketRouteMarkOffer();
    const enabled = !!mark && this.runState.scrap >= mark.price;
    this.add.rectangle(x, y, 410, 112, 0x141f2f, 0.97)
      .setStrokeStyle(2, enabled ? 0xd8a840 : 0x49606d, enabled ? 0.95 : 0.65);
    this.add.text(x - 180, y - 36, 'Route Mark', marketOfferTitleStyle());
    this.add.text(x - 180, y - 10, mark ? `${mark.name} / ${mark.price} Scrap` : 'Sold out', marketOfferPriceStyle(enabled));
    this.add.text(x - 180, y + 18, mark ? mark.text : 'No unclaimed marks remain in this market.', detailBodyStyle(260));
    this.renderMarketButton(x + 138, y + 20, 'Buy', enabled, () => this.buyMarketRouteMark());
  }

  private renderMarketPreenOffer(x: number, y: number) {
    const card = this.marketPreenCandidate();
    const price = this.marketPreenPrice();
    const enabled = !!card && this.runState.scrap >= price;
    this.add.rectangle(x, y, 410, 112, 0x141f2f, 0.97)
      .setStrokeStyle(2, enabled ? 0x24d0d6 : 0x49606d, enabled ? 0.95 : 0.65);
    this.add.text(x - 180, y - 36, 'Preen a Card', marketOfferTitleStyle());
    this.add.text(x - 180, y - 10, card ? `${displayName(card)} / ${price} Scrap` : 'No cards to preen', marketOfferPriceStyle(enabled));
    this.add.text(x - 180, y + 18, card ? 'Improve the first unpreened card in your flock deck.' : 'Every card in the flock is already polished.', detailBodyStyle(260));
    this.renderMarketButton(x + 138, y + 20, 'Preen', enabled, () => this.buyMarketPreen());
  }

  private renderMarketButton(x: number, y: number, label: string, enabled: boolean, onClick: () => void) {
    const button = this.add.rectangle(x, y, 112, 34, enabled ? 0x20334a : 0x101827, enabled ? 0.98 : 0.5)
      .setStrokeStyle(2, enabled ? 0xd8a840 : 0x49606d, enabled ? 0.95 : 0.55);
    if (enabled) {
      button.setInteractive({ useHandCursor: true });
      button.on('pointerdown', onClick);
    }
    this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      color: enabled ? '#ffe1a3' : '#596a78'
    }).setOrigin(0.5);
  }

  private buyMarketCard() {
    const offer = this.marketCardOffer();
    if (!offer || this.runState.scrap < MARKET_CARD_PRICE) return;
    this.runState.scrap -= MARKET_CARD_PRICE;
    this.runState.deck.push({ id: offer.id, upgraded: offer.upgraded });
    this.marketMessage = `${displayName(offer)} joins the flock.`;
    this.renderAll();
    this.queueOptionalCardArtLoad();
  }

  private buyMarketRouteMark() {
    const mark = this.marketRouteMarkOffer();
    if (!mark || this.runState.scrap < mark.price) return;
    this.runState.scrap -= mark.price;
    this.addRouteMark(mark.id);
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
    const owned = new Set(this.runState.deck.map((card) => card.id));
    const id = arcanaRewardPool.find((candidate) => !owned.has(candidate));
    return id ? cloneCard(id) : undefined;
  }

  private marketRouteMarkOffer() {
    return routeMarks.find((mark) => !this.hasRouteMark(mark.id));
  }

  private marketPreenCandidate() {
    const saved = this.runState.deck.find((card) => !card.upgraded);
    if (!saved) return undefined;
    const card = cloneCard(saved.id);
    card.upgraded = saved.upgraded;
    return card;
  }

  private marketPreenPrice() {
    return Math.max(35, MARKET_PREEN_PRICE - (this.hasRouteMark('patched_harness') ? PATCHED_HARNESS_DISCOUNT : 0));
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
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 760, 540, 0x0d1420, 0.98).setStrokeStyle(3, 0x7ab8d6, 0.95);
    this.add.text(260, 118, 'Flock Stats', { fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffe1a3' });
    this.add.text(260, 156, `Cohesion ${this.runState.currentHp}/${this.runMaxHp()}   ·   Scrap ${this.runState.scrap}   ·   Route Marks ${this.runState.routeMarks.length}`, {
      fontFamily: 'Arial', fontSize: '15px', color: '#8df4ff'
    });
    const rows = buildFlockStatRows(cardsFromSave(this.runState.deck), this.runMaxHp());
    renderFlockStatTable(this, () => {}, rows, 260, 196);
    this.add.text(260, 588, 'Passive stats from owned cards. Build them up across the run.', {
      fontFamily: 'Arial', fontSize: '14px', color: '#91a6b8'
    });
    const close = this.add.rectangle(940, 152, 96, 34, 0x33252b, 0.98).setStrokeStyle(2, 0xff6b57, 0.95).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.closeFlockOverlay());
    this.add.text(940, 152, 'Close', { fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: '#ffd5cc' }).setOrigin(0.5);
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
    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.76)
      .setInteractive({ useHandCursor: false });
    const panel = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1060, 570, 0x0d1420, 0.98)
      .setStrokeStyle(3, 0xd8a840, 0.95);
    const close = this.add.rectangle(1110, 96, 112, 36, 0x33252b, 0.98)
      .setStrokeStyle(2, 0xff6b57, 0.95)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.closeDeckOverlay());

    this.add.text(1110, 96, 'Close', {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffd5cc'
    }).setOrigin(0.5);

    this.renderMapCardBrowser();
  }

  private renderMapCardBrowser() {
    const cards = this.mapDeckCards();
    this.add.text(140, 86, `Deck Review (${cards.length})`, {
      fontFamily: 'Arial',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffe1a3'
    });
    this.add.text(140, 126, `Flock deck / Cohesion ${this.runState.currentHp}/${this.runMaxHp()}`, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#b9c7d6'
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
      const y = 176 + index * CARD_REVIEW_ROW_H;
      const selected = selectedEntry?.card.id === card.id;
      const rowBg = this.add.rectangle(x + 150, y + 15, 300, 32, selected ? 0x21344a : 0x141f2f, 0.96)
        .setStrokeStyle(selected ? 2 : 1, selected ? 0xd8a840 : card.upgraded ? 0x24d0d6 : 0x49606d, selected ? 1 : 0.8)
        .setInteractive({ useHandCursor: true });
      rowBg.on('pointerdown', () => onInspect(card.id));
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

    this.renderScrollButton(472, 192, 'Up', this.cardReviewScroll > 0, () => onScroll(-1));
    this.renderScrollButton(472, 542, 'Down', this.cardReviewScroll < scrollMax, () => onScroll(1));
    this.add.text(424, 568, `${this.cardReviewScroll + 1}-${this.cardReviewScroll + visible.length} / ${cards.length}`, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#91a6b8'
    });
  }

  private renderScrollButton(x: number, y: number, label: string, enabled: boolean, onClick: () => void) {
    const button = this.add.rectangle(x, y, 70, 30, enabled ? 0x18283a : 0x101827, enabled ? 0.98 : 0.5)
      .setStrokeStyle(1, enabled ? 0xd8a840 : 0x49606d, enabled ? 0.95 : 0.55);
    if (enabled) {
      button.setInteractive({ useHandCursor: true });
      button.on('pointerdown', onClick);
    }
    this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'bold',
      color: enabled ? '#ffe1a3' : '#596a78'
    }).setOrigin(0.5);
  }

  private renderRouteCardDetailPanel(card: Card, zone: string) {
    renderSceneCardDetail(this, card, zone, card.cost);
  }

  private updateTextState() {
    const inspected = this.deckOverlayOpen
      ? inspectedCardPayload(getInspectedEntry(this.mapDeckCards(), this.inspectedCardId), undefined)
      : undefined;
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
        scrap: this.runState.scrap,
        routeMarks: [...this.runState.routeMarks]
      },
      deckOverlayOpen: this.deckOverlayOpen,
      marketOpen: this.marketOpen,
      market: this.marketOpen
        ? {
            scrap: this.runState.scrap,
            cardOffer: this.marketCardOffer()?.id ?? '',
            routeMarkOffer: this.marketRouteMarkOffer()?.id ?? '',
            preenOffer: this.marketPreenCandidate()?.id ?? '',
            message: this.marketMessage
          }
        : undefined,
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
        selectable: this.selectableNodeIds.has(node.id)
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

  private renderRouteLog() {
    this.add.rectangle(1030, 614, 288, 78, 0x0d1420, 0.86)
      .setStrokeStyle(1, 0x49606d, 0.85);
    this.add.text(902, 584, 'Signals', {
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffe1a3'
    });
    const latest = this.runState.routeLog.slice(-2);
    this.add.text(902, 604, latest.length > 0 ? latest.join('\n') : 'The first route is open.', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#b9c7d6',
      lineSpacing: 4,
      wordWrap: { width: 250 }
    });
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
  // Route Mark (relic) per-combat latches: which once-per-combat marks have
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
    this.mode = 'battle';
    this.inspectOverlay = undefined;
    this.inspectedCardId = undefined;
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
    this.drawToHandSize();
    this.lastFlockState = this.flockState();
  }

  // Consume route-granted pending combat modifiers at combat start (Supplies,
  // Signals, and Route Marks that set up the next fight).
  private applyNextCombatMods(pending: NextCombatMods | undefined) {
    if (!pending) return;
    if (pending.openSkyGuard) this.flock.openSkyGuard += pending.openSkyGuard;
    if (pending.reduceNextOpenSky) this.flock.openSkyGuard += pending.reduceNextOpenSky;
    if (pending.startOpenSky) { this.flock.exposed = true; this.flock.exposedTurns = 2; }
    if (pending.enemyCover) this.enemies.forEach((enemy) => { enemy.block += pending.enemyCover ?? 0; });
  }

  // --- Route Marks as relics -------------------------------------------------
  // Marks are persistent run-long modifiers. Each owned mark fires its authored
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
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#08101d');
    this.root = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    this.cameras.main.fadeIn(200);

    this.input.keyboard?.on('keydown-ESC', () => {
      this.selectedInstanceId = undefined;
      this.inspectOverlay = undefined;
      this.inspectedCardId = undefined;
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
  }

  private renderAll() {
    hideKwTooltip();
    enemyMoveContext = { flock: this.flock, turn: this.turn }; // keep conditional intents live
    this.updateFormationFx();
    this.root.removeAll(true);
    this.renderBackdrop();
    this.renderTopBar();
    this.renderEnemyRow();
    this.renderPiles();
    this.renderHand();
    this.renderSupplies();
    this.renderCommandStrip();
    this.renderToast();
    if (this.mode === 'cardReward') this.renderCardReward();
    if (this.mode === 'upgradeReward') this.renderUpgradeReward();
    if (this.mode === 'runComplete' || this.mode === 'defeat') this.renderOutcome();
    if (this.inspectOverlay) this.renderInspectOverlay(this.inspectOverlay);
    if (this.logDrawerOpen) this.renderLogDrawer();
  }

  private renderBackdrop() {
    const battlefield = currentBattlefieldAsset();
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

    const assets = [
      currentBattlefieldAsset(),
      ...Object.values(cardArtAssets)
    ].filter((asset) => !this.textures.exists(asset.key) && !requestedOptionalArtKeys.has(asset.key));

    if (assets.length === 0) return;

    assets.forEach((asset) => {
      requestedOptionalArtKeys.add(asset.key);
      this.load.image(asset.key, asset.url);
    });
    this.load.once('complete', () => this.renderAll());
    this.load.once('loaderror', (file: { key?: string }) => {
      console.warn(`Optional art failed to load: ${file.key ?? 'unknown'}`);
    });
    this.load.start();
  }

  // Per-enemy board placement: a single enemy keeps the classic right-side
  // anchor; 2-4 enemies fan out horizontally around it and shrink to fit. Slots
  // are keyed by array index so positions stay put when one enemy dies.
  private enemyView(enemy: Enemy): { x: number; y: number; scale: number } {
    return enemyViewAt(Math.max(0, this.enemies.indexOf(enemy)), this.enemies.length);
  }

  // HP-bar geometry for an enemy, matching renderEnemyRow so the drain animation
  // (damageEnemy) lines up. Identical to ENEMY_HP_BAR for the single-enemy case.
  private enemyHpBar(enemy: Enemy): { x: number; y: number; w: number; h: number } {
    const { x, y, scale } = this.enemyView(enemy);
    return { x, y: y + 68 * scale, w: ENEMY_HP_BAR.w * scale, h: ENEMY_HP_BAR.h };
  }

  private renderEnemyRow() {
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      const selected = enemy.id === this.selectedEnemyId;
      const { x, y, scale: s } = this.enemyView(enemy);
      const elite = enemy.runtime.type === 'elite';
      const boss = enemy.runtime.type === 'boss';
      const move = currentMove(enemy);

      const frameColor = selected ? 0x24d0d6 : elite ? 0xffcf4a : boss ? 0xff6f6f : 0xd8a840;
      const body = this.add.ellipse(x, y, 156 * s, 112 * s, elite ? 0x5b3f6d : 0x6f4b35, 1)
        .setStrokeStyle(selected ? 5 : elite ? 4 : 2, frameColor, 1)
        .setInteractive({ useHandCursor: true });
      body.on('pointerdown', () => this.onEnemyClicked(enemy.id));
      this.root.add(body);
      this.root.add(this.add.triangle(x + 68 * s, y - 10 * s, 0, 0, 22 * s, 8 * s, 0, 16 * s, 0xe7c36a, 1));
      this.root.add(this.add.text(x, y - 10 * s, enemyInitials(enemy.name), {
        fontFamily: 'Arial',
        fontSize: `${Math.round(28 * s)}px`,
        fontStyle: 'bold',
        color: '#1b1110'
      }).setOrigin(0.5));
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
        .setStrokeStyle(1, 0x000000, 0.55));
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
      const by = y - 104 * s;
      const badge = this.add.circle(x, by, 28 * s, 0x10171f, 0.96)
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
      this.root.add(this.add.text(x, by, badgeValue, {
        fontFamily: 'Arial', fontSize: `${Math.round(24 * s)}px`, fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(0.5));
      if (hasDebuff && dmg > 0) {
        this.root.add(this.add.circle(x + 23 * s, by - 20 * s, 8 * s, 0xc98bff, 1));
        this.root.add(this.add.text(x + 23 * s, by - 20 * s, '!', {
          fontFamily: 'Arial', fontSize: `${Math.round(12 * s)}px`, fontStyle: 'bold', color: '#170f1e'
        }).setOrigin(0.5));
      }
      this.root.add(this.add.text(x, by + 42 * s, move.label, {
        fontFamily: 'Arial', fontSize: `${Math.round(14 * s)}px`, fontStyle: 'bold',
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

  // Single compact top status bar: the flock's Cohesion + formation + suit
  // keystones, plus the run resources and map info — so the whole left-mid board
  // is free for the fight and the hand.
  private renderTopBar() {
    const fstate = this.flockState();
    const stateAccent = fstate === 'surging' ? 0x8df4ff : fstate === 'scattered' ? 0xff9d6b : 0xd8a840;
    const highlight = this.flock.molt || fstate !== 'holding';
    const stroke = this.flock.molt ? 0xc56cff : highlight ? stateAccent : 0x2a3a4d;
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, 52, GAME_WIDTH - 20, 80, 0x0b1320, 0.9)
      .setStrokeStyle(highlight ? 3 : 1, stroke, highlight ? 1 : 0.55));

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
    this.renderChip(1024, FLOCK_HP_BAR.y + 1, 120, 'Route Marks', `${this.routeMarks.length}`, 0xc9a6ff, 'Passive run-long relic bonuses.');

    // Map info (far right).
    const routeNode = currentCombatNodes()[this.currentRouteIndex];
    this.root.add(this.add.text(1262, 36, `Rooftop ${this.encounter}/${this.maxEncounters} · Beat ${this.turn}`, { fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: '#f5d38a' }).setOrigin(1, 0.5));
    this.root.add(this.add.text(1262, 58, `${currentMap().name}: ${routeNode.label}`, { fontFamily: 'Arial', fontSize: '12px', color: '#b9c7d6' }).setOrigin(1, 0.5));
  }


  private renderChip(cx: number, cy: number, width: number, label: string, value: string, accent: number, tip?: string, onClick?: () => void) {
    const rect = this.add.rectangle(cx, cy, width, 40, 0x0e1623, 0.92).setStrokeStyle(2, accent, 0.85);
    if (onClick) {
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerdown', onClick);
    }
    if (tip) this.attachTooltip(rect, label, tip);
    this.root.add(rect);
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
    // Dynamic centered layout: fan/overlap only when the hand is too wide to fit
    // the band between the draw pile (left) and discard pile (right).
    const minLeft = 142;
    const maxRight = 1140;
    const avail = maxRight - minLeft;
    const spacing = n > 1 ? Math.min(CARD_W + 12, (avail - CARD_W) / (n - 1)) : 0;
    const totalW = (n - 1) * spacing + CARD_W;
    const startX = minLeft + Math.max(0, (avail - totalW) / 2);

    this.hand.forEach((card, index) => {
      const x = Math.round(startX + index * spacing); // card left edge
      this.renderHandCard(card, x);
    });
  }

  private renderHandCard(card: Card, x: number) {
    const cx = x + CARD_W / 2;
    const top = HAND_Y - CARD_H / 2;
    const bottom = HAND_Y + CARD_H / 2;
    const selected = this.selectedInstanceId === card.instanceId;
    const canPay = this.effectiveCost(card) <= this.energy;
    const accent = card.type === 'major' ? 0xd8a840 : card.type === 'molt' ? 0xc56cff : suitAccentColor(card);

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
    renderRichText(this, this.root, cx, bottom - panelH + 5, displayText(card), {
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
    py += renderRichText(this, c, cx, py, displayText(card), { wrap: w - 24, fontSize: 15, align: 'center', lineSpacing: 2 }) + 6;
    if (card.moltText) {
      renderRichText(this, c, cx, py, `❂ MOLT: ${card.moltText}`, { wrap: w - 24, fontSize: 12, align: 'center', baseColor: '#ff9d4d', bold: true, lineSpacing: 2 });
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

  private useSupply(index: number) {
    if (this.mode !== 'battle') return;
    const id = this.runSupplies[index];
    const supply = id ? alphaSupplyLibrary.get(id) : undefined;
    if (!supply) return;
    supply.effects.forEach((effect) => this.applySupplyEffect(effect));
    this.runSupplies.splice(index, 1);
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
    this.renderRewardBackdrop('Add to the Flock', 'Choose one new crew card — or skip for Scrap.');
    this.renderDeckNeeds(196);
    this.rewardChoices.forEach((card, index) => {
      this.renderChoiceCard(card, 392 + index * 248, 360, () => this.chooseRewardCard(card.id));
    });
    const skip = this.add.rectangle(GAME_WIDTH / 2, 590, 280, 46, 0x2a2320, 0.96)
      .setStrokeStyle(2, 0xd8a840, 0.9)
      .setInteractive({ useHandCursor: true });
    skip.on('pointerdown', () => this.skipCardReward());
    this.root.add(skip);
    this.root.add(this.add.text(GAME_WIDTH / 2, 590, `Skip — take +${REWARD_SKIP_SCRAP} Scrap`, {
      fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: '#ffe1a3'
    }).setOrigin(0.5));
  }

  private renderUpgradeReward() {
    this.renderRewardBackdrop('Preen a Card', 'Choose one owned crew card to improve.');
    this.upgradeChoices.forEach((card, index) => {
      this.renderChoiceCard(card, 392 + index * 248, 360, () => this.chooseUpgradeCard(card.id));
    });
  }

  private renderRewardBackdrop(title: string, subtitle: string) {
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.78);
    this.root.add(overlay);
    this.root.add(this.add.text(GAME_WIDTH / 2, 128, title, {
      fontFamily: 'Arial',
      fontSize: '42px',
      fontStyle: 'bold',
      color: '#ffe1a3',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5));
    this.root.add(this.add.text(GAME_WIDTH / 2, 174, subtitle, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#b9c7d6'
    }).setOrigin(0.5));
  }

  private renderChoiceCard(card: Card, x: number, y: number, onClick: () => void) {
    const rect = this.add.rectangle(x, y, 190, 252, 0x161b27, 0.98)
      .setStrokeStyle(3, card.upgraded ? 0x24d0d6 : card.type === 'major' ? 0xd8a840 : 0x7ab8d6, 1)
      .setInteractive({ useHandCursor: true });
    rect.on('pointerdown', onClick);
    this.root.add(rect);
    this.renderChoiceCardArt(card, x, y);

    this.root.add(this.add.circle(x - 74, y - 104, 16, card.cost === 0 ? 0x24d0d6 : 0xd8a840, 1));
    this.root.add(this.add.text(x - 74, y - 104, `${card.cost}`, {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#07101c'
    }).setOrigin(0.5));

    this.root.add(this.add.text(x - 76, y - 86, displayName(card), {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffe1a3',
      wordWrap: { width: 150 }
    }));
    this.root.add(this.add.text(x - 76, y - 28, card.bird, {
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#91a6b8',
      wordWrap: { width: 150 }
    }));
    this.root.add(this.add.text(x - 76, y + 2, displayText(card), {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#dce8f2',
      wordWrap: { width: 150 }
    }));
    this.root.add(this.add.text(x - 76, y + 88, cardLabel(card), {
      fontFamily: 'Arial',
      fontSize: '12px',
      fontStyle: 'bold',
      color: card.type === 'major' ? '#d8a840' : '#7f93a8'
    }));

    // Flavor / fantasy from the canonical arcana lore, to aid the pick.
    const flavor = getCardFlavor(card.id)?.flavor;
    if (flavor) {
      this.root.add(this.add.text(x - 76, y + 106, flavor, {
        fontFamily: 'Georgia, serif', fontSize: '11px', fontStyle: 'italic',
        color: '#9fb1c4', wordWrap: { width: 152 }
      }));
    }
  }

  private renderChoiceCardArt(card: Card, x: number, y: number) {
    const key = cardArtKey(card);
    if (!key || !this.textures.exists(key)) return;

    const art = this.add.image(x, y, key)
      .setDisplaySize(186, 248)
      .setAlpha(0.95);
    this.root.add(art);
    this.root.add(this.add.rectangle(x, y, 186, 248, 0x05101a, 0.4));
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

    const panel = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1060, 570, 0x0d1420, 0.98)
      .setStrokeStyle(3, 0xd8a840, 0.95);
    this.root.add(panel);

    const close = this.add.rectangle(1110, 96, 112, 36, 0x33252b, 0.98)
      .setStrokeStyle(2, 0xff6b57, 0.95)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.closeOverlay());
    this.root.add(close);
    this.root.add(this.add.text(1110, 96, 'Close', {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffd5cc'
    }).setOrigin(0.5));

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
      const y = 176 + index * CARD_REVIEW_ROW_H;
      const selected = selectedEntry?.card.id === card.id;
      const rowBg = this.add.rectangle(x + 150, y + 15, 300, 32, selected ? 0x21344a : 0x141f2f, 0.96)
        .setStrokeStyle(selected ? 2 : 1, selected ? 0xd8a840 : card.upgraded ? 0x24d0d6 : 0x49606d, selected ? 1 : 0.8)
        .setInteractive({ useHandCursor: true });
      rowBg.on('pointerdown', () => this.inspectCard(card.id));
      this.root.add(rowBg);
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

    this.renderCardReviewScrollButton(472, 192, 'Up', this.cardReviewScroll > 0, () => this.scrollCardReview(-1));
    this.renderCardReviewScrollButton(
      472,
      542,
      'Down',
      this.cardReviewScroll < Math.max(0, sorted.length - CARD_REVIEW_VISIBLE_ROWS),
      () => this.scrollCardReview(1)
    );
    this.root.add(this.add.text(424, 568, `${this.cardReviewScroll + 1}-${this.cardReviewScroll + Math.min(CARD_REVIEW_VISIBLE_ROWS, sorted.length - this.cardReviewScroll)} / ${sorted.length}`, {
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
    const button = this.add.rectangle(x, y, 70, 30, enabled ? 0x18283a : 0x101827, enabled ? 0.98 : 0.5)
      .setStrokeStyle(1, enabled ? 0xd8a840 : 0x49606d, enabled ? 0.95 : 0.55);
    if (enabled) {
      button.setInteractive({ useHandCursor: true });
      button.on('pointerdown', onClick);
    }
    this.root.add(button);
    this.root.add(this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'bold',
      color: enabled ? '#ffe1a3' : '#596a78'
    }).setOrigin(0.5));
  }

  private getInspectedCardEntry(cards: Array<{ card: Card; zone: string }>) {
    return cards.find(({ card }) => card.id === this.inspectedCardId) ?? cards[0];
  }

  private renderCardDetailPanel(card: Card, zone: string) {
    const panel = this.add.rectangle(842, 360, 590, 430, 0x111a27, 0.96)
      .setStrokeStyle(2, card.upgraded ? 0x24d0d6 : card.type === 'major' ? 0xd8a840 : 0x7ab8d6, 0.95);
    this.root.add(panel);

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
    this.root.add(this.add.text(840, 242, `Target: ${targetLabel(card.target)}  Role: ${card.role.toUpperCase()}`, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#b9c7d6'
    }));

    this.root.add(this.add.text(840, 292, 'Current Effect', detailHeaderStyle()));
    this.root.add(this.add.text(840, 318, displayText(card), detailBodyStyle(270)));

    this.root.add(this.add.text(840, 398, 'Preened Effect', detailHeaderStyle()));
    this.root.add(this.add.text(840, 424, card.upgraded ? 'Already preened.' : card.upgradedText, detailBodyStyle(270)));

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
      this.root.add(this.add.rectangle(rx + 132, y + 9, 300, 28, index % 2 === 0 ? 0x141f2f : 0x101827, 0.94));
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
    const stats: Array<[string, string]> = [
      ['Flock Leader', getLeader(this.runLeaderId).name],
      ['Difficulty', difficultyLabel(this.runDifficulty)],
      ['Districts', `${districts} / ${alphaMaps.length}  ·  ${currentMap().name}`],
      ['Encounters cleared', `${this.completedRouteNodeIds.length}`],
      ['Final Cohesion', `${this.flock.hp} / ${this.flock.maxHp}`],
      ['Scrap on hand', `${this.scrap}`],
      ['Deck size', `${this.allDeckCards().length} cards`],
      ['Route Marks', `${this.routeMarks.length}`],
    ];
    stats.forEach((row, index) => {
      const ry = 268 + index * 36;
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

    if (card.target === 'none' || card.target === 'self' || card.target === 'allEnemies' || card.target === 'choice') {
      this.playCard(card);
      return;
    }

    this.selectedInstanceId = this.selectedInstanceId === instanceId ? undefined : instanceId;
    this.renderAll();
  }

  private onEnemyClicked(enemyId: string) {
    this.selectedEnemyId = enemyId;
    const card = this.getSelectedCard();
    if (card?.target === 'enemy') {
      this.playCard(card, enemyId);
      return;
    }
    this.renderAll();
  }

  private playCard(card: Card, enemyId = this.selectedEnemyId) {
    if (this.mode !== 'battle') return;
    const cost = this.effectiveCost(card);
    if (cost > this.energy) return;
    this.energy -= cost;
    this.statCardsPlayed += 1;
    this.cardsPlayedThisTurn += 1;

    const outcome = this.resolveCardEffects(card, enemyId);
    if (card.runtime.suit) this.playedSuitsThisTurn.add(card.runtime.suit);
    this.playedCardIdsThisCombat.add(card.id);
    this.checkNthCardMarks(); // rooftop_shortcut-style relics that trigger on the Nth card

    // (Molt is now a whole-turn transform stance — it no longer breaks on the
    // next card. It ends in endTurn, leaving the flock briefly Open Sky.)

    // A snag like Bad Directions shuffles itself back into the draw pile instead
    // of discarding, so it keeps clogging the hand until removed at a deck node.
    if (outcome.returnSelfToDraw) this.moveCardFromHandToDraw(card.instanceId);
    else this.moveCardFromHandToDiscard(card.instanceId);
    this.selectedInstanceId = undefined;
    this.checkOutcome();
    this.renderAll();
  }

  private resolveCardEffects(card: Card, enemyId: string): EffectResolutionState {
    // While Molting, a card resolves its unique Molt ability (do-different)
    // instead of its normal effect. Cards without one fall back to normal.
    const molting = this.flock.molt && (card.runtime.moltEffects?.length ?? 0) > 0;
    // A preened (upgraded) card uses its stronger PREENED Molt ability if it has one.
    const moltEffects = card.upgraded && card.runtime.upgrade.moltEffects?.length
      ? (card.runtime.upgrade.moltEffects as string[])
      : (card.runtime.moltEffects as string[]);
    const effects = molting
      ? moltEffects
      : (card.upgraded ? card.runtime.upgrade.effects : card.runtime.effects);
    if (molting) {
      const moltLabel = card.upgraded && card.moltTextUpgraded ? card.moltTextUpgraded : card.moltText;
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

    const targetWinded = this.enemies.find((e) => e.id === enemyId)?.weak ?? 0;
    const value = parseEffectValue(parsed.args[1] ?? parsed.args[0], state.previousDiscarded, targetWinded, this.flock.block);
    switch (parsed.name) {
      case 'damage':
        state.previousDamageDefeated = this.damageEnemy(enemyId, value, displayName(card));
        this.buildFlow(state);
        break;
      case 'damageAll':
        state.previousDamageDefeated = false;
        this.enemies
          .filter((enemy) => enemy.hp > 0)
          .forEach((enemy) => {
            if (this.damageEnemy(enemy.id, value, displayName(card))) state.previousDamageDefeated = true;
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
          state.previousDamageDefeated = this.damageEnemy(enemyId, burst, displayName(card));
          this.logEvent(`${displayName(card)} releases ${spent} Resonance for ${burst} damage.`);
          const rbView = this.enemyView(this.getEnemy(enemyId));
          floatingText(this, this.fxLayer, rbView.x, rbView.y - 90, 'Resonance Burst!', '#8df4ff');
        }
        this.spark = 0;
        state.spentResonance = spent > 0;
        this.buildFlow(state);
        break;
      }
      case 'windedBurst': {
        // Consume ALL Winded on the target for `value` damage per stack.
        const enemy = this.getEnemy(enemyId);
        const stacks = enemy.weak;
        const burst = stacks * value;
        if (burst > 0) {
          state.previousDamageDefeated = this.damageEnemy(enemyId, burst, displayName(card));
          this.logEvent(`${displayName(card)} bursts ${stacks} Winded for ${burst} damage.`);
          const wbView = this.enemyView(enemy);
          floatingText(this, this.fxLayer, wbView.x, wbView.y - 90, 'Winded Burst!', '#c98bff');
        }
        enemy.weak = 0;
        this.buildFlow(state);
        break;
      }
      case 'applyWinded': {
        const enemy = this.getEnemy(enemyId);
        enemy.weak += value;
        this.logEvent(`${enemy.name} is Winded.`);
        const awView = this.enemyView(enemy);
        floatingText(this, this.fxLayer, awView.x, awView.y - 70, 'Winded', '#c98bff');
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
    const enemy = this.getEnemy(enemyId);
    if (condition === 'firstPlayedThisCombat') return !this.playedCardIdsThisCombat.has(card.id);
    if (condition === 'targetBelowHalf') return enemy.hp <= enemy.maxHp / 2;
    if (condition === 'targetIntendsAttack') return moveDealsDamage(currentMove(enemy));
    if (condition === 'targetWinded') return enemy.weak > 0;
    const windedAtLeast = condition.match(/^windedAtLeast\((\d+)\)$/);
    if (windedAtLeast) return enemy.weak >= Number(windedAtLeast[1]); // rewards stacking Winded
    if (condition === 'hasResonance') return this.spark > 0;
    if (condition === 'spentResonance') return state.spentResonance;
    const resAtLeast = condition.match(/^resonanceAtLeast\((\d+)\)$/);
    if (resAtLeast) return this.spark >= Number(resAtLeast[1]); // hoard payoff (doesn't consume)
    if (condition === 'isMolting') return this.flock.molt;
    if (condition === 'openSky') return this.flock.exposed;
    if (condition === 'fullCohesion') return this.flock.hp >= this.flock.maxHp;
    if (condition === 'cohesionBelowHalf') return this.flock.hp < this.flock.maxHp / 2;
    if (condition === 'defeatsEnemy') return state.previousDamageDefeated;
    if (condition === 'fullyBlocksNextAttack') return this.flock.block >= this.incomingAttackDamage(enemy);
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

  private damageEnemy(enemyId: string, amount: number, source: string) {
    const enemy = this.getEnemy(enemyId);
    let damage = amount + (this.flockStats().damage ?? 0);
    if (this.flock.weak > 0) damage = Math.floor(damage * 0.75);
    // Formation state: Surging birds press harder, Scattered birds flail.
    const formation = this.flockState();
    if (formation === 'surging') damage += 2;
    else if (formation === 'scattered') damage = Math.max(0, Math.floor(damage * 0.75));
    // Quills keystone: the first attack each turn lands +2.
    if (this.firstAttackThisTurn && this.keystoneActive('quills')) damage += 2;
    this.firstAttackThisTurn = false;
    const blocked = Math.min(enemy.block, damage);
    enemy.block -= blocked;
    damage -= blocked;
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.hitThisTurn = true;
    this.statDealt += damage;
    if (enemy.hp <= 0) this.statDefeated += 1;
    this.logEvent(`${source} hits ${enemy.name} for ${damage}.`);
    const view = this.enemyView(enemy);
    const bar = this.enemyHpBar(enemy);
    if (damage > 0) {
      strike(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y, view.x, view.y, 0xffce6b);
      floatingText(this, this.fxLayer, view.x, view.y - 40, `${damage}`, '#ffce6b');
      burst(this, this.fxLayer, view.x, view.y, 0xffce6b, 8);
      if (damage >= 8) shakeCamera(this, 0.004);
      // Drain the lost segment of the enemy HP bar.
      const left = bar.x - bar.w / 2;
      const xNew = left + bar.w * Math.max(0, enemy.hp / enemy.maxHp);
      const xOld = left + bar.w * Math.min(1, (enemy.hp + damage) / enemy.maxHp);
      fadeRect(this, this.fxLayer, (xNew + xOld) / 2, bar.y, xOld - xNew, bar.h - 6, 0xffd0c9);
    } else {
      floatingText(this, this.fxLayer, view.x, view.y - 40, 'Blocked', '#9fb1c4');
    }
    if (enemy.hp <= 0) {
      burst(this, this.fxLayer, view.x, view.y, 0xffe1a3, 16);
      floatingText(this, this.fxLayer, view.x, view.y + 8, 'Down!', '#ffe1a3');
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
    if (block > 0) floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y, `+${block} Cover`, '#7ab8d6');
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
      floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y, `+${healed}`, '#8fd6a0');
    }
    const overheal = healing - healed;
    if (overflowToCover && overheal > 0) {
      this.flock.block += overheal;
      this.logEvent(`${source} overflows into ${overheal} Cover.`);
      floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 22, `+${overheal} Cover`, '#7ab8d6');
    }
  }

  private gainResonance(amount: number) {
    this.spark = Math.min(BASE_RESONANCE_CAP, this.spark + amount);
    this.logEvent(`The flock gains ${amount} Resonance.`);
  }

  private spendResonance(amount: number) {
    if (this.spark < amount) {
      this.logEvent(`The flock needs ${amount} Resonance.`);
      return false;
    }
    this.spark -= amount;
    this.logEvent(`The flock spends ${amount} Resonance.`);
    return true;
  }

  private endTurn() {
    if (this.mode !== 'battle') {
      this.scene.restart();
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

    // Each living enemy telegraphs and resolves its own move, in board order.
    for (const enemy of attackers) {
      if (enemy.hp <= 0) continue;
      enemyMoveContext = { flock: this.flock, turn: this.turn }; // branch on live state per attacker
      const move = currentMove(enemy);
      move.effects.forEach((effect) => this.resolveEnemyEffect(enemy, effect));
      // Advance the move counter; currentMove() maps it through the attack pattern.
      enemy.intentIndex += 1;
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
        break;
      case 'heal':
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + value);
        this.logEvent(`${enemy.name} scavenges ${value} health.`);
        break;
      case 'applyWinded':
        this.flock.weak += value;
        this.logEvent(`${enemy.name} knocks the flock Winded.`);
        floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 30, 'Winded', '#c98bff');
        break;
      case 'applyFrail':
        this.flock.frail += value;
        this.logEvent(`${enemy.name} ruffles the flock — Cover weakened.`);
        floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 30, 'Ruffled', '#ff9d6b');
        break;
      case 'applyOpenSky':
        this.flock.exposed = true;
        this.flock.exposedTurns = Math.max(this.flock.exposedTurns, value);
        this.logEvent(`${enemy.name} throws the flock into Open Sky.`);
        floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 50, 'Open Sky!', '#ff9d4d');
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

  private damageFlock(enemy: Enemy, amount: number) {
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
        // quiet_landing relic: soften the first Open Sky increase each combat.
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
    // An unblocked hit shatters formation Flow; damage fully absorbed by Cover
    // keeps the flock together (Cover earns a second job: holding formation).
    if (damage > 0) this.flock.flow = 0;
    if (damage > 0) {
      const from = this.enemyView(enemy);
      strike(this, this.fxLayer, from.x, from.y, FLOCK_FX_X, FLOCK_FX_Y, 0xff7a6e);
      floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 8, `-${damage}`, '#ff7a6e');
      shakeCamera(this, 0.005);
      // Drain the lost segment of the Cohesion bar.
      const left = FLOCK_HP_BAR.x - FLOCK_HP_BAR.w / 2;
      const xNew = left + FLOCK_HP_BAR.w * Math.max(0, this.flock.hp / this.flock.maxHp);
      const xOld = left + FLOCK_HP_BAR.w * Math.min(1, (this.flock.hp + damage) / this.flock.maxHp);
      fadeRect(this, this.fxLayer, (xNew + xOld) / 2, FLOCK_HP_BAR.y, xOld - xNew, FLOCK_HP_BAR.h - 6, 0xffd0c9);
    } else {
      floatingText(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 8, 'Blocked', '#7ab8d6');
    }
  }

  private chooseRewardCard(cardId: string) {
    const reward = this.rewardChoices.find((card) => card.id === cardId);
    if (!reward) return;
    if (this.hasCardInDeck(reward.id)) {
      this.logEvent(`${displayName(reward)} is already in the deck.`);
      this.rewardChoices = [];
      this.upgradeChoices = this.createUpgradeChoices();
      this.mode = 'upgradeReward';
      this.renderAll();
      return;
    }
    this.discardPile.push(cloneCard(reward.id));
    this.logEvent(`${displayName(reward)} joins the flock.`);
    this.applyFlockStats(false);
    this.runRewardEvents.push({ offered: this.rewardChoices.map((card) => card.id), picked: reward.id, skipped: false });
    this.rewardChoices = [];
    this.upgradeChoices = this.createUpgradeChoices();
    this.mode = 'upgradeReward';
    this.renderAll();
  }

  // Decline the card reward intentionally; take a small Scrap fallback instead
  // (next-level-implementation-spec "rewards support skip or fallback decisions").
  private skipCardReward() {
    this.runRewardEvents.push({ offered: this.rewardChoices.map((card) => card.id), skipped: true });
    this.scrap += REWARD_SKIP_SCRAP;
    this.logEvent(`Skipped the card reward for +${REWARD_SKIP_SCRAP} Scrap.`);
    this.rewardChoices = [];
    this.upgradeChoices = this.createUpgradeChoices();
    this.mode = 'upgradeReward';
    this.renderAll();
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
      this.applyMapStartMarks(); // reopened_roofline-style relics stock the next district
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
    const streetBonus = routeNode?.type === 'street' && this.routeMarks.includes('loose_change_tin') ? STREET_SCRAP_BONUS : 0;
    this.scrap += scrapReward + streetBonus;

    const awardedMark = this.combatRouteMarkReward(routeNode);
    if (awardedMark && !this.routeMarks.includes(awardedMark.id)) {
      this.routeMarks.push(awardedMark.id);
    }

    const routeLog = [
      `${currentMap().name}: ${routeNode?.label ?? 'Encounter'} cleared. +${scrapReward + streetBonus} Scrap.`,
      ...(awardedMark ? [`${awardedMark.name} route mark claimed.`] : []),
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
      rewardEvents: [...this.runRewardEvents]
    };
  }

  private combatRouteMarkReward(routeNode: RouteNode | undefined) {
    if (!routeNode) return undefined;
    const profile = rewardProfileForRouteNode(routeNode);
    const guaranteed = routeNode.type === 'rival' || routeNode.type === 'boss' || profile?.routeMarkGuaranteed;
    if (!guaranteed) return undefined;
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
      const at = Math.floor(Math.random() * (this.drawPile.length + 1));
      this.drawPile.splice(at, 0, card);
    }
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
          this.logEvent('No new crew cards remain; preen an existing card.');
          this.upgradeChoices = this.createUpgradeChoices();
          this.mode = 'upgradeReward';
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
    const summary: RunSummary = {
      id: `run-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      seed: activeSeed,
      result,
      leaderId: this.runLeaderId,
      difficulty: this.runDifficulty,
      mapId: currentMap().id,
      finalNodeId:
        this.completedRouteNodeIds[this.completedRouteNodeIds.length - 1] ??
        currentCombatNodes()[this.currentRouteIndex]?.id ??
        '',
      killedBy: result === 'loss' ? this.enemies.find((enemy) => enemy.hp > 0)?.name : undefined,
      turnsTaken: this.turn,
      currentCohesion: this.flock.hp,
      maxCohesion: this.flock.maxHp,
      scrapEarned: this.scrap,
      scrapSpent: 0,
      path: [...this.completedRouteNodeIds],
      deck: saveCards(this.allDeckCards()),
      routeMarks: [...this.routeMarks],
      suppliesUsed: [],
      signals: [...this.runSignalChoices],
      cardRewards: [...this.runRewardEvents]
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

  private getEnemy(enemyId: string) {
    return this.enemies.find((enemy) => enemy.id === enemyId) ?? this.enemies[0];
  }

  private logEvent(message: string) {
    this.log.push(message);
    this.log = this.log.slice(-8);
  }

  private getTextState(): RenderPayload {
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
      hand: this.hand.map((card) => ({
        instanceId: card.instanceId,
        id: card.id,
        name: displayName(card),
        bird: card.bird,
        cost: this.effectiveCost(card),
        type: card.type,
        target: card.target
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
        supplies: [...this.runSupplies]
      },
      inspectOverlay: this.inspectOverlay,
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
    return {
      id: entry.card.id,
      name: displayName(entry.card),
      bird: entry.card.bird,
      zone: entry.zone,
      cost: this.effectiveCost(entry.card),
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
    rewardEvents: []
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
    rewardEvents: (runState.rewardEvents ?? []).map((entry) => ({ ...entry, offered: [...entry.offered] }))
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

function cardLabel(card: Card) {
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
// anchor (ENEMY_FX_X/Y, full size); 2-4 fan out around x=900 and scale down so
// the cluster stays inside the right half of the board.
function enemyViewAt(index: number, count: number): { x: number; y: number; scale: number } {
  if (count <= 1) return { x: ENEMY_FX_X, y: ENEMY_FX_Y, scale: 1 };
  const step = Math.min(280, 560 / (count - 1));
  const x = Math.round(900 - (step * (count - 1)) / 2 + step * index);
  const scale = count === 2 ? 0.92 : count === 3 ? 0.82 : 0.72;
  return { x, y: ENEMY_FX_Y, scale };
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

function renderSceneCardDetail(scene: Phaser.Scene, card: Card, zone: string, cost: number) {
  scene.add.rectangle(842, 360, 590, 430, 0x111a27, 0.96)
    .setStrokeStyle(2, card.upgraded ? 0x24d0d6 : card.type === 'major' ? 0xd8a840 : 0x7ab8d6, 0.95);

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

// Glyph-first node rendering (next-level-implementation-spec Phase 2 Node Glyphs).
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

function nonCombatLesson(type: RouteNode['type']) {
  switch (type) {
    case 'basin': return 'Recover Cohesion, take shelter for Open Sky Guard, or refill a Supply.';
    case 'nest': return 'Preen or Release a card, or buy a Route Mark to shape the deck.';
    case 'market': return 'Spend Scrap on cards, Route Marks, Supplies, and Preen/Release.';
    case 'signal': return 'A route choice with trade-offs in Scrap, Cohesion, and risk.';
    case 'cache': return 'Choose one reward from the rooftop stash.';
    default: return 'A crossing on the route.';
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
      case 'gainRouteMark': return alphaRouteMarkLibrary.get(a) ? `Gain ${alphaRouteMarkLibrary.get(a)!.name}` : 'Gain a Route Mark';
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
    case 'nest': return 'Preen  ·  Release  ·  Route Mark';
    case 'market': return 'Cards  ·  Route Marks  ·  Supplies';
    case 'signal': return 'Varies by choice';
    case 'cache': return 'Scrap  ·  Supply  ·  Route Mark  ·  card  ·  heal';
    default: return '';
  }
}

function routeNodeRecovery(node: RouteNode, routeMarkIds: string[] = []) {
  if (node.type === 'basin') return 8 + (routeMarkIds.includes('rain_gutter') ? 4 : 0);
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
  if (node.type === 'cache') return `${node.label}: cache found. +${result.scrap ?? 0} Scrap and a route mark if available.`;
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
    type: runtime.kind === 'legend' ? 'major' : runtime.kind === 'molt' ? 'molt' : 'minor',
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
    case 'damageAll':
      return `Deal ${value} to all.`;
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
  rows.forEach((row, index) => {
    const y = topY + 37 + index * 33;
    addTo(scene.add.rectangle(leftX + 250, y + 9, 540, 27, index % 2 === 0 ? 0x141f2f : 0x101827, 0.94));
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
    powerPreference: 'high-performance'
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
