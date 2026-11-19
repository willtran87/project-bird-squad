import { setTextureFilter } from './game/texture-filter';
import Phaser from 'phaser';
import { KEYWORD_ICON_IDS } from './game/keyword-definitions';
import { alphaCardArtManifest, alphaEnemyArtManifest, alphaRouteMarkSet } from './game/runtime-data';
import type { RouteNode } from './game/types';
import type { RuntimeImageAsset } from './game/runtime-images';
import { prefersLeanEffects } from './game/graphics-quality';
import { lazyModule } from './game/lazy-module';
import { prefersReducedMotion } from './game/shared/preferences';

const battlefieldRuntimeArtUrls = import.meta.glob([
  '../assets/runtime/backdrops/rooftop-blocks-readability-v2.webp',
  '../assets/runtime/backdrops/canal-markets.webp',
  '../assets/runtime/backdrops/signal-spires.webp',
  '../assets/runtime/backdrops/high-roost.webp',
  '../assets/runtime/backdrops/rooftop-blocks-route-map-v1.webp',
], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const battlefieldVariantRuntimeArtUrls = import.meta.glob([
  '../assets/runtime/backdrops/variants/rooftop-blocks-boss-tar-crow-v1.webp',
  '../assets/runtime/backdrops/variants/canal-markets-boss-gatekeeper-v1.webp',
  '../assets/runtime/backdrops/variants/signal-spires-boss-beacon-breaker-v1.webp',
  '../assets/runtime/backdrops/variants/high-roost-boss-warden-v1.webp',
], {
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
    url: `/assets/runtime/market-kit/${filename}`
  };
}


function routeEventAsset(filename: string, key: string): RuntimeImageAsset {
  return {
    key,
    url: `/assets/runtime/route-events/${filename}`
  };
}


function routeEventPropAsset(filename: string, key: string): RuntimeImageAsset {
  return {
    key,
    url: `/assets/runtime/route-events/props/${filename}`
  };
}


export const MARKET_KIT_ASSETS = {
  background: marketKitAsset('bird-market-background-v1.webp', 'market-kit-background'),
  shopkeeper: marketKitAsset('starling-shopkeeper-v2.webp', 'market-kit-shopkeeper-starling'),
  sign: marketKitAsset('bird-market-sign-v1.webp', 'market-kit-sign'),
  counter: marketKitAsset('market-counter-wares-v1.webp', 'market-kit-counter-wares')
};


export const BATTLEFIELD_ASSETS: Record<string, RuntimeImageAsset> = {
  map_01_rooftop_blocks: {
    key: 'battlefield-rooftop-blocks',
    url: battlefieldRuntimeArtUrls['../assets/runtime/backdrops/rooftop-blocks-readability-v2.webp'] ?? '/assets/runtime/backdrops/rooftop-blocks-readability-v2.webp'
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

export const DEFAULT_BATTLEFIELD_ASSET = BATTLEFIELD_ASSETS.map_01_rooftop_blocks;

export const BATTLEFIELD_BOSS_VARIANTS: Partial<Record<string, RuntimeImageAsset>> = {
  map_01_rooftop_blocks: battlefieldVariantAsset('rooftop-blocks-boss-tar-crow-v1.webp', 'battlefield-rooftop-blocks-boss-tar-crow'),
  map_02_canal_markets: battlefieldVariantAsset('canal-markets-boss-gatekeeper-v1.webp', 'battlefield-canal-markets-boss-gatekeeper'),
  map_03_signal_spires: battlefieldVariantAsset('signal-spires-boss-beacon-breaker-v1.webp', 'battlefield-signal-spires-boss-beacon-breaker'),
  map_04_high_roost: battlefieldVariantAsset('high-roost-boss-warden-v1.webp', 'battlefield-high-roost-boss-warden')
};

export const ROUTE_EVENT_BACKDROP_ASSETS: Partial<Record<RouteNode['type'], RuntimeImageAsset>> = {
  basin: routeEventAsset('lantern-roost-shelter-v3.webp', 'route-event-lantern-roost-shelter'),
  cache: routeEventAsset('rooftop-cache-office-v2.webp', 'route-event-rooftop-cache-office'),
  market: MARKET_KIT_ASSETS.background,
  signal: routeEventAsset('signal-switchboard-v2.webp', 'route-event-signal-switchboard'),
  nest: routeEventAsset('featherwright-studio-v2.webp', 'route-event-featherwright-studio'),
  rival: routeEventAsset('rival-wager-board-v2.webp', 'route-event-rival-wager-board')
};

export const ROUTE_EVENT_PROP_ASSETS = {
  basinHearthCart: routeEventPropAsset('basin-hearth-cart-v1.webp', 'route-event-prop-basin-hearth-cart'),
  signalSwitchboard: routeEventPropAsset('signal-route-switchboard-v1.webp', 'route-event-prop-signal-route-switchboard'),
  nestFeatherwrightBench: routeEventPropAsset('nest-featherwright-bench-v1.webp', 'route-event-prop-nest-featherwright-bench'),
  marnLockboxCabinet: routeEventPropAsset('marn-lockbox-cabinet-v1.webp', 'route-event-prop-marn-lockbox-cabinet')
};

export const DEFAULT_ROUTE_MAP_BACKDROP_ASSET: RuntimeImageAsset = {
  key: 'route-map-backdrop-rooftop-blocks',
  url: battlefieldRuntimeArtUrls['../assets/runtime/backdrops/rooftop-blocks-route-map-v1.webp']
    ?? '/assets/runtime/backdrops/rooftop-blocks-route-map-v1.webp'
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

const flockLeaderRuntimeArtUrls = import.meta.glob('../assets/runtime/flock/leaders/*-back-ne.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const waymarkRuntimeArtUrls = import.meta.glob('../assets/runtime/waymarks/icons/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const waymarkThumbRuntimeArtUrls = import.meta.glob('../assets/runtime/waymarks/thumb/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const supplyRuntimeArtUrls = import.meta.glob('../assets/runtime/supplies/icons/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const supplyThumbRuntimeArtUrls = import.meta.glob('../assets/runtime/supplies/thumb/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function bundledAssetUrl(manifestPath: string, urls: Record<string, string>) {
  return urls[`../${manifestPath}`] ?? `/${manifestPath}`;
}


function runtimeUiIconAsset(id: string): RuntimeImageAsset {
  return {
    key: `ui-icon-${id}`,
    url: `/assets/runtime/ui/icons/${id}.webp`
  };
}


export const cardArtAssets: Record<string, RuntimeImageAsset> = Object.fromEntries(
  alphaCardArtManifest.cards
    .filter((entry) => entry.status === 'approved')
    .map((entry) => [entry.cardId, {
      key: `card-${entry.cardId}`,
      url: bundledAssetUrl(entry.portrait, cardRuntimeArtUrls)
    }])
);

export const cardThumbArtAssets: Record<string, RuntimeImageAsset> = Object.fromEntries(
  alphaCardArtManifest.cards
    .filter((entry) => entry.status === 'approved')
    .map((entry) => [entry.cardId, {
      key: `card-thumb-${entry.cardId}`,
      url: bundledAssetUrl(entry.thumbnail, cardThumbRuntimeArtUrls)
    }])
);

export const snagCardBorderAsset: RuntimeImageAsset = {
  key: 'card-border-snag',
  url: bundledAssetUrl('assets/runtime/cards/borders/snag-border.webp', cardBorderRuntimeArtUrls)
};

export const enemyArtAssets: Record<string, RuntimeImageAsset> = Object.fromEntries(
  alphaEnemyArtManifest.enemies
    .filter((entry) => entry.status === 'approved')
    .map((entry) => [entry.enemyId, {
      key: `enemy-${entry.enemyId}`,
      url: bundledAssetUrl(entry.full, enemyRuntimeArtUrls)
    }])
);


export function reserveEnemyArtAsset(id: string): RuntimeImageAsset {
  return {
    key: `reserve-enemy-${id}`,
    url: `/assets/runtime/enemies/reserve/${id}.webp`
  };
}

export const flockLeaderArtAssets: Record<string, RuntimeImageAsset> = {
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

export const ROUTE_EVENT_RESIDENT_ASSETS: Partial<Record<RouteNode['type'], RuntimeImageAsset>> = {
  basin: routeEventAsset('sella-warmwick-v2.webp', 'route-event-resident-sella-warmwick'),
  cache: routeEventAsset('marn-valeclip-v3.webp', 'route-event-resident-marn-valeclip'),
  signal: routeEventAsset('ivo-tallymast-v3.webp', 'route-event-resident-ivo-tallymast'),
  nest: routeEventAsset('oren-shearbright-v3.webp', 'route-event-resident-oren-shearbright'),
  rival: routeEventAsset('caldra-pinion-v3.webp', 'route-event-resident-caldra-pinion')
};

export const ROUTE_SET_PIECE_PROFILES: Partial<Record<RouteNode['type'], {
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
    visitLine: 'Sella keeps a warm perch ready. Rest the flock, shelter from the next crossing, or pack a Supply.'
  },
  cache: {
    residentName: 'Marn Valeclip',
    residentRole: 'Lockbox Archivist',
    species: 'hooded crow',
    fashion: 'numbered archive coat, wax-tag straps, quiet salvage-office tailoring',
    centerpiece: 'sealed pulley cache cabinet',
    visitLine: 'Marn unlocks the stash. Choose one drawer for the flight ahead, or leave its contents untouched.'
  },
  signal: {
    residentName: 'Ivo Tallymast',
    residentRole: 'Wire Cartographer',
    species: 'kestrel',
    fashion: 'signal-runner sash, lens cords, chalk tabs, lean rooftop technician gear',
    centerpiece: 'illuminated switchboard route map',
    visitLine: 'Ivo traces the crossings ahead. Weigh the route, the reward, and what the flock can afford to risk.'
  },
  nest: {
    residentName: 'Oren Shearbright',
    residentRole: 'Featherwright Tailor',
    species: 'pileated woodpecker',
    fashion: 'tailored work smock, measuring cords, lacquered tool pockets, boutique repairwear',
    centerpiece: 'lit grooming chair and feather press',
    visitLine: 'Oren lays out the tools. Preen a trusted card, remove dead weight, or prepare the flock for what comes next.'
  },
  rival: {
    residentName: 'Caldra Pinion',
    residentRole: 'Velvet Wager Broker',
    species: 'peafowl',
    fashion: 'glossy statement capelet, jewel pins, wager-table evening streetwear',
    centerpiece: 'contract case and prize board',
    visitLine: 'Caldra offers a wager at the crossing. Read the stakes before putting the flock on the line.'
  }
};

export const waymarkArtAssets: Record<string, RuntimeImageAsset> = Object.fromEntries(
  alphaRouteMarkSet.routeMarks.map((mark) => [mark.id, {
    key: `waymark-${mark.id}`,
    url: waymarkRuntimeArtUrls[`../assets/runtime/waymarks/icons/${mark.id}.webp`]
      ?? `/assets/runtime/waymarks/icons/${mark.id}.webp`
  }])
);

export const supplyArtAssets: Record<string, RuntimeImageAsset> = Object.fromEntries(
  Object.entries(supplyRuntimeArtUrls).map(([path, url]) => {
    const id = path.split('/').pop()?.replace(/\.webp$/, '') ?? path;
    return [id, { key: `supply-${id}`, url }];
  })
);

export const waymarkCompactArtAssets: Record<string, RuntimeImageAsset> = Object.fromEntries(
  alphaRouteMarkSet.routeMarks.map((mark) => [mark.id, {
    key: `waymark-thumb-${mark.id}`,
    url: waymarkThumbRuntimeArtUrls[`../assets/runtime/waymarks/thumb/${mark.id}.webp`]
      ?? `/assets/runtime/waymarks/thumb/${mark.id}.webp`
  }])
);

export const supplyCompactArtAssets: Record<string, RuntimeImageAsset> = Object.fromEntries(
  Object.entries(supplyThumbRuntimeArtUrls).map(([path, url]) => {
    const id = path.split('/').pop()?.replace(/\.webp$/, '') ?? path;
    return [id, { key: `supply-thumb-${id}`, url }];
  })
);

export const scrapArtAsset: RuntimeImageAsset = {
  key: 'resource-scrap',
  url: supplyThumbRuntimeArtUrls['../assets/runtime/supplies/thumb/scrap.webp']
    ?? '/assets/runtime/supplies/thumb/scrap.webp'
};

const rewardBadgeArtAssets: Record<string, RuntimeImageAsset> = {
  card: runtimeUiIconAsset('reward-card-badge'),
  waymark: runtimeUiIconAsset('reward-waymark-badge'),
  supply: runtimeUiIconAsset('reward-supply-badge'),
  preen: runtimeUiIconAsset('reward-preen-badge'),
  heal: runtimeUiIconAsset('reward-heal-badge'),
  scrap: runtimeUiIconAsset('reward-scrap-badge')
};

const routeRewardSparkBurstAsset = runtimeUiIconAsset('reward-spark-burst');

const routeRewardRevealHaloAsset = runtimeUiIconAsset('reward-reveal-halo');

function setSupplyArtPixelFilter(scene: Phaser.Scene, key: string) {
  if (!scene.textures.exists(key)) return;
  setTextureFilter(scene.textures.get(key), Phaser.Textures.FilterMode.NEAREST);
}


export function addSupplyArtImage(scene: Phaser.Scene, x: number, y: number, key: string) {
  setSupplyArtPixelFilter(scene, key);
  return scene.add.image(x, y, key);
}


function addRewardBadgeArtImage(scene: Phaser.Scene, badgeId: string, x: number, y: number, size: number) {
  const asset = rewardBadgeArtAssets[badgeId];
  if (!asset || !scene.textures.exists(asset.key)) return undefined;
  setTextureFilter(scene.textures.get(asset.key), badgeId === 'card' || badgeId === 'waymark' || badgeId === 'preen' || badgeId === 'heal' || badgeId === 'supply' || badgeId === 'scrap' ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST);
  return scene.add.image(x, y, asset.key).setDisplaySize(size, size);
}


function addRewardSparkBurstFx(scene: Phaser.Scene, x: number, y: number, size: number) {
  if (!scene.textures.exists(routeRewardSparkBurstAsset.key)) return [];
  setTextureFilter(scene.textures.get(routeRewardSparkBurstAsset.key), Phaser.Textures.FilterMode.LINEAR);
  const objects: Phaser.GameObjects.GameObject[] = [];
  const burst = scene.add.image(x, y, routeRewardSparkBurstAsset.key)
    .setDisplaySize(size, size)
    .setAlpha(prefersReducedMotion() ? 0.32 : 0.42)
    .setBlendMode(Phaser.BlendModes.ADD);
  objects.push(burst);
  if (!prefersReducedMotion() && !prefersLeanEffects()) {
    scene.tweens.add({
      targets: burst,
      alpha: 0.2,
      scaleX: burst.scaleX * 1.08,
      scaleY: burst.scaleY * 1.08,
      angle: 8,
      duration: 920,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    const emitter = scene.add.particles(x, y, routeRewardSparkBurstAsset.key, {
      emitting: false,
      frequency: -1,
      lifespan: { min: 420, max: 760 },
      speed: { min: 8, max: 32 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.075, end: 0.012, ease: 'Cubic.easeOut' },
      alpha: { start: 0.42, end: 0, ease: 'Cubic.easeIn' },
      rotate: { min: -28, max: 28 },
      blendMode: Phaser.BlendModes.ADD,
      maxParticles: 5,
      reserve: 5
    });
    emitter.explode(5);
    scene.time.delayedCall(900, () => {
      if (emitter.active) emitter.destroy();
    });
    objects.push(emitter);
  }
  return objects;
}


export function addRewardRevealHaloFx(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height = width,
  alpha = 0.32
) {
  if (!scene.textures.exists(routeRewardRevealHaloAsset.key)) return undefined;
  setTextureFilter(scene.textures.get(routeRewardRevealHaloAsset.key), Phaser.Textures.FilterMode.LINEAR);
  const halo = scene.add.image(x, y, routeRewardRevealHaloAsset.key)
    .setDisplaySize(width, height)
    .setAlpha(prefersReducedMotion() ? Math.min(alpha, 0.22) : alpha)
    .setBlendMode(Phaser.BlendModes.ADD);
  if (!prefersReducedMotion() && !prefersLeanEffects()) {
    scene.tweens.add({
      targets: halo,
      alpha: alpha * 0.58,
      scaleX: halo.scaleX * 1.045,
      scaleY: halo.scaleY * 1.045,
      angle: 5,
      duration: 1320,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
  return halo;
}


function setWaymarkArtPixelFilter(scene: Phaser.Scene, key: string) {
  if (!scene.textures.exists(key)) return;
  setTextureFilter(scene.textures.get(key), Phaser.Textures.FilterMode.NEAREST);
}


export function addWaymarkArtImage(scene: Phaser.Scene, x: number, y: number, key: string) {
  setWaymarkArtPixelFilter(scene, key);
  return scene.add.image(x, y, key);
}


export const routeNodeIconAssets: Record<RouteNode['type'], RuntimeImageAsset> = Object.fromEntries(
  (['street', 'rival', 'boss', 'basin', 'nest', 'market', 'signal', 'cache'] as RouteNode['type'][]).map((type) => [type, {
    key: `route-node-${type}`,
    url: `/assets/runtime/map-icons/icons/${type}.webp`
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
  'market-offer-tray',
  'market-detail-dossier-frame',
  'market-enamel-command-frame',
  'market-service-button-frame',
  'market-item-label-frame',
  'market-card-price-tag-frame',
  'market-sold-slat-frame',
  'market-object-backplate-frame',
  'market-section-header-frame',
  'market-vendor-title-plaque',
  'market-price-chip-frame',
  'market-supply-crate',
  'market-waymark-badge',
  'market-preen-service',
  'market-remove-service',
  'market-refresh-service',
  'market-boss-rigging-service',
  'market-route-plan-service',
  'market-purchase-flourish',
  'draw-stack',
  'discard-basket',
  'roost-nest',
  'back-chevron',
  'close-medallion',
  'scroll-up-chevron',
  'scroll-down-chevron',
  'route-pin',
  'reward-card-badge',
  'reward-waymark-badge',
  'reward-supply-badge',
  'reward-preen-badge',
  'reward-heal-badge',
  'reward-scrap-badge',
  'reward-spark-burst',
  'reward-reveal-halo',
  'reward-choice-spotlight',
  'reward-choice-glow-burst',
  'reward-choice-hover-ring',
  'reward-choice-card-frame',
  'reward-ceremony-backdrop',
  'route-map-frame',
  'route-node-tooltip-frame',
  'route-risk-meter-frame',
  'route-commit-tooltip-frame',
  'route-selected-node-ring',
  'route-neutral-medallion',
  'route-commit-medallion',
  'open-sky-medallion',
  'sky-guard-medallion',
  'route-scout-medallion',
  'route-control-medallion',
  'route-preen-medallion',
  'route-supply-medallion',
  'route-supply-feedback-frame',
  'route-waymark-medallion',
  'route-card-medallion',
  'route-release-medallion',
  'route-snag-medallion',
  'route-rival-medallion',
  'route-scrap-medallion',
  'route-cohesion-medallion',
  'route-cover-medallion',
  'route-district-banner',
  'district-advance-flourish',
  'district-advance-title-plaque',
  'route-event-title-plaque',
  'route-boss-beacon-ring',
  'route-choice-decision-frame',
  'route-choice-option-frame',
  'route-choice-detail-frame',
  'route-choice-preview-row-frame',
  'boss-prep-dossier-flourish',
  'boss-prep-readiness-chip-frame',
  'boss-prep-pressure-plaque',
  'boss-prep-signal-module',
  'boss-prep-route-for-plate',
  'market-basket',
  'refresh-ring',
  'preen-kit',
  'release-card',
  'locked-padlock',
  'cache-lockbox-medallion',
  'audio-toggle-medallion',
  'audio-toggle-pulse-ring',
  'audio-toggle-wave-burst',
  'run-outcome-crest',
  'run-outcome-flourish',
  'run-outcome-stat-row-frame',
  'run-outcome-command-frame',
  'run-outcome-report-frame',
  'run-outcome-title-plaque',
  'progression-unlock-flourish',
  'overlay-panel-flourish',
  'system-menu-command-frame',
  'system-field-command-frame',
  'system-overlay-title-plaque',
  'system-settings-row-frame',
  'system-settings-toggle-frame',
  'system-settings-volume-slider-frame',
  'system-settings-motion-switch-frame',
  'system-pause-detail-row-frame',
  'confirm-exit-frame',
  'confirm-exit-command-frame',
  'how-to-play-guide-frame',
  'how-to-play-topic-card-frame',
  'how-to-play-tip-row-frame',
  'card-picker-scroll-button-frame',
  'card-picker-page-indicator-frame',
  'route-event-cancel-command-frame',
  'overlay-close-command-frame',
  'deck-review-flourish',
  'deck-review-scroll-button-frame',
  'deck-review-row-frame',
  'deck-review-page-indicator-frame',
  'deck-review-title-plaque',
  'deck-review-detail-frame',
  'deck-review-cost-badge',
  'deck-review-meta-chip-frame',
  'deck-review-section-tab-frame',
  'flock-stats-flourish',
  'flock-stats-title-plaque',
  'flock-stats-caption-frame',
  'flock-stats-footer-frame',
  'flock-stats-header-frame',
  'flock-stats-row-frame',
  'run-kit-item-tile-frame',
  'run-kit-empty-slot-frame',
  'reward-header-plaque',
  'reward-deck-need-chip-frame',
  'reward-skip-command-frame',
  'card-hover-dossier-frame',
  'card-hover-stat-chip-frame',
  'reward-choice-hover-ring',
  'codex-dossier-frame',
  'codex-entry-frame',
  'codex-art-preview-frame',
  'codex-back-command-frame',
  'codex-tab-frame',
  'codex-close-command-frame',
  'codex-scroll-cue-frame',
  'codex-grid-scroll-cue-frame',
  'run-kit-drawer-flourish',
  'battle-hud-command-rail',
  'combat-cohesion-gauge-frame',
  'route-waymark-scroll-rail-frame',
  'combat-pile-dock',
  'combat-pile-review-frame',
  'combat-pile-row-frame',
  'combat-pile-scroll-button-frame',
  'combat-pile-count-badge',
  'combat-pile-detail-chip-frame',
  'combat-pile-stat-chip-frame',
  'combat-pile-title-plaque',
  'combat-pile-page-indicator-frame',
  'combat-roost-command-frame',
  'combat-log-frame',
  'combat-log-event-bead',
  'combat-tooltip-frame',
  'combat-incoming-forecast-frame',
  'combat-beat-progress-frame',
  'combat-hud-metric-chip-frame',
  'combat-suit-keystone-chip-frame',
  'combat-stats-tally-frame',
  'combat-stats-tally-row-frame',
  'combat-stats-tally-title-plaque',
  'combat-hand-rail',
  'combat-hand-selected-pulse',
  'combat-hand-card-frame',
  'combat-enemy-vitals-frame',
  'combat-enemy-status-chip-frame',
  'combat-encounter-plaque',
  'combat-supply-feedback-frame',
  'combat-waymark-feedback-frame',
  'enemy-intent-ring',
  'combat-elite-crest',
  'pause-medallion',
  'settings-medallion',
  'codex-medallion',
  'codex-cards-medallion',
  'codex-major-medallion',
  'codex-aviary-medallion',
  'codex-plumes-medallion',
  'codex-quills-medallion',
  'codex-basins-medallion',
  'codex-nests-medallion',
  'codex-snags-medallion',
  'codex-items-medallion',
  'codex-items-all-medallion',
  'codex-waymark-medallion',
  'codex-waymark-all-medallion',
  'codex-waymark-shelter-medallion',
  'codex-waymark-tempo-medallion',
  'codex-waymark-economy-medallion',
  'codex-waymark-suit-medallion',
  'codex-supplies-medallion',
  'codex-supplies-all-medallion',
  'codex-combat-medallion',
  'codex-route-plan-medallion',
  'codex-flexible-medallion',
  'codex-defense-medallion',
  'codex-recovery-medallion',
  'codex-momentum-medallion',
  'codex-pressure-medallion',
  'codex-molt-medallion',
  'codex-boss-medallion',
  'codex-locked-card-medallion',
  'codex-leader-medallion',
  'codex-enemy-medallion',
  'codex-enemy-all-medallion',
  'codex-enemy-rooftops-medallion',
  'codex-enemy-canals-medallion',
  'codex-enemy-signals-medallion',
  'codex-enemy-roost-medallion',
  'codex-glossary-medallion',
  'record-medallion',
  'help-medallion',
  'start-run-medallion',
  'ascension-medallion',
  'leader-select-medallion',
  'leader-lock-medallion',
  'leader-ready-medallion',
  'title-utility-command-frame',
  'title-leader-card-frame',
  'title-leader-selected-flourish',
  'title-leader-tooltip-frame',
  'title-start-command-frame',
  'title-home-command-dais',
  'title-logo-backplate',
  'title-leader-header-frame',
  'title-ascension-plaque',
  'title-ascension-value-frame',
  'title-ascension-stepper-frame',
  'title-ascension-status-strip',
  'unlock-badge',
] as const;

export type UiIconId = typeof uiIconIds[number];

const keywordUiIconIds = KEYWORD_ICON_IDS as readonly UiIconId[];

function uiIconIdsFor(prefixes: readonly string[], extras: readonly UiIconId[] = []): UiIconId[] {
  const ids = new Set<UiIconId>(extras);
  uiIconIds.forEach((id) => {
    if (prefixes.some((prefix) => id.startsWith(prefix))) ids.add(id);
  });
  return [...ids];
}


export const battleCoreUiIconIds: UiIconId[] = [
  ...keywordUiIconIds,
  'audio-toggle-pulse-ring',
  'audio-toggle-wave-burst',
  'battle-hud-command-rail',
  'card-hover-dossier-frame',
  'card-hover-stat-chip-frame',
  'combat-beat-progress-frame',
  'combat-cohesion-gauge-frame',
  'combat-elite-crest',
  'combat-encounter-plaque',
  'combat-enemy-status-chip-frame',
  'combat-enemy-vitals-frame',
  'combat-hand-card-frame',
  'combat-hand-rail',
  'combat-hand-selected-pulse',
  'combat-hud-metric-chip-frame',
  'combat-incoming-forecast-frame',
  'combat-log-event-bead',
  'combat-log-frame',
  'combat-pile-count-badge',
  'combat-pile-dock',
  'combat-roost-command-frame',
  'combat-supply-feedback-frame',
  'combat-suit-keystone-chip-frame',
  'combat-tooltip-frame',
  'combat-waymark-feedback-frame',
  'enemy-intent-ring',
  'roost-nest',
  'route-pin',
  'scrap-gear',
  'supply-pouch',
  'waymark-compass'
];

export const battleInspectUiIconIds = uiIconIdsFor(
  ['combat-pile-', 'combat-stats-', 'deck-review-', 'flock-stats-'],
  ['card-hover-dossier-frame', 'card-hover-stat-chip-frame', 'overlay-close-command-frame', 'overlay-panel-flourish', 'release-card']
);

export const battleDrawerUiIconIds = uiIconIdsFor(
  ['run-kit-'],
  ['combat-supply-feedback-frame', 'combat-waymark-feedback-frame', 'overlay-close-command-frame', 'route-waymark-scroll-rail-frame']
);

export const battleRewardUiIconIds = uiIconIdsFor(
  ['card-picker-', 'reward-', 'run-outcome-'],
  ['progression-unlock-flourish', 'reward-deck-need-chip-frame', 'reward-header-plaque', 'reward-skip-command-frame', 'unlock-badge']
);

export const battleSystemUiIconIds = uiIconIdsFor(
  ['system-settings-'],
  ['audio-toggle-pulse-ring', 'audio-toggle-wave-burst', 'close-medallion', 'overlay-close-command-frame', 'overlay-panel-flourish', 'system-field-command-frame', 'system-menu-command-frame', 'system-overlay-title-plaque', 'system-pause-detail-row-frame']
);

export const routeUiIconIds = uiIconIdsFor(
  ['boss-prep-', 'card-picker-', 'deck-review-', 'district-advance-', 'flock-stats-', 'market-', 'reward-', 'route-', 'run-kit-', 'system-'],
  ['audio-toggle-pulse-ring', 'cache-lockbox-medallion', 'card-hover-dossier-frame', 'card-hover-stat-chip-frame', 'close-medallion', 'confirm-exit-command-frame', 'confirm-exit-frame', 'deck-stack', 'flock-heart', 'locked-padlock', 'open-sky-medallion', 'overlay-close-command-frame', 'overlay-panel-flourish', 'scrap-gear', 'sky-guard-medallion', 'supply-pouch', 'waymark-compass']
);

export const routeEssentialUiIconIds: UiIconId[] = [
  'route-map-frame',
  'route-selected-node-ring',
  'route-commit-medallion',
];

export const battleEssentialUiIconIds: UiIconId[] = [
  'flock-heart',
  'battle-hud-command-rail',
  'combat-cohesion-gauge-frame',
  'combat-roost-command-frame',
  'combat-hand-card-frame',
  'combat-enemy-vitals-frame',
  'enemy-intent-ring'
];

export const titleMenuCompactIconIds = [
  'ascension-medallion',
  'audio-toggle-medallion',
  'audio-toggle-pulse-ring',
  'audio-toggle-wave-burst',
  'help-medallion',
  'settings-medallion',
  'codex-medallion',
  'record-medallion',
  'start-run-medallion',
  'leader-lock-medallion',
  'leader-ready-medallion',
  'leader-select-medallion',
] as const satisfies readonly UiIconId[];

export const titleMenuUiIconIds = uiIconIdsFor(['title-'], titleMenuCompactIconIds);

export const howToPlayUiIconIds = uiIconIdsFor(
  ['how-to-play-'],
  ['audio-toggle-medallion', 'audio-toggle-pulse-ring', 'audio-toggle-wave-burst', 'close-medallion', 'help-medallion', 'record-medallion', 'route-pin', 'release-card', 'flock-heart', 'draw-stack', 'preen-kit', 'overlay-close-command-frame', 'overlay-panel-flourish', 'system-field-command-frame', 'system-overlay-title-plaque']
);

export const menuSettingsUiIconIds = uiIconIdsFor(
  ['system-settings-'],
  ['audio-toggle-medallion', 'audio-toggle-pulse-ring', 'audio-toggle-wave-burst', 'close-medallion', 'overlay-close-command-frame', 'overlay-panel-flourish', 'settings-medallion', 'system-field-command-frame', 'system-menu-command-frame', 'system-overlay-title-plaque']
);

export const deferredHowToPlayUiIconIds = howToPlayUiIconIds.filter((id) => !titleMenuUiIconIds.includes(id));

export const deferredMenuSettingsUiIconIds = menuSettingsUiIconIds.filter((id) => !titleMenuUiIconIds.includes(id));

const titleMenuRuntimeArtUrls = import.meta.glob([
  '../assets/runtime/ui/icons/title-*.webp',
], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const titleMenuRuntimeArtById = Object.fromEntries(
  Object.entries(titleMenuRuntimeArtUrls).map(([path, url]) => [path.split('/').pop()?.replace(/\.webp$/i, ''), url]),
) as Record<string, string>;

const titleMenuCompactArtUrls = import.meta.glob('../assets/runtime/ui/icons/title-preload/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const titleMenuCompactArtById = Object.fromEntries(
  Object.entries(titleMenuCompactArtUrls).map(([path, url]) => [
    path.split('/').pop()?.replace(/-title-preload\.webp$/i, ''),
    url,
  ]),
) as Record<string, string>;

export const codexUiIconIds = uiIconIdsFor(
  ['codex-'],
  [
    ...keywordUiIconIds,
    'cache-lockbox-medallion',
    'preen-kit',
    'roost-nest',
    'route-pin',
    'scrap-gear',
    'supply-pouch',
    'waymark-compass',
  ]
).filter((id) => id !== 'codex-medallion');

export const uiIconAssets: Record<UiIconId, RuntimeImageAsset> = Object.fromEntries(
  uiIconIds.map((id) => [id, runtimeUiIconAsset(id)])
) as Record<UiIconId, RuntimeImageAsset>;

export const titleMenuPreloadAssets: RuntimeImageAsset[] = titleMenuUiIconIds.map((id) => ({
  key: uiIconAssets[id].key,
  url: titleMenuCompactArtById[id] ?? titleMenuRuntimeArtById[id] ?? uiIconAssets[id].url,
}));

export const UI_ICON_PREVIEW_SCALE = 2.2;


type UiIconAssetsModule = typeof import('./game/ui-icon-assets');

export const loadUiIconAssetsModule = lazyModule(() => import('./game/ui-icon-assets'));
