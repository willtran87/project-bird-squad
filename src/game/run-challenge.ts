export type SharedRouteMode = 'full' | 'quick';

export function sharedRouteUrl(seed: string, runMode: SharedRouteMode, href = window.location.href) {
  const url = new URL(href);
  url.search = '';
  url.searchParams.set('flight', seed);
  url.searchParams.set('length', runMode);
  return url.toString();
}

export async function copySharedRouteLink(seed: string, runMode: SharedRouteMode) {
  try {
    await navigator.clipboard.writeText(sharedRouteUrl(seed, runMode));
    return true;
  } catch {
    return false;
  }
}
