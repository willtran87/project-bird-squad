export const CODEX_SAVED_VIEW_STORAGE_KEY = 'birdsquad.codexSavedViews';
export const CODEX_SAVED_VIEW_LIMIT = 4;
export const CODEX_SAVED_VIEW_NAME_LIMIT = 48;
export const CODEX_SAVED_VIEW_QUERY_LIMIT = 40;

export const CODEX_SAVED_VIEW_TABS = [
  { id: 'major', label: 'Major' },
  { id: 'aviary', label: 'Aviary' },
  { id: 'plumes', label: 'Plumes' },
  { id: 'quills', label: 'Quills' },
  { id: 'basins', label: 'Basins' },
  { id: 'nests', label: 'Nests' },
  { id: 'snags', label: 'Snags' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'hunt', label: 'Hunt List' },
] as const;

export const CODEX_SAVED_VIEW_LENSES = [
  { id: 'all', label: 'All' },
  { id: 'collected', label: 'Collected' },
  { id: 'new', label: 'New' },
  { id: 'tagged', label: 'Tagged' },
  { id: 'uncollected', label: 'Uncollected' },
  { id: 'seen', label: 'Seen' },
  { id: 'folio', label: 'In Folios' },
] as const;

export const CODEX_SAVED_VIEW_SORTS = [
  { id: 'binder', label: 'Binder' },
  { id: 'name', label: 'Name' },
  { id: 'rarity', label: 'Rarity' },
  { id: 'recent', label: 'Recent' },
] as const;

export type CodexSavedViewTab = typeof CODEX_SAVED_VIEW_TABS[number]['id'];
export type CodexSavedViewLens = typeof CODEX_SAVED_VIEW_LENSES[number]['id'];
export type CodexSavedViewSort = typeof CODEX_SAVED_VIEW_SORTS[number]['id'];

export interface CodexSavedViewCriteria {
  tab: CodexSavedViewTab;
  lens: CodexSavedViewLens;
  query: string;
  sort: CodexSavedViewSort;
}

export interface CodexSavedView extends CodexSavedViewCriteria {
  id: string;
  name: string;
  createdAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeCodexSavedViewQuery(value: unknown) {
  return typeof value === 'string'
    ? value
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, CODEX_SAVED_VIEW_QUERY_LIMIT)
    : '';
}

function validTab(value: unknown): CodexSavedViewTab | undefined {
  return CODEX_SAVED_VIEW_TABS.find((candidate) => candidate.id === value)?.id;
}

function validLens(value: unknown): CodexSavedViewLens | undefined {
  return CODEX_SAVED_VIEW_LENSES.find((candidate) => candidate.id === value)?.id;
}

function validSort(value: unknown): CodexSavedViewSort | undefined {
  return CODEX_SAVED_VIEW_SORTS.find((candidate) => candidate.id === value)?.id;
}

export function codexSavedViewName(criteria: CodexSavedViewCriteria) {
  const tab = CODEX_SAVED_VIEW_TABS.find((candidate) => candidate.id === criteria.tab)?.label ?? 'Cards';
  const lens = CODEX_SAVED_VIEW_LENSES.find((candidate) => candidate.id === criteria.lens)?.label ?? 'All';
  const sort = CODEX_SAVED_VIEW_SORTS.find((candidate) => candidate.id === criteria.sort)?.label ?? 'Binder';
  const query = sanitizeCodexSavedViewQuery(criteria.query);
  const parts = [tab, lens];
  if (query) parts.push(`“${query}”`);
  if (criteria.sort !== 'binder') parts.push(sort);
  const name = parts.join(' · ');
  return name.length <= CODEX_SAVED_VIEW_NAME_LIMIT
    ? name
    : `${name.slice(0, CODEX_SAVED_VIEW_NAME_LIMIT - 1).trimEnd()}…`;
}

export function codexSavedViewMatches(
  view: CodexSavedViewCriteria,
  criteria: CodexSavedViewCriteria,
) {
  return view.tab === criteria.tab
    && view.lens === criteria.lens
    && view.sort === criteria.sort
    && sanitizeCodexSavedViewQuery(view.query) === sanitizeCodexSavedViewQuery(criteria.query);
}

export function createCodexSavedView(
  criteria: CodexSavedViewCriteria,
  now = Date.now(),
): CodexSavedView {
  const random = globalThis.crypto?.randomUUID?.()
    ?? `${Math.max(1, Math.floor(now)).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id: `view-${random}`.slice(0, 80),
    name: codexSavedViewName(criteria),
    tab: criteria.tab,
    lens: criteria.lens,
    query: sanitizeCodexSavedViewQuery(criteria.query),
    sort: criteria.sort,
    createdAt: Math.max(1, Math.floor(now)),
  };
}

export function sanitizeCodexSavedViews(value: unknown): CodexSavedView[] {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set<string>();
  const views: CodexSavedView[] = [];
  for (const [index, raw] of value.entries()) {
    if (views.length >= CODEX_SAVED_VIEW_LIMIT) break;
    if (!isRecord(raw)) continue;
    const id = typeof raw.id === 'string' ? raw.id.trim().slice(0, 80) : '';
    const tab = validTab(raw.tab);
    const lens = validLens(raw.lens);
    const sort = validSort(raw.sort);
    if (!id || !/^[a-z0-9_-]+$/i.test(id) || usedIds.has(id) || !tab || !lens || !sort) continue;
    const query = sanitizeCodexSavedViewQuery(raw.query);
    const criteria = { tab, lens, query, sort };
    usedIds.add(id);
    views.push({
      id,
      name: codexSavedViewName(criteria),
      ...criteria,
      createdAt: Number.isFinite(raw.createdAt) && Number(raw.createdAt) > 0
        ? Math.floor(Number(raw.createdAt))
        : index + 1,
    });
  }
  return views;
}
