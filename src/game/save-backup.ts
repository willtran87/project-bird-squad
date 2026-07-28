import { MAX_DIFFICULTY } from './difficulty';
import { firstFlightGuideProgress, sanitizeGuide, type FirstFlightGuideProgress } from './first-flight-guide';
import {
  CONTROL_BINDING_DEFINITIONS,
  controlBindingsSnapshot,
  isBindableControlCode,
  type ControlBindings,
} from './input-bindings';
import { loadAccount, sanitizeAccount, type PlayerAccount } from './meta';
import { safeStorageGet, safeStorageRemove, safeStorageSet } from './safe-storage';

const SAVE_FORMAT = 'bird-squad-save';
const SAVE_VERSION = 1;
const MAX_BACKUP_BYTES = 2_000_000;

const JOURNALED_KEYS = {
  account: 'birdsquad.account',
  activeRun: 'birdsquad.run.active',
  runHistory: 'birdsquad.runs',
  guide: 'birdsquad.firstFlightGuide',
} as const;

const PREFERENCE_KEYS = {
  controls: 'birdsquad.controlBindings',
  graphicsQuality: 'birdsquad.graphicsQuality',
  visualContrast: 'birdsquad.visualContrast',
  colorCues: 'birdsquad.colorCues',
  screenShake: 'birdsquad.screenShake',
  flashEffects: 'birdsquad.flashEffects',
  motion: 'birdsquad.motionPreference',
  combatPace: 'birdsquad.combatPace',
  animationPace: 'birdsquad.animationPace',
  textPace: 'birdsquad.textPace',
  screenReader: 'birdsquad.screenReader',
  musicVolume: 'birdsquad.musicVolume',
  sfxVolume: 'birdsquad.sfxVolume',
  ambienceVolume: 'birdsquad.ambienceVolume',
  audioMuted: 'birdsquad.audioMuted',
  maxTier: 'birdsquad.maxTier',
  codexCardLens: 'birdsquad.codexCardLens',
  codexCardSearch: 'birdsquad.codexCardSearch',
  codexCardSort: 'birdsquad.codexCardSort',
} as const;

const ALL_OWNED_STORAGE_KEYS = [
  ...Object.values(JOURNALED_KEYS).flatMap((key) => [key, `${key}.backup`, `${key}.corrupt`]),
  ...Object.values(PREFERENCE_KEYS),
];

export interface SaveBackupPreferences {
  controls: ControlBindings;
  graphicsQuality: 'auto' | 'full' | 'lean';
  visualContrast: 'standard' | 'high';
  colorCues: 'standard' | 'reinforced';
  screenShake: 'on' | 'off';
  flashEffects: 'full' | 'reduced';
  motion: 'system' | 'full' | 'reduced';
  combatPace: 'cinematic' | 'standard' | 'snappy';
  animationPace: 'relaxed' | 'standard' | 'fast';
  textPace: 'relaxed' | 'standard' | 'fast';
  screenReader: 'off' | 'on';
  musicVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  audioMuted: boolean;
  maxTier: number;
  codexCardLens: 'all' | 'collected' | 'uncollected' | 'seen';
  codexCardSearch: string;
  codexCardSort: 'binder' | 'name' | 'rarity' | 'recent';
}

export interface SaveBackupBundle {
  format: typeof SAVE_FORMAT;
  version: typeof SAVE_VERSION;
  exportedAt: string;
  data: {
    account: PlayerAccount;
    activeRun?: unknown;
    runHistory: unknown[];
    guide: FirstFlightGuideProgress;
    preferences: SaveBackupPreferences;
  };
}

export interface SaveBackupRuntimeDependencies {
  currentActiveRun: () => unknown | undefined;
  currentRunHistory: () => unknown[];
  currentPreferences: () => Omit<SaveBackupPreferences, 'codexCardLens' | 'codexCardSearch' | 'codexCardSort'>;
  sanitizeActiveRun: (value: unknown) => unknown | undefined;
  sanitizeRunHistory: (value: unknown) => unknown[] | undefined;
}

export interface SaveRestorePreview {
  bundle: SaveBackupBundle;
  runs: number;
  wins: number;
  activeRun: boolean;
  leaders: number;
  exportedAt: string;
}

export type SaveRestoreParseResult =
  | { ok: true; preview: SaveRestorePreview }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteRange(value: unknown, min: number, max: number) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Number(value))) : undefined;
}

function sanitizeControls(value: unknown): ControlBindings | undefined {
  if (!isRecord(value)) return undefined;
  const result: Partial<ControlBindings> = {};
  const used = new Set<string>();
  for (const definition of CONTROL_BINDING_DEFINITIONS) {
    const code = value[definition.action];
    if (typeof code !== 'string' || !isBindableControlCode(code) || used.has(code)) return undefined;
    result[definition.action] = code;
    used.add(code);
  }
  return result as ControlBindings;
}

function sanitizePreferences(value: unknown): SaveBackupPreferences | undefined {
  if (!isRecord(value)) return undefined;
  const controls = sanitizeControls(value.controls);
  const musicVolume = finiteRange(value.musicVolume, 0, 1);
  const sfxVolume = finiteRange(value.sfxVolume, 0, 1);
  const ambienceVolume = value.ambienceVolume === undefined
    ? musicVolume
    : finiteRange(value.ambienceVolume, 0, 1);
  const maxTier = finiteRange(value.maxTier, 0, MAX_DIFFICULTY);
  const colorCues = value.colorCues === undefined
    ? 'standard'
    : ['standard', 'reinforced'].includes(String(value.colorCues))
      ? value.colorCues as SaveBackupPreferences['colorCues']
      : undefined;
  const screenShake = value.screenShake === undefined
    ? 'on'
    : ['on', 'off'].includes(String(value.screenShake))
      ? value.screenShake as SaveBackupPreferences['screenShake']
      : undefined;
  const flashEffects = value.flashEffects === undefined
    ? 'full'
    : ['full', 'reduced'].includes(String(value.flashEffects))
      ? value.flashEffects as SaveBackupPreferences['flashEffects']
      : undefined;
  const textPace = value.textPace === undefined
    ? 'standard'
    : ['relaxed', 'standard', 'fast'].includes(String(value.textPace))
      ? value.textPace as SaveBackupPreferences['textPace']
      : undefined;
  const animationPace = value.animationPace === undefined
    ? 'standard'
    : ['relaxed', 'standard', 'fast'].includes(String(value.animationPace))
      ? value.animationPace as SaveBackupPreferences['animationPace']
      : undefined;
  const codexCardLens = value.codexCardLens === undefined
    ? 'all'
    : ['all', 'collected', 'uncollected', 'seen'].includes(String(value.codexCardLens))
      ? value.codexCardLens as SaveBackupPreferences['codexCardLens']
      : undefined;
  const codexCardSearch = value.codexCardSearch === undefined
    ? ''
    : typeof value.codexCardSearch === 'string'
      && value.codexCardSearch.length <= 40
      && !/[\u0000-\u001f\u007f]/.test(value.codexCardSearch)
      ? value.codexCardSearch.replace(/\s+/g, ' ').trim()
      : undefined;
  const codexCardSort = value.codexCardSort === undefined
    ? 'binder'
    : ['binder', 'name', 'rarity', 'recent'].includes(String(value.codexCardSort))
      ? value.codexCardSort as SaveBackupPreferences['codexCardSort']
      : undefined;
  if (
    !controls
    || !colorCues
    || !screenShake
    || !flashEffects
    || !animationPace
    || !textPace
    || !codexCardLens
    || codexCardSearch === undefined
    || !codexCardSort
    || !['auto', 'full', 'lean'].includes(String(value.graphicsQuality))
    || !['standard', 'high'].includes(String(value.visualContrast))
    || !['system', 'full', 'reduced'].includes(String(value.motion))
    || !['cinematic', 'standard', 'snappy'].includes(String(value.combatPace))
    || musicVolume === undefined
    || sfxVolume === undefined
    || ambienceVolume === undefined
    || maxTier === undefined
    || typeof value.audioMuted !== 'boolean'
  ) return undefined;
  return {
    controls,
    graphicsQuality: value.graphicsQuality as SaveBackupPreferences['graphicsQuality'],
    visualContrast: value.visualContrast as SaveBackupPreferences['visualContrast'],
    colorCues,
    screenShake,
    flashEffects,
    motion: value.motion as SaveBackupPreferences['motion'],
    combatPace: value.combatPace as SaveBackupPreferences['combatPace'],
    animationPace,
    textPace,
    screenReader: value.screenReader === 'on' ? 'on' : 'off',
    musicVolume,
    sfxVolume,
    ambienceVolume,
    audioMuted: value.audioMuted,
    maxTier: Math.floor(maxTier),
    codexCardLens,
    codexCardSearch,
    codexCardSort,
  };
}

function currentCodexCardLens(): SaveBackupPreferences['codexCardLens'] {
  const value = safeStorageGet(PREFERENCE_KEYS.codexCardLens);
  return value === 'collected' || value === 'uncollected' || value === 'seen' ? value : 'all';
}

function currentCodexCardSearch() {
  const value = safeStorageGet(PREFERENCE_KEYS.codexCardSearch) ?? '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

function currentCodexCardSort(): SaveBackupPreferences['codexCardSort'] {
  const value = safeStorageGet(PREFERENCE_KEYS.codexCardSort);
  return value === 'name' || value === 'rarity' || value === 'recent' ? value : 'binder';
}

export function createSaveBackup(dependencies: SaveBackupRuntimeDependencies): SaveBackupBundle {
  const activeRun = dependencies.currentActiveRun();
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      account: loadAccount(),
      ...(activeRun === undefined ? {} : { activeRun }),
      runHistory: dependencies.currentRunHistory(),
      guide: firstFlightGuideProgress(),
      preferences: {
        ...dependencies.currentPreferences(),
        controls: controlBindingsSnapshot(),
        codexCardLens: currentCodexCardLens(),
        codexCardSearch: currentCodexCardSearch(),
        codexCardSort: currentCodexCardSort(),
      },
    },
  };
}

export function parseSaveBackup(raw: string, dependencies: SaveBackupRuntimeDependencies): SaveRestoreParseResult {
  if (raw.length > MAX_BACKUP_BYTES) return { ok: false, error: 'Backup is larger than the 2 MB safety limit.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (!isRecord(parsed) || parsed.format !== SAVE_FORMAT || parsed.version !== SAVE_VERSION || !isRecord(parsed.data)) {
    return { ok: false, error: 'This is not a compatible Bird Squad backup.' };
  }
  const account = sanitizeAccount(parsed.data.account);
  const runHistory = dependencies.sanitizeRunHistory(parsed.data.runHistory);
  const guide = sanitizeGuide(parsed.data.guide);
  const preferences = sanitizePreferences(parsed.data.preferences);
  const hasActiveRun = Object.prototype.hasOwnProperty.call(parsed.data, 'activeRun');
  const activeRun = hasActiveRun ? dependencies.sanitizeActiveRun(parsed.data.activeRun) : undefined;
  if (!account || !runHistory || !guide || !preferences || (hasActiveRun && activeRun === undefined)) {
    return { ok: false, error: 'Backup data failed schema validation; nothing was changed.' };
  }
  const bundle: SaveBackupBundle = {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : 'Unknown date',
    data: {
      account,
      ...(activeRun === undefined ? {} : { activeRun }),
      runHistory,
      guide,
      preferences,
    },
  };
  return {
    ok: true,
    preview: {
      bundle,
      runs: account.runs,
      wins: account.wins,
      activeRun: activeRun !== undefined,
      leaders: account.unlockedLeaders.length,
      exportedAt: bundle.exportedAt,
    },
  };
}

function serializedEntries(bundle: SaveBackupBundle) {
  const preferences = bundle.data.preferences;
  return new Map<string, string>([
    [JOURNALED_KEYS.account, JSON.stringify(bundle.data.account)],
    ...(bundle.data.activeRun === undefined
      ? []
      : [[JOURNALED_KEYS.activeRun, JSON.stringify(bundle.data.activeRun)] as [string, string]]),
    [JOURNALED_KEYS.runHistory, JSON.stringify(bundle.data.runHistory)],
    [JOURNALED_KEYS.guide, JSON.stringify(bundle.data.guide)],
    [PREFERENCE_KEYS.controls, JSON.stringify({ version: 1, bindings: preferences.controls })],
    [PREFERENCE_KEYS.graphicsQuality, preferences.graphicsQuality],
    [PREFERENCE_KEYS.visualContrast, preferences.visualContrast],
    [PREFERENCE_KEYS.colorCues, preferences.colorCues],
    [PREFERENCE_KEYS.screenShake, preferences.screenShake],
    [PREFERENCE_KEYS.flashEffects, preferences.flashEffects],
    [PREFERENCE_KEYS.motion, preferences.motion],
    [PREFERENCE_KEYS.combatPace, preferences.combatPace],
    [PREFERENCE_KEYS.animationPace, preferences.animationPace],
    [PREFERENCE_KEYS.textPace, preferences.textPace],
    [PREFERENCE_KEYS.screenReader, preferences.screenReader],
    [PREFERENCE_KEYS.musicVolume, preferences.musicVolume.toFixed(2)],
    [PREFERENCE_KEYS.sfxVolume, preferences.sfxVolume.toFixed(2)],
    [PREFERENCE_KEYS.ambienceVolume, preferences.ambienceVolume.toFixed(2)],
    [PREFERENCE_KEYS.audioMuted, preferences.audioMuted ? '1' : '0'],
    [PREFERENCE_KEYS.maxTier, String(preferences.maxTier)],
    [PREFERENCE_KEYS.codexCardLens, preferences.codexCardLens],
    [PREFERENCE_KEYS.codexCardSearch, preferences.codexCardSearch],
    [PREFERENCE_KEYS.codexCardSort, preferences.codexCardSort],
  ]);
}

function restoreSnapshot(snapshot: Map<string, string | null>) {
  for (const key of ALL_OWNED_STORAGE_KEYS) safeStorageRemove(key);
  for (const [key, value] of snapshot) {
    if (value !== null) safeStorageSet(key, value);
  }
}

export function applySaveBackup(bundle: SaveBackupBundle): boolean {
  const snapshot = new Map(ALL_OWNED_STORAGE_KEYS.map((key) => [key, safeStorageGet(key)]));
  const entries = serializedEntries(bundle);
  try {
    for (const key of ALL_OWNED_STORAGE_KEYS) {
      if (!safeStorageRemove(key)) throw new Error('Storage unavailable');
    }
    for (const [key, raw] of entries) {
      if (!safeStorageSet(key, raw)) throw new Error('Storage unavailable');
      if (Object.values(JOURNALED_KEYS).includes(key as typeof JOURNALED_KEYS[keyof typeof JOURNALED_KEYS])) {
        if (!safeStorageSet(`${key}.backup`, raw)) throw new Error('Storage unavailable');
      }
    }
    for (const [key, raw] of entries) {
      if (safeStorageGet(key) !== raw) throw new Error('Storage verification failed');
    }
    return true;
  } catch {
    restoreSnapshot(snapshot);
    return false;
  }
}

export function downloadSaveBackup(bundle: SaveBackupBundle): boolean {
  try {
    const blob = new Blob([`${JSON.stringify(bundle, null, 2)}\n`], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `bird-squad-save-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 0);
    return true;
  } catch {
    return false;
  }
}

export function requestSaveBackupFile(): Promise<string | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.hidden = true;
    let settled = false;
    const settle = (value: string | undefined) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        settle(undefined);
        return;
      }
      if (file.size > MAX_BACKUP_BYTES) {
        settle('');
        return;
      }
      void file.text().then(settle).catch(() => settle(''));
    }, { once: true });
    window.addEventListener('focus', () => window.setTimeout(() => settle(undefined), 120), { once: true });
    document.body.append(input);
    input.click();
  });
}
