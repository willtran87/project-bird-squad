import type { RuntimeImageAsset } from './runtime-images';

const uiIconRuntimeArtUrls = import.meta.glob('../../assets/runtime/ui/icons/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function uiIconAsset(id: string): RuntimeImageAsset {
  return {
    key: `ui-icon-${id}`,
    url: uiIconRuntimeArtUrls[`../../assets/runtime/ui/icons/${id}.webp`]
      ?? `/assets/runtime/ui/icons/${id}.webp`
  };
}

export function uiIconAssetsFor(ids: readonly string[]): RuntimeImageAsset[] {
  return [...new Set(ids)].map((id) => uiIconAsset(id));
}
