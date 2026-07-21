import type { RuntimeImageAsset } from './runtime-images';

const reserveEnemyArtUrls = import.meta.glob('../../assets/runtime/enemies/reserve/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function reserveEnemyArtAsset(id: string): RuntimeImageAsset {
  return {
    key: `reserve-enemy-${id}`,
    url: reserveEnemyArtUrls[`../../assets/runtime/enemies/reserve/${id}.webp`]
      ?? `/assets/runtime/enemies/reserve/${id}.webp`
  };
}

export function reserveEnemyArtAssetsFor(ids: readonly string[]): RuntimeImageAsset[] {
  return ids.map((id) => reserveEnemyArtAsset(id));
}
