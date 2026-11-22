import { safeStorageGet, safeStorageSet } from './safe-storage';

/** Unlocks waiting for their reveal on the title or Collection: `kind:id`
 * lines. Boot-resident, so it only appends; reading, de-duplicating and
 * capping live with the reveal in the lazy engagement chunk. */
export const CEREMONY_KEY = 'birdsquad.ceremony';

export function queueCeremony(kind: 'card' | 'leader' | 'achievement', ids: string[]) {
  for (const id of ids) safeStorageSet(CEREMONY_KEY, `${safeStorageGet(CEREMONY_KEY) ?? ''}\n${kind}:${id}`);
}

/** Drop one waiting reveal: the player is already looking at that unlock. */
export function retireCeremony(kind: 'card' | 'leader' | 'achievement', id: string) {
  const raw = safeStorageGet(CEREMONY_KEY);
  if (!raw) return;
  const entry = `${kind}:${id}`;
  safeStorageSet(CEREMONY_KEY, raw.split(String.fromCharCode(10)).filter(line => line.trim() !== entry).join(String.fromCharCode(10)));
}
