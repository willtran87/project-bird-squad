import type { RuntimeImageAsset } from './runtime-images';
import type { RouteNode } from './types';

const marketKitRuntimeArtUrls = import.meta.glob([
  '../../assets/runtime/market-kit/bird-market-background-v1.webp',
  '../../assets/runtime/market-kit/starling-shopkeeper-v1.webp',
  '../../assets/runtime/market-kit/bird-market-sign-v1.webp',
  '../../assets/runtime/market-kit/market-counter-wares-v1.webp',
], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const routeEventRuntimeArtUrls = import.meta.glob([
  '../../assets/runtime/route-events/lantern-roost-shelter-v3.webp',
  '../../assets/runtime/route-events/rooftop-cache-office-v2.webp',
  '../../assets/runtime/route-events/signal-switchboard-v2.webp',
  '../../assets/runtime/route-events/featherwright-studio-v2.webp',
  '../../assets/runtime/route-events/rival-wager-board-v2.webp',
  '../../assets/runtime/route-events/sella-warmwick-v2.webp',
  '../../assets/runtime/route-events/marn-valeclip-v2.webp',
  '../../assets/runtime/route-events/ivo-tallymast-v2.webp',
  '../../assets/runtime/route-events/oren-shearbright-v2.webp',
  '../../assets/runtime/route-events/caldra-pinion-v2.webp',
], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const routeEventPropRuntimeArtUrls = import.meta.glob([
  '../../assets/runtime/route-events/props/basin-hearth-cart-v1.webp',
  '../../assets/runtime/route-events/props/marn-lockbox-cabinet-v1.webp',
  '../../assets/runtime/route-events/props/nest-featherwright-bench-v1.webp',
  '../../assets/runtime/route-events/props/signal-route-switchboard-v1.webp',
], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const routeNodeIconRuntimeArtUrls = import.meta.glob([
  '../../assets/runtime/map-icons/icons/street.webp',
  '../../assets/runtime/map-icons/icons/rival.webp',
  '../../assets/runtime/map-icons/icons/boss.webp',
  '../../assets/runtime/map-icons/icons/basin.webp',
  '../../assets/runtime/map-icons/icons/nest.webp',
  '../../assets/runtime/map-icons/icons/market.webp',
  '../../assets/runtime/map-icons/icons/signal.webp',
  '../../assets/runtime/map-icons/icons/cache.webp',
], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const routeMapBackdropRuntimeArtUrls = import.meta.glob([
  '../../assets/runtime/backdrops/rooftop-blocks-route-map-v1.webp',
  '../../assets/runtime/backdrops/canal-markets-route-map-v1.webp',
  '../../assets/runtime/backdrops/signal-spires-route-map-v1.webp',
  '../../assets/runtime/backdrops/high-roost-route-map-v1.webp',
], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function marketKitAsset(filename: string, key: string): RuntimeImageAsset {
  return {
    key,
    url: marketKitRuntimeArtUrls[`../../assets/runtime/market-kit/${filename}`]
      ?? `/assets/runtime/market-kit/${filename}`
  };
}

function routeEventAsset(filename: string, key: string): RuntimeImageAsset {
  return {
    key,
    url: routeEventRuntimeArtUrls[`../../assets/runtime/route-events/${filename}`]
      ?? `/assets/runtime/route-events/${filename}`
  };
}

function routeEventPropAsset(filename: string, key: string): RuntimeImageAsset {
  return {
    key,
    url: routeEventPropRuntimeArtUrls[`../../assets/runtime/route-events/props/${filename}`]
      ?? `/assets/runtime/route-events/props/${filename}`
  };
}

function routeNodeIconAsset(type: RouteNode['type']): RuntimeImageAsset {
  return {
    key: `route-node-${type}`,
    url: routeNodeIconRuntimeArtUrls[`../../assets/runtime/map-icons/icons/${type}.webp`]
      ?? `/assets/runtime/map-icons/icons/${type}.webp`
  };
}

function routeMapBackdropAsset(filename: string, key: string): RuntimeImageAsset {
  return {
    key,
    url: routeMapBackdropRuntimeArtUrls[`../../assets/runtime/backdrops/${filename}`]
      ?? `/assets/runtime/backdrops/${filename}`
  };
}

export const routeSceneMarketKitAssets = {
  background: marketKitAsset('bird-market-background-v1.webp', 'market-kit-background'),
  shopkeeper: marketKitAsset('starling-shopkeeper-v1.webp', 'market-kit-shopkeeper-starling'),
  sign: marketKitAsset('bird-market-sign-v1.webp', 'market-kit-sign'),
  counter: marketKitAsset('market-counter-wares-v1.webp', 'market-kit-counter-wares')
};

export const routeSceneEventBackdropAssets: Partial<Record<RouteNode['type'], RuntimeImageAsset>> = {
  basin: routeEventAsset('lantern-roost-shelter-v3.webp', 'route-event-lantern-roost-shelter'),
  cache: routeEventAsset('rooftop-cache-office-v2.webp', 'route-event-rooftop-cache-office'),
  market: routeSceneMarketKitAssets.background,
  signal: routeEventAsset('signal-switchboard-v2.webp', 'route-event-signal-switchboard'),
  nest: routeEventAsset('featherwright-studio-v2.webp', 'route-event-featherwright-studio'),
  rival: routeEventAsset('rival-wager-board-v2.webp', 'route-event-rival-wager-board')
};

export const routeSceneEventPropAssets = {
  basinHearthCart: routeEventPropAsset('basin-hearth-cart-v1.webp', 'route-event-prop-basin-hearth-cart'),
  signalSwitchboard: routeEventPropAsset('signal-route-switchboard-v1.webp', 'route-event-prop-signal-route-switchboard'),
  nestFeatherwrightBench: routeEventPropAsset('nest-featherwright-bench-v1.webp', 'route-event-prop-nest-featherwright-bench'),
  marnLockboxCabinet: routeEventPropAsset('marn-lockbox-cabinet-v1.webp', 'route-event-prop-marn-lockbox-cabinet')
};

export const routeSceneEventResidentAssets: Partial<Record<RouteNode['type'], RuntimeImageAsset>> = {
  basin: routeEventAsset('sella-warmwick-v2.webp', 'route-event-resident-sella-warmwick'),
  cache: routeEventAsset('marn-valeclip-v2.webp', 'route-event-resident-marn-valeclip'),
  signal: routeEventAsset('ivo-tallymast-v2.webp', 'route-event-resident-ivo-tallymast'),
  nest: routeEventAsset('oren-shearbright-v2.webp', 'route-event-resident-oren-shearbright'),
  rival: routeEventAsset('caldra-pinion-v2.webp', 'route-event-resident-caldra-pinion')
};

export const routeSceneNodeIconAssets: Record<RouteNode['type'], RuntimeImageAsset> = Object.fromEntries(
  (['street', 'rival', 'boss', 'basin', 'nest', 'market', 'signal', 'cache'] as RouteNode['type'][]).map((type) => [type, routeNodeIconAsset(type)])
) as Record<RouteNode['type'], RuntimeImageAsset>;

export const routeSceneMapBackdropAssets: Record<string, RuntimeImageAsset> = {
  map_01_rooftop_blocks: routeMapBackdropAsset('rooftop-blocks-route-map-v1.webp', 'route-map-backdrop-rooftop-blocks'),
  map_02_canal_markets: routeMapBackdropAsset('canal-markets-route-map-v1.webp', 'route-map-backdrop-canal-markets'),
  map_03_signal_spires: routeMapBackdropAsset('signal-spires-route-map-v1.webp', 'route-map-backdrop-signal-spires'),
  map_04_high_roost: routeMapBackdropAsset('high-roost-route-map-v1.webp', 'route-map-backdrop-high-roost')
};

export function routeSceneMapBackdropAsset(mapId: string) {
  return routeSceneMapBackdropAssets[mapId] ?? routeSceneMapBackdropAssets.map_01_rooftop_blocks;
}

export function routeSceneEssentialArtAssetsFor(mapId: string) {
  return [...Object.values(routeSceneNodeIconAssets), routeSceneMapBackdropAsset(mapId)];
}

const routeSceneEventPropAssetByType: Partial<Record<RouteNode['type'], RuntimeImageAsset>> = {
  basin: routeSceneEventPropAssets.basinHearthCart,
  cache: routeSceneEventPropAssets.marnLockboxCabinet,
  signal: routeSceneEventPropAssets.signalSwitchboard,
  nest: routeSceneEventPropAssets.nestFeatherwrightBench,
};

export function routeSceneEventArtAssetsFor(type: RouteNode['type']) {
  const assets = type === 'market'
    ? Object.values(routeSceneMarketKitAssets)
    : [
      routeSceneEventBackdropAssets[type],
      routeSceneEventResidentAssets[type],
      routeSceneEventPropAssetByType[type],
    ];
  return [...new Map(assets.filter((asset): asset is RuntimeImageAsset => Boolean(asset)).map((asset) => [asset.key, asset])).values()];
}
