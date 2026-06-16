export type CardKind = 'legend' | 'crew' | 'molt' | 'snag';
export type CardSuit = 'plumes' | 'quills' | 'basins' | 'nests';
export type CardRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type CardTarget = 'enemy' | 'allEnemies' | 'self' | 'none' | 'choice';

export type FlockStatKey =
  | 'cohesion'
  | 'damage'
  | 'cover'
  | 'regen'
  | 'draw'
  | 'resonance'
  | 'moltPower'
  | 'openSkyGuard';

export type FlockStats = Partial<Record<FlockStatKey, number>>;

export interface RuntimeCardUpgrade {
  cost?: number;
  effects: string[];
  flockStats: FlockStats;
  // The PREENED ("+") Molt ability — a stronger version of `moltEffects`,
  // resolved when an upgraded card is played while Molting.
  moltEffects?: string[];
}

export interface RuntimeCard {
  id: string;
  displayName: string;
  bird: string;
  kind: CardKind;
  suit: CardSuit | null;
  rarity: CardRarity;
  cost: number;
  target: CardTarget;
  tags: string[];
  effects: string[];
  // The card's unique "Molt ability" — a qualitatively DIFFERENT effect resolved
  // instead of `effects` while the flock is Molting (do-different, not do-more).
  moltEffects?: string[];
  upgrade: RuntimeCardUpgrade;
  flockStats: FlockStats;
}

export interface RuntimeCardSet {
  version: string;
  project: string;
  basedOn: string[];
  starterDeck: string[];
  rewardPool: string[];
  cards: RuntimeCard[];
}

export type RouteNodeType =
  | 'street'
  | 'rival'
  | 'boss'
  | 'basin'
  | 'nest'
  | 'market'
  | 'signal'
  | 'cache';

export type RouteRisk = 'low' | 'medium' | 'high' | 'boss';
export type EdgePreview = 'known' | 'typeOnly' | 'hidden';

export interface RouteNode {
  id: string;
  column: number;
  lane: number;
  type: RouteNodeType;
  label: string;
  payloadId: string;
  risk: RouteRisk;
  revealed: boolean;
  completed: boolean;
}

export interface RouteEdge {
  from: string;
  to: string;
  locked: boolean;
  preview: EdgePreview;
}

export interface RuntimeRouteMap {
  version: string;
  project: string;
  basedOn: string[];
  id: string;
  name: string;
  index: number;
  seed: string | null;
  entryNodeId: string;
  bossNodeId: string;
  columns: string[][];
  nodes: RouteNode[];
  edges: RouteEdge[];
}

// Enemy moves + attack patterns (next-level-data-contracts §2). A move's intent
// badge and "is attack" are derived from its effects, not a stored type.
export interface EnemyMove {
  id: string;
  label: string;
  effects: string[];
  tags?: string[];
}

export type PatternEntry = { moveId: string; weight?: number; repeat?: 'cannotRepeat' | 'oncePerCombat' };

export type AttackPattern =
  | { type: 'cycle'; moveIds: string[] }
  | { type: 'weighted'; entries: PatternEntry[] }
  | { type: 'conditional'; entries: Array<{ moveId: string; if: string }>; fallback: string }
  | { type: 'scripted'; moveIds: string[]; loopFrom?: number };

export interface EnemyRewards {
  scrap?: [number, number] | number;
  cardReward?: boolean;
  preenChance?: number;
  routeMarkChance?: number;
  preenGuaranteed?: boolean;
  routeMarkGuaranteed?: boolean;
  bossRouteMarkChoices?: number;
  rareCardChoices?: number;
  preen?: number;
  unlocks?: string;
}

export interface RuntimeEnemy {
  id: string;
  name: string;
  // 'elite' is a tougher-than-normal tier that rides on rival route nodes,
  // shown with an Elite crest in combat and worth rival-grade rewards.
  type: 'normal' | 'rival' | 'boss' | 'elite';
  health: number;
  lesson?: string;
  // Descriptive art contract fields. Combat behavior remains driven by moves
  // and attackPattern.
  description: string;
  visualBrief: string;
  silhouette: string;
  artPose: string;
  fightLengthTarget?: [number, number];
  rewardScrap?: number;
  moves: EnemyMove[];
  attackPattern: AttackPattern;
  rewards: EnemyRewards;
}

export interface RuntimeEnemySet {
  version: string;
  project: string;
  basedOn: string[];
  normalEncounters: RuntimeEnemy[];
  rivalEncounters: RuntimeEnemy[];
  bosses: RuntimeEnemy[];
}

// Status registry (next-level-data-contracts §5.5)
export type StatusKind = 'buff' | 'debuff';
export type StatusStack = 'counter' | 'flag';

export interface RuntimeStatus {
  id: string;
  kind: StatusKind;
  stack: StatusStack;
}

export interface RuntimeStatusSet {
  version: string;
  project: string;
  basedOn: string[];
  statuses: RuntimeStatus[];
}

// Reward profiles (next-level-data-contracts §3) — the inline enemy `rewards`
// shape, now named and keyed by id.
export interface RewardProfile {
  id: string;
  scrap?: [number, number] | number;
  cardReward?: boolean;
  preenChance?: number;
  routeMarkChance?: number;
  preenGuaranteed?: boolean;
  routeMarkGuaranteed?: boolean;
  bossRouteMarkChoices?: number;
  rareCardChoices?: number;
  preen?: number;
  unlocks?: string;
}

export interface RewardProfileSet {
  version: string;
  project: string;
  basedOn: string[];
  profiles: RewardProfile[];
}

// Encounters (next-level-data-contracts §4) — a route node resolves to an
// encounter, which resolves enemies + a reward profile.
export type EncounterBand = 'weak' | 'standard' | 'pressure' | 'rival' | 'boss';

export interface RuntimeEncounter {
  id: string;
  name: string;
  mapId: string;
  nodeType: RouteNodeType;
  band: EncounterBand;
  lesson: string;
  tags: string[];
  enemies: string[];
  rewardProfileId: string;
  introText?: string;
  victoryText?: string;
  lossText?: string;
}

export interface RuntimeEncounterSet {
  version: string;
  project: string;
  basedOn: string[];
  encounters: RuntimeEncounter[];
}

// Supplies (next-level-data-contracts §7.1)
export type SupplyCategory = 'snack' | 'flare' | 'tool' | 'call';
export type SupplyRarity = 'common' | 'uncommon' | 'rare';
export type SupplyAnswerType =
  | 'coverNow'
  | 'drawNow'
  | 'wingbeatNow'
  | 'healNow'
  | 'openSkySafety'
  | 'tellControl';
export type SupplyTiming = 'combat' | 'route' | 'either';

export interface RuntimeSupply {
  id: string;
  name: string;
  category: SupplyCategory;
  rarity: SupplyRarity;
  answerType: SupplyAnswerType;
  timing: SupplyTiming;
  effects: string[];
  description: string;
}

export interface RuntimeSupplySet {
  version: string;
  project: string;
  basedOn: string[];
  supplies: RuntimeSupply[];
}

// Basin / Nest / Cache node options (next-level-data-contracts §7.4)
export interface RuntimeNodeOption {
  id: string;
  label: string;
  effects: string[];
  cost?: number;
}

export interface RuntimeNodeOptionSet {
  version: string;
  project: string;
  basedOn: string[];
  options: RuntimeNodeOption[];
}

// Route Marks (next-level-data-contracts §6)
export type RouteMarkFamily = 'safety' | 'economy' | 'route' | 'suit' | 'molt' | 'bossPrep';
export type RouteMarkSource = 'street' | 'rival' | 'boss' | 'market' | 'signal' | 'cache' | 'nest';
export type RouteMarkRarity = 'common' | 'uncommon' | 'rare' | 'boss';

export interface RuntimeRouteMark {
  id: string;
  name: string;
  family: RouteMarkFamily;
  source: RouteMarkSource;
  rarity: RouteMarkRarity;
  trigger: string;
  effect: string;
  description: string;
}

export interface RuntimeRouteMarkSet {
  version: string;
  project: string;
  basedOn: string[];
  routeMarks: RuntimeRouteMark[];
}

// Market (next-level-data-contracts §9)
export interface MarketPriceBand {
  base: number;
  min: number;
  max: number;
}

export interface MarketCardSlot {
  rarity: 'common' | 'uncommon' | 'rare' | 'weighted';
  price: MarketPriceBand;
}

export interface MarketRouteMarkSlot {
  selector: 'nonBoss';
  price: MarketPriceBand;
}

export interface MarketSupplySlot {
  selector: 'pool';
  price: MarketPriceBand;
}

export interface MarketService {
  id: 'preen' | 'release';
  basePrice: number;
  priceIncrease?: number;
  discountRouteMarkIds?: string[];
}

export interface MarketConfig {
  id: string;
  cardSlots: MarketCardSlot[];
  routeMarkSlots: MarketRouteMarkSlot[];
  supplySlots: MarketSupplySlot[];
  services: MarketService[];
}

export interface RuntimeMarketSet {
  version: string;
  project: string;
  basedOn: string[];
  markets: MarketConfig[];
}

// Signals (next-level-data-contracts §7.2)
export interface SignalChoice {
  key: string;
  text: string;
  requirements?: string[];
  lockedText?: string;
  outcomes: string[];
  proceed?: boolean;
}

export interface RuntimeSignal {
  id: string;
  title: string;
  mapId: string;
  prompt: string;
  choices: SignalChoice[];
}

export interface RuntimeSignalSet {
  version: string;
  project: string;
  basedOn: string[];
  signals: RuntimeSignal[];
}

// Map design profiles (next-level-implementation-spec Phase 6)
export interface MapDesignProfile {
  mapId: string;
  thesis: string;
  primaryTests: string[];
  preferredNodeTypes: RouteNodeType[];
  encounterTags: string[];
  rewardBias: string[];
  bossPrepHints: string[];
}

export interface MapDesignProfileSet {
  version: string;
  project: string;
  basedOn: string[];
  profiles: MapDesignProfile[];
}

// A self-contained district content file (Maps 2-4): its route map plus the
// enemies, encounters, signals, and profile that map needs.
export interface RuntimeMapContent {
  version: string;
  project: string;
  basedOn: string[];
  mapProfile: MapDesignProfile;
  enemies: RuntimeEnemy[];
  encounters: RuntimeEncounter[];
  signals: RuntimeSignal[];
  routeMap: RuntimeRouteMap;
}

export type CardArtStatus = 'approved' | 'placeholder' | 'needs-review';

export interface RuntimeCardArtEntry {
  cardId: string;
  source: string | null;
  portrait: string;
  thumbnail: string;
  icon: string | null;
  version: string;
  status: CardArtStatus;
}

export interface RuntimeCardArtManifest {
  version: string;
  project: string;
  basedOn: string[];
  cards: RuntimeCardArtEntry[];
}

export interface RuntimeEnemyArtEntry {
  enemyId: string;
  source: string;
  full: string;
  version: string;
  status: CardArtStatus;
}

export interface RuntimeEnemyArtManifest {
  version: string;
  project: string;
  basedOn: string[];
  enemies: RuntimeEnemyArtEntry[];
}
