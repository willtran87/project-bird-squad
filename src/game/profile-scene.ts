import Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET } from './theme';
import { alphaCardSet } from './runtime-data';
import { difficultyLabel } from './difficulty';
import { flockLeaders } from './leaders';
import { achievements, isLeaderUnlocked, leaderMastery, loadAccount, saveAccount, type PlayerAccount } from './meta';
import { bindControlActions, controlBindingLabel } from './input-bindings';
import { CARD_SHOWCASE_LIMIT, sanitizeCardShowcase } from './card-showcase';
import { renderOutcomeFlightDetails, type OutcomeFlightDetails } from './boss-dossier';
import { copySharedRouteLink, type SharedRouteMode } from './run-challenge';
import {
  COLLECTION_MILESTONE_COUNT,
  collectionMilestoneSnapshots,
} from './collection-milestones';
import {
  renameSavedDeck,
  sanitizeSavedDecks,
  SAVED_DECK_LIMIT,
  SAVED_DECK_NAME_LIMIT,
  toggleSavedDeckFavorite,
  type SavedDeckRecord,
} from './saved-decks';
import {
  applySaveBackup,
  createSaveBackup,
  downloadSaveBackup,
  parseSaveBackup,
  requestSaveBackupFile,
  type SaveBackupRuntimeDependencies,
  type SaveRestorePreview,
} from './save-backup';

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const UI_FONT = 'Arial';
const UI_BOLD = 'bold';
const UI_ICON_PREVIEW_SCALE = 2.2;
const UI_GOLD = '#ffe1a3';
const UI_MUTED = '#8fa3b6';
const UI_SOFT = '#b9c7d6';
const FLIGHT_LOG_PAGE_SIZE = 7;
const BADGE_PAGE_SIZE = 6;
const SAVED_DECK_PAGE_SIZE = 2;
const UI_FIELD = {
  ink: 0x070b12,
  gold: 0xd8a840,
  brass: 0xf0c36f,
  cyan: 0x7ab8d6,
  green: 0x8fd6a0,
  violet: 0xc9a6ff,
  muted: '#91a6b8',
  warm: '#ffe1a3',
  cyanText: '#8df4ff',
};

const profileUiIconIds = [
  'profile-record-flourish',
  'profile-title-plaque',
  'profile-stat-chip-frame',
  'profile-record-row-frame',
  'profile-section-tab-frame',
  'profile-progress-rail-frame',
  'profile-progress-fill-strip',
  'profile-return-command-frame',
  'achievement-medallion',
  'leader-record-medallion',
  'record-medallion',
] as const;

type ProfileBadgeView = 'achievements' | 'contracts' | 'showcase' | 'folios';
export interface ProfileShowcaseEntry {
  id: string;
  name: string;
  family: string;
  rarity: string;
  artKey?: string;
}
export type PlaytestRatingKey = 'fun' | 'fairness' | 'clarity' | 'replay';
export interface PlaytestExperienceFeedback {
  fun?: number;
  fairness?: number;
  clarity?: number;
  replay?: number;
  updatedAt?: string;
}
export interface LatestPlaytestRun {
  id: string;
  result: 'win' | 'loss';
  feedback?: PlaytestExperienceFeedback;
}
export interface FlightHistoryEntry {
  id: string;
  seed: string;
  result: 'win' | 'loss';
  leader: string;
  difficulty: string;
  runMode: SharedRouteMode;
  completedAtMs: number;
  durationMs: number;
  currentCohesion: number;
  maxCohesion: number;
  turns: number;
  deckSize: number;
  stops: number;
  waymarks: number;
  supplies: number;
}
export interface FlightHistoryReview {
  id: string;
  seed: string;
  runMode: SharedRouteMode;
  subtitle: string;
  details: OutcomeFlightDetails;
}
export type ProfileFocus =
  | 'achievements'
  | 'contracts'
  | 'showcase'
  | 'folios'
  | 'flightLog'
  | 'return'
  | 'saveData'
  | 'saveDownload'
  | 'saveRestore'
  | 'playtestFun'
  | 'playtestFairness'
  | 'playtestClarity'
  | 'playtestReplay'
  | 'playtestExport'
  | 'restoreConfirm'
  | 'restoreCancel';
type UiAdd = (object: Phaser.GameObjects.GameObject) => void;
type FieldFrame = {
  cx: number;
  cy: number;
  w: number;
  h: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export interface ProfileViewState {
  badgeView: ProfileBadgeView;
  badgePage: number;
  focus: ProfileFocus;
  entryFadePlayed: boolean;
  revealBursts: number;
  playtestExportStatus: 'idle' | 'downloaded' | 'empty' | 'failed';
  playtestFeedbackStatus: 'idle' | 'saved' | 'unavailable' | 'failed';
  playtestRunId?: string;
  playtestRunResult?: 'win' | 'loss';
  playtestFeedback: PlaytestExperienceFeedback;
  saveDataOpen: boolean;
  saveDataStatus: 'idle' | 'downloaded' | 'invalid' | 'restoreReady' | 'restoreFailed' | 'restored';
  saveDataMessage: string;
  pendingRestore?: SaveRestorePreview;
  flightLogOpen: boolean;
  flightLogIndex: number;
  flightReviewLoading: boolean;
  flightReviewRequestedId?: string;
  flightReview?: FlightHistoryReview;
  flightReviewAction: 0 | 1;
  flightCopyStatus: 'idle' | 'copied' | 'failed';
  flightLogMessage: string;
  savedDeckIndex: number;
  savedDeckStatus: 'idle' | 'favorited' | 'unfavorited' | 'renamed' | 'failed';
  savedDeckRenameInput?: HTMLInputElement;
}

export interface ProfileSceneDependencies {
  advanceGameTime: (game: Phaser.Game, ms: number) => void;
  audio: {
    isMuted: () => boolean;
    play: (kind: 'profileRecord', volume?: number) => void;
    setMood: (mood: 'menu') => void;
    snapshot: () => {
      muted: boolean;
      mood: 'menu' | 'route' | 'battle' | 'boss' | 'victory' | 'defeat';
      unlocked: boolean;
    };
    toggleMute: () => void;
  };
  districtContracts: ReadonlyArray<{ id: string; name: string; goal: string }>;
  exportRunHistory: () => string;
  flightHistory: () => FlightHistoryEntry[];
  loadFlightReview: (id: string) => Promise<FlightHistoryReview | undefined>;
  latestPlaytestRun: () => LatestPlaytestRun | undefined;
  saveLatestPlaytestFeedback: (feedback: PlaytestExperienceFeedback) => boolean;
  saveData: SaveBackupRuntimeDependencies;
  killTweensForScene: (scene: Phaser.Scene) => void;
  playUiSound: (kind?: 'confirm' | 'close' | 'locked') => void;
  prefersReducedMotion: () => boolean;
  activateAudioToggleControl: (scene: Phaser.Scene) => boolean;
  queueUiIconAssets: (
    scene: Phaser.Scene,
    ids: readonly string[],
    warning: string,
    onComplete?: () => void,
  ) => void;
  cardShowcaseEntry: (id: string) => ProfileShowcaseEntry | undefined;
  queueCardShowcaseAssets: (
    scene: Phaser.Scene,
    ids: readonly string[],
    onComplete?: () => void,
  ) => void;
  renderAudioToggleControl: (scene: Phaser.Scene, addTo: UiAdd, x: number, y: number) => unknown;
  renderCloseControl: (scene: Phaser.Scene, addTo: UiAdd, x: number, y: number, onClick: () => void) => unknown;
  renderFieldButton: (
    scene: Phaser.Scene,
    addTo: UiAdd,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    enabled: boolean,
    onClick: () => void,
    accent?: number,
    soundKind?: 'confirm' | 'close' | false,
  ) => Phaser.GameObjects.Rectangle;
  renderFieldPanel: (
    scene: Phaser.Scene,
    addTo: UiAdd,
    x: number,
    y: number,
    width: number,
    height: number,
    options: { accent: number; fill: number },
  ) => FieldFrame;
}

function playtestExportEnabled() {
  return new URLSearchParams(window.location.search).get('playtest') === '1';
}

function playtestRunPayload(raw: string): unknown[] | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function downloadPlaytestRuns(raw: string): { status: ProfileViewState['playtestExportStatus']; count: number } {
  const runs = playtestRunPayload(raw);
  if (!runs) return { status: 'failed', count: 0 };
  if (runs.length === 0) return { status: 'empty', count: 0 };
  try {
    const blob = new Blob([`${JSON.stringify(runs, null, 2)}\n`], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `bird-squad-runs-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 0);
    return { status: 'downloaded', count: runs.length };
  } catch {
    return { status: 'failed', count: runs.length };
  }
}

function profileIconKey(iconId: string) {
  return `ui-icon-${iconId}`;
}

function addProfileIconImage(scene: Phaser.Scene, iconId: string, x: number, y: number, size: number) {
  const key = profileIconKey(iconId);
  if (!scene.textures.exists(key)) return undefined;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return scene.add.image(x, y, key).setDisplaySize(size * UI_ICON_PREVIEW_SCALE, size * UI_ICON_PREVIEW_SCALE);
}

function leaderPersonalRecord(account: PlayerAccount, leaderId: string) {
  const clears = account.leaderRecords[leaderId]?.clears ?? {};
  let bestFullWinTier = -1;
  let fastestFullWinTurns: number | null = null;
  let fastestQuickWinTurns: number | null = null;
  Object.entries(clears).forEach(([key, record]) => {
    const [mode, tierText] = key.split(':');
    if (mode === 'full') bestFullWinTier = Math.max(bestFullWinTier, Number(tierText));
    if (record.fastestRunTurns === null) return;
    if (mode === 'full') {
      fastestFullWinTurns = fastestFullWinTurns === null ? record.fastestRunTurns : Math.min(fastestFullWinTurns, record.fastestRunTurns);
    } else if (mode === 'quick') {
      fastestQuickWinTurns = fastestQuickWinTurns === null ? record.fastestRunTurns : Math.min(fastestQuickWinTurns, record.fastestRunTurns);
    }
  });
  return { bestFullWinTier, fastestFullWinTurns, fastestQuickWinTurns, clears };
}

function profileFocusOrder(state: ProfileViewState): ProfileFocus[] {
  if (state.flightLogOpen) return ['flightLog'];
  if (!state.saveDataOpen) return ['achievements', 'contracts', 'showcase', 'folios', 'flightLog', 'return', 'saveData'];
  if (state.pendingRestore) return ['restoreConfirm', 'restoreCancel'];
  const order: ProfileFocus[] = ['saveDownload', 'saveRestore'];
  if (playtestExportEnabled()) {
    if (state.playtestRunId) order.push('playtestFun', 'playtestFairness', 'playtestClarity', 'playtestReplay');
    order.push('playtestExport');
  }
  return order;
}

function profileBadgePageCount(state: ProfileViewState) {
  if (state.badgeView === 'showcase') return 1;
  if (state.badgeView === 'folios') {
    return Math.max(1, Math.ceil(sanitizeSavedDecks(loadAccount().decks).length / SAVED_DECK_PAGE_SIZE));
  }
  const total = state.badgeView === 'achievements'
    ? achievements.length + COLLECTION_MILESTONE_COUNT
    : loadAccount().contractBadges.length;
  return Math.max(1, Math.ceil(total / BADGE_PAGE_SIZE));
}

function cycleBadgePage(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  direction: -1 | 1,
) {
  const pageCount = profileBadgePageCount(state);
  const nextPage = Phaser.Math.Clamp(state.badgePage + direction, 0, pageCount - 1);
  if (nextPage === state.badgePage) {
    dependencies.playUiSound('locked');
    return;
  }
  state.badgePage = nextPage;
  if (state.badgeView === 'folios') state.savedDeckIndex = nextPage * SAVED_DECK_PAGE_SIZE;
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function selectedSavedDeck(state: ProfileViewState) {
  const decks = sanitizeSavedDecks(loadAccount().decks);
  state.savedDeckIndex = Phaser.Math.Clamp(state.savedDeckIndex, 0, Math.max(0, decks.length - 1));
  return decks[state.savedDeckIndex];
}

function selectSavedDeck(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  index: number,
) {
  const decks = sanitizeSavedDecks(loadAccount().decks);
  if (decks.length === 0) {
    dependencies.playUiSound('locked');
    return;
  }
  const next = Phaser.Math.Clamp(index, 0, decks.length - 1);
  if (next === state.savedDeckIndex) return;
  state.savedDeckIndex = next;
  state.badgePage = Math.floor(next / SAVED_DECK_PAGE_SIZE);
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function cycleSavedDeck(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  direction: -1 | 1,
) {
  const decks = sanitizeSavedDecks(loadAccount().decks);
  if (decks.length === 0) {
    dependencies.playUiSound('locked');
    return;
  }
  selectSavedDeck(scene, state, dependencies, (state.savedDeckIndex + direction + decks.length) % decks.length);
}

function toggleSelectedSavedDeckFavorite(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const account = loadAccount();
  const decks = sanitizeSavedDecks(account.decks);
  const selected = decks[state.savedDeckIndex];
  if (!selected) {
    dependencies.playUiSound('locked');
    return;
  }
  account.decks = toggleSavedDeckFavorite(decks, selected.id);
  if (!saveAccount(account)) {
    state.savedDeckStatus = 'failed';
    dependencies.playUiSound('locked');
  } else {
    state.savedDeckStatus = selected.favorite ? 'unfavorited' : 'favorited';
    dependencies.playUiSound(selected.favorite ? 'close' : 'confirm');
  }
  renderProfileScene(scene, state, dependencies);
}

function closeSavedDeckRename(state: ProfileViewState) {
  state.savedDeckRenameInput?.remove();
  state.savedDeckRenameInput = undefined;
}

function beginSavedDeckRename(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const selected = selectedSavedDeck(state);
  if (!selected || state.savedDeckRenameInput) {
    if (!selected) dependencies.playUiSound('locked');
    return;
  }
  const input = document.createElement('input');
  input.type = 'text';
  input.value = selected.name;
  input.maxLength = SAVED_DECK_NAME_LIMIT;
  input.setAttribute('aria-label', 'Saved flight name');
  input.setAttribute('autocomplete', 'off');
  Object.assign(input.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    width: 'min(420px, calc(100vw - 48px))',
    transform: 'translate(-50%, -50%)',
    zIndex: '10000',
    boxSizing: 'border-box',
    padding: '14px 18px',
    border: '2px solid #8df4ff',
    borderRadius: '4px',
    outline: '4px solid rgba(5, 12, 20, 0.92)',
    background: '#0a1420',
    color: '#ffe1a3',
    font: 'bold 18px Arial',
    textAlign: 'center',
  });
  document.body.append(input);
  state.savedDeckRenameInput = input;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);

  let finished = false;
  const finish = (commit: boolean) => {
    if (finished) return;
    finished = true;
    if (commit) {
      const account = loadAccount();
      const decks = sanitizeSavedDecks(account.decks);
      account.decks = renameSavedDeck(decks, selected.id, input.value);
      if (saveAccount(account)) {
        state.savedDeckStatus = 'renamed';
        dependencies.playUiSound('confirm');
      } else {
        state.savedDeckStatus = 'failed';
        dependencies.playUiSound('locked');
      }
    } else {
      dependencies.playUiSound('close');
    }
    closeSavedDeckRename(state);
    if (scene.scene.isActive()) renderProfileScene(scene, state, dependencies);
  };
  input.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true), { once: true });
  scene.events.once('shutdown', () => closeSavedDeckRename(state));
  window.setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
}

const playtestFocusKey: Partial<Record<ProfileFocus, PlaytestRatingKey>> = {
  playtestFun: 'fun',
  playtestFairness: 'fairness',
  playtestClarity: 'clarity',
  playtestReplay: 'replay',
};
const playtestKeyFocus: Record<PlaytestRatingKey, ProfileFocus> = {
  fun: 'playtestFun',
  fairness: 'playtestFairness',
  clarity: 'playtestClarity',
  replay: 'playtestReplay',
};

function syncLatestPlaytestRun(state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  const latest = dependencies.latestPlaytestRun();
  state.playtestRunId = latest?.id;
  state.playtestRunResult = latest?.result;
  state.playtestFeedback = latest?.feedback ? { ...latest.feedback } : {};
  state.playtestFeedbackStatus = latest ? 'idle' : 'unavailable';
}

function setPlaytestRating(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  key: PlaytestRatingKey,
  value: number,
) {
  if (!state.playtestRunId) {
    state.playtestFeedbackStatus = 'unavailable';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  const feedback = { ...state.playtestFeedback, [key]: Math.max(1, Math.min(5, Math.round(value))) };
  state.focus = playtestKeyFocus[key];
  state.playtestFeedback = feedback;
  const saved = dependencies.saveLatestPlaytestFeedback(feedback);
  state.playtestFeedbackStatus = saved ? 'saved' : 'failed';
  if (saved) {
    const persisted = dependencies.latestPlaytestRun();
    if (persisted?.id === state.playtestRunId && persisted.feedback) state.playtestFeedback = { ...persisted.feedback };
  }
  dependencies.playUiSound(state.playtestFeedbackStatus === 'saved' ? 'confirm' : 'locked');
  renderProfileScene(scene, state, dependencies);
}

function cycleProfileFocus(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  direction: -1 | 1,
) {
  const order = profileFocusOrder(state);
  const current = order.indexOf(state.focus);
  state.focus = order[(Math.max(0, current) + direction + order.length) % order.length];
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function openFlightLog(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  const history = dependencies.flightHistory();
  if (history.length === 0) {
    state.flightLogMessage = 'Complete a flight to begin the log.';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  state.flightLogOpen = true;
  state.flightLogIndex = Math.min(state.flightLogIndex, history.length - 1);
  state.flightReviewLoading = false;
  state.flightReviewRequestedId = undefined;
  state.flightReview = undefined;
  state.flightReviewAction = 0;
  state.flightCopyStatus = 'idle';
  state.flightLogMessage = '';
  state.focus = 'flightLog';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function closeFlightLog(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  state.flightLogOpen = false;
  state.flightReviewLoading = false;
  state.flightReviewRequestedId = undefined;
  state.flightReview = undefined;
  state.flightCopyStatus = 'idle';
  state.focus = 'flightLog';
  dependencies.playUiSound('close');
  renderProfileScene(scene, state, dependencies);
}

function closeFlightReview(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  state.flightReview = undefined;
  state.flightReviewLoading = false;
  state.flightReviewRequestedId = undefined;
  state.flightReviewAction = 0;
  state.flightCopyStatus = 'idle';
  dependencies.playUiSound('close');
  renderProfileScene(scene, state, dependencies);
}

function cycleFlightHistory(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  direction: -1 | 1,
) {
  if (state.flightReview) {
    state.flightReviewAction = state.flightReviewAction === 0 ? 1 : 0;
  } else {
    const history = dependencies.flightHistory();
    if (history.length === 0) return;
    state.flightLogIndex = (state.flightLogIndex + direction + history.length) % history.length;
    state.flightLogMessage = '';
  }
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function pageFlightHistory(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  direction: -1 | 1,
) {
  if (state.flightReview) return;
  const history = dependencies.flightHistory();
  if (history.length <= FLIGHT_LOG_PAGE_SIZE) {
    dependencies.playUiSound('locked');
    return;
  }
  const pageCount = Math.ceil(history.length / FLIGHT_LOG_PAGE_SIZE);
  const currentPage = Math.floor(state.flightLogIndex / FLIGHT_LOG_PAGE_SIZE);
  const nextPage = Phaser.Math.Clamp(currentPage + direction, 0, pageCount - 1);
  if (nextPage === currentPage) {
    dependencies.playUiSound('locked');
    return;
  }
  const row = state.flightLogIndex % FLIGHT_LOG_PAGE_SIZE;
  state.flightLogIndex = Math.min(nextPage * FLIGHT_LOG_PAGE_SIZE + row, history.length - 1);
  state.flightLogMessage = '';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function openSelectedFlight(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  const selected = dependencies.flightHistory()[state.flightLogIndex];
  if (!selected || state.flightReviewLoading) {
    dependencies.playUiSound('locked');
    return;
  }
  state.flightReviewLoading = true;
  state.flightReviewRequestedId = selected.id;
  state.flightCopyStatus = 'idle';
  state.flightLogMessage = 'Opening the recorded flight...';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
  void dependencies.loadFlightReview(selected.id).then((review) => {
    if (!scene.scene.isActive() || state.flightReviewRequestedId !== selected.id) return;
    state.flightReviewLoading = false;
    if (review) {
      state.flightReview = review;
      state.flightReviewAction = 0;
      state.flightLogMessage = '';
    } else {
      state.flightReviewRequestedId = undefined;
      state.flightLogMessage = 'This flight could not be reconstructed safely.';
    }
    renderProfileScene(scene, state, dependencies);
  });
}

function copyReviewedFlight(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  const review = state.flightReview;
  if (!review) return;
  void copySharedRouteLink(review.seed, review.runMode).then((copied) => {
    if (!scene.scene.isActive() || state.flightReview?.id !== review.id) return;
    state.flightCopyStatus = copied ? 'copied' : 'failed';
    dependencies.playUiSound(copied ? 'confirm' : 'locked');
    renderProfileScene(scene, state, dependencies);
  });
}

function openSaveData(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  if (playtestExportEnabled()) syncLatestPlaytestRun(state, dependencies);
  state.saveDataOpen = true;
  state.pendingRestore = undefined;
  state.saveDataStatus = 'idle';
  state.saveDataMessage = '';
  state.focus = 'saveDownload';
  renderProfileScene(scene, state, dependencies);
}

function closeSaveData(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  state.saveDataOpen = false;
  state.pendingRestore = undefined;
  state.focus = 'saveData';
  renderProfileScene(scene, state, dependencies);
}

function downloadFullSave(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  const downloaded = downloadSaveBackup(createSaveBackup(dependencies.saveData));
  state.saveDataStatus = downloaded ? 'downloaded' : 'restoreFailed';
  state.saveDataMessage = downloaded
    ? 'Backup downloaded to this device.'
    : 'Backup download failed; local data was unchanged.';
  state.focus = 'saveDownload';
  renderProfileScene(scene, state, dependencies);
}

function selectSaveToRestore(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  void requestSaveBackupFile().then((raw) => {
    if (raw === undefined || !scene.scene.isActive()) return;
    const result = parseSaveBackup(raw, dependencies.saveData);
    if (!result.ok) {
      state.saveDataStatus = 'invalid';
      state.saveDataMessage = result.error;
      state.pendingRestore = undefined;
      state.focus = 'saveRestore';
    } else {
      state.saveDataStatus = 'restoreReady';
      state.saveDataMessage = 'Review this backup before restoring it.';
      state.pendingRestore = result.preview;
      state.focus = 'restoreConfirm';
    }
    renderProfileScene(scene, state, dependencies);
  });
}

function confirmSaveRestore(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  const pending = state.pendingRestore;
  if (!pending) return;
  if (!applySaveBackup(pending.bundle)) {
    state.saveDataStatus = 'restoreFailed';
    state.saveDataMessage = 'Restore failed; your existing local data was recovered.';
    state.pendingRestore = undefined;
    state.focus = 'saveRestore';
    renderProfileScene(scene, state, dependencies);
    return;
  }
  state.saveDataStatus = 'restored';
  state.saveDataMessage = 'Restore complete. Reloading your flock record...';
  state.pendingRestore = undefined;
  state.focus = 'saveDownload';
  renderProfileScene(scene, state, dependencies);
  scene.time.delayedCall(650, () => window.location.reload());
}

function cancelSaveRestore(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  state.pendingRestore = undefined;
  state.saveDataStatus = 'idle';
  state.saveDataMessage = '';
  state.focus = 'saveRestore';
  renderProfileScene(scene, state, dependencies);
}

function exportPlaytestHistory(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  const result = downloadPlaytestRuns(dependencies.exportRunHistory());
  state.playtestExportStatus = result.status;
  state.focus = 'playtestExport';
  renderProfileScene(scene, state, dependencies);
}

function activateProfileFocus(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  const order = profileFocusOrder(state);
  if (!order.includes(state.focus)) state.focus = order[0];
  const playtestRuns = playtestRunPayload(dependencies.exportRunHistory()) ?? [];
  if (state.focus === 'playtestExport' && playtestRuns.length === 0) {
    dependencies.playUiSound('locked');
    return;
  }
  const ratingKey = playtestFocusKey[state.focus];
  if (ratingKey) {
    setPlaytestRating(scene, state, dependencies, ratingKey, ((state.playtestFeedback[ratingKey] ?? 0) % 5) + 1);
    return;
  }
  dependencies.playUiSound(state.focus === 'return' || state.focus === 'restoreCancel' ? 'close' : 'confirm');
  if (state.focus === 'achievements' || state.focus === 'contracts' || state.focus === 'showcase' || state.focus === 'folios') {
    if (state.badgeView !== state.focus) state.badgePage = 0;
    state.badgeView = state.focus;
    renderProfileScene(scene, state, dependencies);
  } else if (state.focus === 'return') scene.scene.start('MenuScene');
  else if (state.focus === 'flightLog') openFlightLog(scene, state, dependencies);
  else if (state.focus === 'saveData') openSaveData(scene, state, dependencies);
  else if (state.focus === 'saveDownload') downloadFullSave(scene, state, dependencies);
  else if (state.focus === 'saveRestore') selectSaveToRestore(scene, state, dependencies);
  else if (state.focus === 'playtestExport') exportPlaytestHistory(scene, state, dependencies);
  else if (state.focus === 'restoreConfirm') confirmSaveRestore(scene, state, dependencies);
  else if (state.focus === 'restoreCancel') cancelSaveRestore(scene, state, dependencies);
}

function renderProfileFocusRing(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Rectangle,
  focused: boolean,
  focus: ProfileFocus,
) {
  if (!focused) return;
  scene.add.rectangle(target.x, target.y, target.displayWidth + 10, target.displayHeight + 10, 0x06151b, 0.04)
    .setStrokeStyle(3, UI_FIELD.cyan, 0.98)
    .setName('profile-focus-ring')
    .setData('focus', focus);
}

export function startProfileScene(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  state.revealBursts = 0;
  if (playtestExportEnabled()) syncLatestPlaytestRun(state, dependencies);
  const returnToMenu = () => {
    if (state.savedDeckRenameInput) {
      closeSavedDeckRename(state);
      dependencies.playUiSound('close');
      renderProfileScene(scene, state, dependencies);
      return;
    }
    if (state.flightReview) {
      closeFlightReview(scene, state, dependencies);
      return;
    }
    if (state.flightLogOpen) {
      closeFlightLog(scene, state, dependencies);
      return;
    }
    if (state.saveDataOpen) {
      dependencies.playUiSound('close');
      closeSaveData(scene, state, dependencies);
      return;
    }
    dependencies.playUiSound('close');
    scene.scene.start('MenuScene');
  };
  const toggleMute = () => {
    if (!dependencies.activateAudioToggleControl(scene)) dependencies.audio.toggleMute();
  };
  bindControlActions(scene, {
    back: returnToMenu,
    previous: () => state.flightLogOpen
      ? cycleFlightHistory(scene, state, dependencies, -1)
      : state.badgeView === 'folios' && state.focus === 'folios'
        ? cycleSavedDeck(scene, state, dependencies, -1)
        : cycleProfileFocus(scene, state, dependencies, -1),
    next: () => state.flightLogOpen
      ? cycleFlightHistory(scene, state, dependencies, 1)
      : state.badgeView === 'folios' && state.focus === 'folios'
        ? cycleSavedDeck(scene, state, dependencies, 1)
        : cycleProfileFocus(scene, state, dependencies, 1),
    confirm: () => {
      if (!state.flightLogOpen) {
        activateProfileFocus(scene, state, dependencies);
      } else if (!state.flightReview) {
        openSelectedFlight(scene, state, dependencies);
      } else if (state.flightReviewAction === 0) {
        copyReviewedFlight(scene, state, dependencies);
      } else {
        closeFlightReview(scene, state, dependencies);
      }
    },
    mute: toggleMute,
    fullscreen: () => scene.scale.toggleFullscreen(),
  });
  const onTab = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (state.flightLogOpen) cycleFlightHistory(scene, state, dependencies, event.shiftKey ? -1 : 1);
    else cycleProfileFocus(scene, state, dependencies, event.shiftKey ? -1 : 1);
  };
  const onPageUp = (event: KeyboardEvent) => {
    if (state.saveDataOpen || state.flightReview) return;
    event.preventDefault();
    event.stopPropagation();
    if (state.flightLogOpen) pageFlightHistory(scene, state, dependencies, -1);
    else cycleBadgePage(scene, state, dependencies, -1);
  };
  const onPageDown = (event: KeyboardEvent) => {
    if (state.saveDataOpen || state.flightReview) return;
    event.preventDefault();
    event.stopPropagation();
    if (state.flightLogOpen) pageFlightHistory(scene, state, dependencies, 1);
    else cycleBadgePage(scene, state, dependencies, 1);
  };
  const onGamepadDown = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
    if (state.badgeView === 'folios' && state.focus === 'folios' && !state.savedDeckRenameInput) {
      if (button.index === 2) {
        toggleSelectedSavedDeckFavorite(scene, state, dependencies);
        return;
      }
      if (button.index === 3) {
        beginSavedDeckRename(scene, state, dependencies);
        return;
      }
    }
    if (button.index === 12 || button.index === 14) {
      if (state.flightLogOpen) cycleFlightHistory(scene, state, dependencies, -1);
      else cycleProfileFocus(scene, state, dependencies, -1);
    } else if (button.index === 13 || button.index === 15) {
      if (state.flightLogOpen) cycleFlightHistory(scene, state, dependencies, 1);
      else cycleProfileFocus(scene, state, dependencies, 1);
    } else if (button.index === 0) {
      if (!state.flightLogOpen) activateProfileFocus(scene, state, dependencies);
      else if (!state.flightReview) openSelectedFlight(scene, state, dependencies);
      else if (state.flightReviewAction === 0) copyReviewedFlight(scene, state, dependencies);
      else closeFlightReview(scene, state, dependencies);
    }
    else if (button.index === 4 && !state.saveDataOpen && !state.flightReview) {
      if (state.flightLogOpen) pageFlightHistory(scene, state, dependencies, -1);
      else cycleBadgePage(scene, state, dependencies, -1);
    }
    else if (button.index === 5 && !state.saveDataOpen && !state.flightReview) {
      if (state.flightLogOpen) pageFlightHistory(scene, state, dependencies, 1);
      else cycleBadgePage(scene, state, dependencies, 1);
    }
    else if (button.index === 1) returnToMenu();
  };
  const onSavedDeckFavorite = (event: KeyboardEvent) => {
    if (state.badgeView !== 'folios' || state.focus !== 'folios' || state.savedDeckRenameInput) return;
    event.preventDefault();
    event.stopPropagation();
    toggleSelectedSavedDeckFavorite(scene, state, dependencies);
  };
  const onSavedDeckRename = (event: KeyboardEvent) => {
    if (state.badgeView !== 'folios' || state.focus !== 'folios' || state.savedDeckRenameInput) return;
    event.preventDefault();
    event.stopPropagation();
    beginSavedDeckRename(scene, state, dependencies);
  };
  scene.input.keyboard?.on('keydown-TAB', onTab);
  scene.input.keyboard?.on('keydown-PAGE_UP', onPageUp);
  scene.input.keyboard?.on('keydown-PAGE_DOWN', onPageDown);
  scene.input.keyboard?.on('keydown-C', onSavedDeckFavorite);
  scene.input.keyboard?.on('keydown-R', onSavedDeckRename);
  scene.input.gamepad?.on('down', onGamepadDown);
  scene.events.once('shutdown', () => {
    closeSavedDeckRename(state);
    scene.input.keyboard?.off('keydown-TAB', onTab);
    scene.input.keyboard?.off('keydown-PAGE_UP', onPageUp);
    scene.input.keyboard?.off('keydown-PAGE_DOWN', onPageDown);
    scene.input.keyboard?.off('keydown-C', onSavedDeckFavorite);
    scene.input.keyboard?.off('keydown-R', onSavedDeckRename);
    scene.input.gamepad?.off('down', onGamepadDown);
  });

  dependencies.queueUiIconAssets(scene, profileUiIconIds, 'Profile UI', () => {
    if (scene.scene.isActive()) renderProfileScene(scene, state, dependencies);
  });
  const account = loadAccount();
  dependencies.queueCardShowcaseAssets(
    scene,
    sanitizeCardShowcase(account.showcase, account.discoveredCards),
    () => {
      if (scene.scene.isActive()) renderProfileScene(scene, state, dependencies);
    },
  );
  renderProfileScene(scene, state, dependencies);
}

export function renderProfileScene(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  dependencies.killTweensForScene(scene);
  scene.children.removeAll(true);
  dependencies.audio.setMood('menu');
  window.__birdSquadAudio = () => dependencies.audio.snapshot();
  if (!state.entryFadePlayed) {
    state.entryFadePlayed = true;
    scene.cameras.main.fadeIn(200);
  }
  scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash')
    .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
    .setAlpha(0.52);
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.74);

  const account = loadAccount();
  const leaderCount = flockLeaders.filter((leader) => isLeaderUnlocked(account, leader.id)).length;
  const collectionMilestones = collectionMilestoneSnapshots(account);
  const collectionMilestoneBadges = collectionMilestones.map((milestone) => ({
    id: milestone.id,
    name: milestone.name,
    description: milestone.complete
      ? `${milestone.current}/${milestone.target} complete / ${milestone.reward}`
      : `${milestone.current}/${milestone.target} / ${milestone.description}`,
    earned: milestone.complete || milestone.earned,
  }));
  const allAchievementBadges = [
    ...achievements.map((achievement) => ({
      id: achievement.id,
      name: achievement.name,
      description: achievement.desc,
      earned: account.achievements.includes(achievement.id),
    })),
    ...collectionMilestoneBadges,
  ];
  const earned = allAchievementBadges.filter((badge) => badge.earned).map((badge) => badge.id);
  const discovered = account.discoveredCards.length;
  const cardTotal = alphaCardSet.cards.length;
  const cardShowcase = sanitizeCardShowcase(account.showcase, account.discoveredCards);
  const showcaseEntries = cardShowcase
    .map((id) => dependencies.cardShowcaseEntry(id))
    .filter((entry): entry is ProfileShowcaseEntry => Boolean(entry));
  const savedDecks = sanitizeSavedDecks(account.decks);
  state.savedDeckIndex = Phaser.Math.Clamp(state.savedDeckIndex, 0, Math.max(0, savedDecks.length - 1));
  const winRate = account.runs > 0 ? Math.round((account.wins / account.runs) * 100) : 0;
  const leaderRecordRows = flockLeaders.map((leader) => ({
    id: leader.id,
    name: leader.name,
    unlocked: isLeaderUnlocked(account, leader.id),
    ...leaderPersonalRecord(account, leader.id),
  }));
  const allBadges = state.badgeView === 'achievements'
    ? allAchievementBadges
    : state.badgeView === 'contracts'
      ? account.contractBadges.map((badge) => {
        const [mapIndexText, id] = badge.split(':');
        const definition = dependencies.districtContracts.find((candidate) => candidate.id === id);
        return {
          id: badge,
          name: definition?.name ?? id,
          description: `District ${Number(mapIndexText) + 1} / ${definition?.goal ?? 'Contract complete'}`,
          earned: true,
        };
      })
      : [];
  const badgePageCount = state.badgeView === 'folios'
    ? Math.max(1, Math.ceil(savedDecks.length / SAVED_DECK_PAGE_SIZE))
    : Math.max(1, Math.ceil(allBadges.length / BADGE_PAGE_SIZE));
  state.badgePage = Phaser.Math.Clamp(state.badgePage, 0, badgePageCount - 1);
  if (state.badgeView === 'folios' && savedDecks.length > 0) {
    const selectedPage = Math.floor(state.savedDeckIndex / SAVED_DECK_PAGE_SIZE);
    if (selectedPage !== state.badgePage) state.savedDeckIndex = state.badgePage * SAVED_DECK_PAGE_SIZE;
  }
  const badgeVisibleStart = state.badgePage * BADGE_PAGE_SIZE;
  const visibleBadges = allBadges.slice(badgeVisibleStart, badgeVisibleStart + BADGE_PAGE_SIZE);
  const savedDeckVisibleStart = state.badgePage * SAVED_DECK_PAGE_SIZE;
  const visibleSavedDecks = savedDecks.slice(savedDeckVisibleStart, savedDeckVisibleStart + SAVED_DECK_PAGE_SIZE);
  const playtestMode = playtestExportEnabled();
  const playtestRuns = playtestRunPayload(dependencies.exportRunHistory()) ?? [];
  const flightHistory = dependencies.flightHistory();
  state.flightLogIndex = Math.max(0, Math.min(state.flightLogIndex, Math.max(0, flightHistory.length - 1)));
  const flightLogPage = Math.floor(state.flightLogIndex / FLIGHT_LOG_PAGE_SIZE);
  const flightLogPageCount = Math.max(1, Math.ceil(flightHistory.length / FLIGHT_LOG_PAGE_SIZE));
  const flightLogVisibleStart = flightHistory.length > 0 ? flightLogPage * FLIGHT_LOG_PAGE_SIZE : 0;
  const flightLogVisibleEnd = Math.min(flightHistory.length, flightLogVisibleStart + FLIGHT_LOG_PAGE_SIZE);
  const focusOrder = profileFocusOrder(state);
  if (!focusOrder.includes(state.focus)) state.focus = focusOrder[0];

  window.advanceTime = (ms: number) => dependencies.advanceGameTime(scene.game, ms);
  window.render_game_to_text = () => JSON.stringify({
    mode: 'profile',
    scene: 'ProfileScene',
    audio: dependencies.audio.snapshot(),
    stats: {
      runs: account.runs,
      wins: account.wins,
      losses: account.losses,
      winRate,
      bestAscension: account.bestWinTier >= 0 ? difficultyLabel(account.bestWinTier) : 'None yet',
      fastestWinTurns: account.fastestWinTurns,
    },
    progression: {
      leadersUnlocked: leaderCount,
      leaderTotal: flockLeaders.length,
      achievementsEarned: earned.length,
      achievementTotal: allAchievementBadges.length,
      collectionMilestonesEarned: collectionMilestones.filter((milestone) => milestone.complete).length,
      collectionMilestoneTotal: collectionMilestones.length,
      contractBadges: account.contractBadges.length,
      discoveredCards: discovered,
      cardTotal,
    },
    badgeView: state.badgeView,
    cardShowcase: {
      count: showcaseEntries.length,
      capacity: CARD_SHOWCASE_LIMIT,
      ids: showcaseEntries.map((entry) => entry.id),
      items: showcaseEntries,
      empty: showcaseEntries.length === 0,
      full: showcaseEntries.length >= CARD_SHOWCASE_LIMIT,
      selected: state.badgeView === 'showcase',
      location: 'Flock Record',
      managedIn: 'Codex card dossiers',
      affectsPower: false,
      persisted: true,
    },
    savedFlightFolios: {
      count: savedDecks.length,
      capacity: SAVED_DECK_LIMIT,
      items: savedDecks.map((deck) => ({
        id: deck.id,
        name: deck.name,
        leaderId: deck.leaderId,
        leader: flockLeaders.find((leader) => leader.id === deck.leaderId)?.name ?? deck.leaderId,
        cardCount: deck.cards.length,
        upgradedCount: deck.cards.filter((card) => card.upgraded).length,
        cards: deck.cards.map((card) => ({ ...card })),
        favorite: deck.favorite,
        sourceSeed: deck.sourceSeed,
        runMode: deck.runMode,
        createdAt: deck.createdAt,
        updatedAt: deck.updatedAt,
      })),
      empty: savedDecks.length === 0,
      full: savedDecks.length >= SAVED_DECK_LIMIT,
      selected: savedDecks[state.savedDeckIndex]?.id ?? null,
      selectedIndex: savedDecks.length > 0 ? state.savedDeckIndex : null,
      viewActive: state.badgeView === 'folios',
      page: state.badgePage + 1,
      pageCount: badgePageCount,
      status: state.savedDeckStatus,
      renaming: Boolean(state.savedDeckRenameInput),
      persisted: true,
      affectsPower: false,
      refusesReplacementAtCapacity: true,
      inputs: {
        select: `${controlBindingLabel('previous')} / ${controlBindingLabel('next')}`,
        favorite: 'C / controller X',
        rename: 'R / controller Y / pointer',
        page: 'Page Up / Page Down / LB / RB',
      },
    },
    badgePagination: {
      page: state.badgePage + 1,
      pageCount: badgePageCount,
      visibleStart: allBadges.length > 0 ? badgeVisibleStart + 1 : 0,
      visibleEnd: badgeVisibleStart + visibleBadges.length,
      visibleCount: visibleBadges.length,
      total: allBadges.length,
      items: visibleBadges.map((badge) => ({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        earned: badge.earned,
      })),
      inputs: {
        keyboard: 'Page Up / Page Down',
        controller: 'LB / RB',
      },
    },
    focus: {
      current: state.focus,
      order: focusOrder,
      previous: controlBindingLabel('previous'),
      next: controlBindingLabel('next'),
      confirm: controlBindingLabel('confirm'),
      back: controlBindingLabel('back'),
    },
    transition: {
      entryFadePlayed: state.entryFadePlayed,
      fadeRunning: scene.cameras.main?.fadeEffect?.isRunning ?? false,
      fadeComplete: scene.cameras.main?.fadeEffect?.isComplete ?? false,
      fadeProgress: Number((scene.cameras.main?.fadeEffect?.progress ?? 0).toFixed(3)),
    },
    contractBadges: [...account.contractBadges],
    collectionMilestones: {
      completed: collectionMilestones.filter((milestone) => milestone.complete).length,
      total: collectionMilestones.length,
      next: collectionMilestones.find((milestone) => !milestone.complete) ?? null,
      items: collectionMilestones,
      rewardsAffectPower: false,
    },
    leaderRecords: leaderRecordRows,
    playtestExport: {
      enabled: playtestMode,
      localOnly: true,
      runs: playtestRuns.length,
      status: state.playtestExportStatus,
    },
    playtestFeedback: {
      enabled: playtestMode,
      localOnly: true,
      runId: state.playtestRunId ?? null,
      result: state.playtestRunResult ?? null,
      ratings: { ...state.playtestFeedback },
      complete: (['fun', 'fairness', 'clarity', 'replay'] as PlaytestRatingKey[])
        .every((key) => Number.isFinite(state.playtestFeedback[key])),
      status: state.playtestFeedbackStatus,
    },
    saveData: {
      open: state.saveDataOpen,
      status: state.saveDataStatus,
      message: state.saveDataMessage,
      pending: state.pendingRestore ? {
        runs: state.pendingRestore.runs,
        wins: state.pendingRestore.wins,
        leaders: state.pendingRestore.leaders,
        activeRun: state.pendingRestore.activeRun,
        exportedAt: state.pendingRestore.exportedAt,
      } : null,
    },
    flightHistory: {
      open: state.flightLogOpen,
      count: flightHistory.length,
      selectedIndex: flightHistory.length > 0 ? state.flightLogIndex : null,
      selected: flightHistory[state.flightLogIndex] ?? null,
      page: flightHistory.length > 0 ? flightLogPage + 1 : 0,
      pageCount: flightHistory.length > 0 ? flightLogPageCount : 0,
      visibleStart: flightHistory.length > 0 ? flightLogVisibleStart + 1 : 0,
      visibleEnd: flightLogVisibleEnd,
      loading: state.flightReviewLoading,
      message: state.flightLogMessage,
      review: state.flightReview ? {
        id: state.flightReview.id,
        seed: state.flightReview.seed,
        runMode: state.flightReview.runMode,
        details: state.flightReview.details,
        focusedAction: state.flightReviewAction === 0 ? 'copy' : 'close',
        copyStatus: state.flightCopyStatus,
      } : null,
    },
    profileRecordFlourish: profileRecordFlourishState(scene, state),
    profileTitlePlaque: textureState(scene, 'profile-title-plaque'),
    profileStatChipFrame: textureState(scene, 'profile-stat-chip-frame'),
    profileRecordRowFrame: textureState(scene, 'profile-record-row-frame'),
    profileSectionTabFrame: textureState(scene, 'profile-section-tab-frame'),
    profileProgressRailFrame: textureState(scene, 'profile-progress-rail-frame'),
    profileProgressFillStrip: textureState(scene, 'profile-progress-fill-strip'),
    profileReturnCommandFrame: textureState(scene, 'profile-return-command-frame'),
  });

  const frame = dependencies.renderFieldPanel(scene, () => {}, GAME_WIDTH / 2, 376, 780, 616, {
    accent: UI_FIELD.cyan,
    fill: UI_FIELD.ink,
  });
  renderProfileRecordFlourish(scene, state, dependencies, frame);
  if (!state.saveDataOpen) {
    dependencies.renderAudioToggleControl(scene, () => {}, 48, 38);
    dependencies.renderCloseControl(scene, () => {}, frame.right - 64, frame.top + 42, () => scene.scene.start('MenuScene'));
  }

  renderProfileTitlePlaque(scene, frame.left + 338, frame.top + 70);
  const emblem = addProfileIconImage(scene, 'record-medallion', frame.left + 74, frame.top + 70, 46);
  emblem?.setAlpha(0.98);
  scene.add.text(frame.left + 136, frame.top + 38, 'Flock Record', {
    fontFamily: 'Georgia, serif',
    fontSize: '34px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 4,
  }).setResolution(2);
  scene.add.text(
    frame.left + 138,
    frame.top + 80,
    `${leaderCount}/${flockLeaders.length} leaders ready | ${earned.length} achievements | ${account.contractBadges.length} contract badges`,
    { fontFamily: UI_FONT, fontSize: '13px', color: UI_SOFT, wordWrap: { width: 520 } },
  ).setResolution(2);

  const chips: Array<{ label: string; value: string; accent: number }> = [
    { label: 'Runs', value: `${account.runs}`, accent: UI_FIELD.cyan },
    { label: 'Wins', value: `${account.wins}`, accent: UI_FIELD.green },
    { label: 'Win Rate', value: `${winRate}%`, accent: UI_FIELD.brass },
    {
      label: 'Ascension',
      value: account.bestWinTier >= 0 ? difficultyLabel(account.bestWinTier).replace('Ascension ', 'A') : 'None',
      accent: UI_FIELD.violet,
    },
    {
      label: 'Boss Fastest',
      value: account.fastestWinTurns === null ? '-' : `${account.fastestWinTurns} beats`,
      accent: UI_FIELD.gold,
    },
  ];
  chips.forEach((chip, index) => {
    renderRecordStatChip(scene, dependencies, frame.left + 90 + index * 150, frame.top + 140, 132, chip.label, chip.value, chip.accent);
  });

  renderProgressRail(scene, frame.left + 44, frame.top + 198, 304, 'Leaders unlocked', leaderCount, flockLeaders.length, UI_FIELD.cyan);
  renderProgressRail(scene, frame.left + 44, frame.top + 244, 304, 'Achievements', earned.length, allAchievementBadges.length, UI_FIELD.brass);
  renderProgressRail(scene, frame.left + 44, frame.top + 290, 304, 'Codex cards seen', discovered, cardTotal, UI_FIELD.violet);

  renderProfileSectionTabFrame(scene, frame.left + 150, frame.top + 350, 220, UI_FIELD.cyan);
  scene.add.text(frame.left + 70, frame.top + 338, 'Flock Leaders', {
    fontFamily: UI_FONT,
    fontSize: '17px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
  }).setResolution(2);
  flockLeaders.forEach((leader, index) => {
    const y = frame.top + 382 + index * 39;
    const unlocked = isLeaderUnlocked(account, leader.id);
    const mastery = leaderMastery(account, leader.id);
    const personal = leaderPersonalRecord(account, leader.id);
    const personalParts = [
      personal.bestFullWinTier >= 0 ? `A${personal.bestFullWinTier}` : '',
      personal.fastestFullWinTurns !== null ? `FULL ${personal.fastestFullWinTurns}B` : '',
      personal.fastestQuickWinTurns !== null ? `QUICK ${personal.fastestQuickWinTurns}B` : '',
    ].filter(Boolean);
    renderProfileRecordRowFrame(scene, frame.left + 188, y, 296, 32, UI_FIELD.cyan, unlocked);
    const icon = addProfileIconImage(scene, 'leader-record-medallion', frame.left + 56, y, 10);
    icon?.setAlpha(unlocked ? 0.9 : 0.28);
    if (!unlocked) icon?.setTint(0x687684);
    scene.add.text(frame.left + 78, y - 12, leader.name, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: unlocked ? UI_FIELD.warm : '#6b7785',
      wordWrap: { width: 160 },
    }).setResolution(2);
    scene.add.text(frame.left + 326, y - 12, unlocked ? `${mastery.title} ${mastery.current}/${mastery.target}` : 'Locked', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: unlocked ? UI_FIELD.cyanText : '#788694',
    }).setResolution(2).setOrigin(1, 0);
    if (unlocked) {
      scene.add.text(frame.left + 326, y + 3, personalParts.join('  /  ') || 'NO WIN RECORD', {
        fontFamily: UI_FONT,
        fontSize: '9px',
        fontStyle: UI_BOLD,
        color: personalParts.length > 0 ? UI_FIELD.warm : UI_MUTED,
      }).setResolution(2).setOrigin(1, 0).setName(`leader-personal-record-${leader.id}`);
    }
  });

  const badgeX = frame.left + 392;
  renderProfileSectionTabFrame(scene, badgeX + 146, frame.top + 210, 312, UI_FIELD.brass);
  const tabs: Array<{ view: ProfileBadgeView; x: number; label: string }> = [
    { view: 'achievements', x: badgeX + 32, label: 'Badges' },
    { view: 'contracts', x: badgeX + 108, label: `Contracts ${account.contractBadges.length}` },
    { view: 'showcase', x: badgeX + 184, label: `Showcase ${showcaseEntries.length}` },
    { view: 'folios', x: badgeX + 260, label: `Folios ${savedDecks.length}` },
  ];
  tabs.forEach((tab) => {
    const selected = state.badgeView === tab.view;
    const focused = state.focus === tab.view;
    const hit = scene.add.rectangle(tab.x, frame.top + 210, 72, MIN_SUPPORTED_TOUCH_TARGET, selected ? 0x183451 : 0x0d1420, 0.94)
      .setStrokeStyle(focused ? 3 : 1, focused ? UI_FIELD.cyan : selected ? UI_FIELD.gold : UI_FIELD.cyan, focused ? 0.98 : selected ? 0.86 : 0.34)
      .setInteractive({ useHandCursor: true })
      .setName(`profile-${tab.view}-tab-hit`);
    scene.add.text(tab.x, frame.top + 210, tab.label, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: selected ? UI_GOLD : UI_SOFT,
    }).setResolution(2).setOrigin(0.5);
    hit.on('pointerdown', () => {
      state.focus = tab.view;
      if (state.badgeView === tab.view) return;
      dependencies.playUiSound('confirm');
      state.badgeView = tab.view;
      state.badgePage = 0;
      renderProfileScene(scene, state, dependencies);
    });
  });

  if (state.badgeView === 'showcase') {
    renderCardShowcase(scene, badgeX, frame.top, showcaseEntries);
  } else if (state.badgeView === 'folios') {
    renderSavedFlightFolios(scene, state, dependencies, badgeX, frame.top, savedDecks, visibleSavedDecks, savedDeckVisibleStart);
  } else if (visibleBadges.length === 0) {
    scene.add.text(badgeX + 150, frame.top + 286, 'Complete a district contract to place its mark here.', {
      fontFamily: UI_FONT,
      fontSize: '13px',
      color: UI_MUTED,
      fixedWidth: 270,
      align: 'center',
      wordWrap: { width: 270 },
    }).setOrigin(0.5);
  }
  if (state.badgeView !== 'showcase' && state.badgeView !== 'folios') visibleBadges.forEach((badge, index) => {
    const y = frame.top + 260 + index * 39;
    renderProfileRecordRowFrame(scene, badgeX + 150, y, 300, 35, UI_FIELD.brass, badge.earned);
    const icon = addProfileIconImage(scene, 'achievement-medallion', badgeX + 17, y, 12);
    icon?.setAlpha(badge.earned ? 0.95 : 0.34);
    if (!badge.earned) icon?.setTint(0x6d7683);
    scene.add.text(badgeX + 34, y - 13, badge.name, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: badge.earned ? '#ffe1a3' : '#7b8794',
    }).setResolution(2);
    scene.add.text(badgeX + 34, y + 3, badge.description, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      color: badge.earned ? '#cdd9e6' : '#5f6c7a',
      wordWrap: { width: 244 },
      maxLines: 1,
    }).setResolution(2);
  });
  if (state.badgeView !== 'showcase' && badgePageCount > 1) {
    scene.add.text(
      badgeX + 150,
      frame.top + 486,
      'Page Up / Down  ·  LB / RB',
      {
        fontFamily: UI_FONT,
        fontSize: '9px',
        fontStyle: UI_BOLD,
        color: UI_FIELD.cyanText,
      },
    ).setResolution(2).setOrigin(0.5).setName('profile-badge-page-hint');
    dependencies.renderFieldButton(
      scene,
      () => {},
      badgeX + 54,
      frame.top + 522,
      76,
      MIN_SUPPORTED_TOUCH_TARGET,
      'Prev',
      state.badgePage > 0,
      () => cycleBadgePage(scene, state, dependencies, -1),
      UI_FIELD.cyan,
      false,
    ).setName('profile-badge-page-previous');
    scene.add.text(badgeX + 150, frame.top + 522, `${state.badgePage + 1} / ${badgePageCount}`, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.warm,
    }).setResolution(2).setOrigin(0.5).setName('profile-badge-page-label');
    dependencies.renderFieldButton(
      scene,
      () => {},
      badgeX + 246,
      frame.top + 522,
      76,
      MIN_SUPPORTED_TOUCH_TARGET,
      'Next',
      state.badgePage < badgePageCount - 1,
      () => cycleBadgePage(scene, state, dependencies, 1),
      UI_FIELD.cyan,
      false,
    ).setName('profile-badge-page-next');
  }

  const flightLogHit = dependencies.renderFieldButton(
    scene,
    () => {},
    frame.left + 116,
    frame.bottom - 30,
    184,
    56,
    `Flight Log ${flightHistory.length}`,
    flightHistory.length > 0,
    () => openFlightLog(scene, state, dependencies),
    UI_FIELD.violet,
  );
  flightLogHit.setName('profile-flight-log-hit');
  renderProfileFocusRing(scene, flightLogHit, state.focus === 'flightLog', 'flightLog');
  const returnHit = renderProfileReturnCommand(scene, dependencies, GAME_WIDTH / 2, frame.bottom - 30, 186, 56, () => scene.scene.start('MenuScene'));
  returnHit.setName('profile-return-hit');
  renderProfileFocusRing(scene, returnHit, state.focus === 'return', 'return');
  const saveHit = dependencies.renderFieldButton(
    scene,
    () => {},
    frame.right - 116,
    frame.bottom - 30,
    184,
    56,
    'Save Data',
    true,
    () => openSaveData(scene, state, dependencies),
    UI_FIELD.cyan,
  );
  saveHit.setName('profile-save-data-hit');
  renderProfileFocusRing(scene, saveHit, state.focus === 'saveData', 'saveData');
  if (!state.saveDataOpen) {
    scene.add.text(frame.left + 24, frame.bottom - 76, `${controlBindingLabel('previous')} / ${controlBindingLabel('next')}: Navigate  ${controlBindingLabel('confirm')}: Select`, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.cyanText,
    }).setResolution(2).setName('profile-input-hint');
  }
  if (state.saveDataOpen) renderSaveDataOverlay(scene, state, dependencies, playtestMode, playtestRuns.length);
  if (state.flightLogOpen) renderFlightLogOverlay(scene, state, dependencies, flightHistory);
}

function renderSavedFlightFolios(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  x: number,
  top: number,
  allDecks: readonly SavedDeckRecord[],
  visibleDecks: readonly SavedDeckRecord[],
  visibleStart: number,
) {
  scene.add.text(x + 150, top + 253, 'SAVED FLIGHT FOLIOS', {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
  }).setResolution(2).setOrigin(0.5).setName('profile-folios-title');

  if (allDecks.length === 0) {
    scene.add.rectangle(x + 150, top + 366, 282, 154, 0x0b1420, 0.88)
      .setStrokeStyle(1, UI_FIELD.violet, 0.52)
      .setName('profile-folios-empty-frame');
    scene.add.text(
      x + 150,
      top + 366,
      'No flights saved yet.\n\nOpen Deck Review during a flight,\nthen choose SAVE FLIGHT or press V / Y.\nSaved folios never change gameplay power.',
      {
        fontFamily: UI_FONT,
        fontSize: '12px',
        color: UI_SOFT,
        align: 'center',
        lineSpacing: 5,
        wordWrap: { width: 244 },
      },
    ).setResolution(2).setOrigin(0.5).setName('profile-folios-empty');
    return;
  }

  visibleDecks.forEach((deck, visibleIndex) => {
    const index = visibleStart + visibleIndex;
    const y = top + 302 + visibleIndex * 76;
    const selected = index === state.savedDeckIndex;
    const leader = flockLeaders.find((candidate) => candidate.id === deck.leaderId)?.name ?? deck.leaderId;
    const cardNames = deck.cards.slice(0, 3).map((saved) => (
      alphaCardSet.cards.find((card) => card.id === saved.id)?.displayName ?? saved.id
    ));
    const hit = scene.add.rectangle(x + 150, y, 300, 68, selected ? 0x183451 : 0x0d1420, 0.94)
      .setStrokeStyle(selected ? 3 : 1, selected ? UI_FIELD.cyan : deck.favorite ? UI_FIELD.gold : UI_FIELD.violet, selected ? 0.98 : 0.52)
      .setInteractive({ useHandCursor: true })
      .setName('profile-folio-row-hit')
      .setData('deckId', deck.id)
      .setData('index', index);
    hit.on('pointerdown', () => {
      state.focus = 'folios';
      selectSavedDeck(scene, state, dependencies, index);
    });
    scene.add.text(x + 20, y - 26, `${deck.favorite ? '★ ' : ''}${deck.name}`, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: deck.favorite ? UI_GOLD : UI_FIELD.warm,
      fixedWidth: 258,
    }).setResolution(2).setName('profile-folio-name').setData('deckId', deck.id);
    scene.add.text(x + 20, y - 7, `${leader.toUpperCase()}  ·  ${deck.cards.length} CARDS  ·  ${deck.cards.filter((card) => card.upgraded).length} PREENED`, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.cyanText,
      fixedWidth: 260,
    }).setResolution(2);
    scene.add.text(x + 20, y + 11, `${cardNames.join(', ')}${deck.cards.length > 3 ? ', …' : ''}`, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      color: UI_MUTED,
      fixedWidth: 260,
    }).setResolution(2);
  });

  const selected = allDecks[state.savedDeckIndex];
  const status = state.savedDeckRenameInput
    ? 'TYPE A NAME  ·  ENTER SAVE  ·  ESC CANCEL'
    : state.savedDeckStatus === 'favorited'
      ? 'FAVORITE SAVED'
      : state.savedDeckStatus === 'unfavorited'
        ? 'FAVORITE REMOVED'
        : state.savedDeckStatus === 'renamed'
          ? 'CUSTOM NAME SAVED'
          : state.savedDeckStatus === 'failed'
            ? 'SAVE FAILED  ·  ORIGINAL FOLIO KEPT'
            : 'PREV/NEXT SELECT  ·  C/X FAVORITE  ·  R/Y RENAME';
  scene.add.text(x + 150, top + 445, status, {
    fontFamily: UI_FONT,
    fontSize: '9px',
    fontStyle: UI_BOLD,
    color: state.savedDeckStatus === 'failed' ? '#ffb09a' : UI_FIELD.cyanText,
    fixedWidth: 300,
    align: 'center',
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-status');

  const favorite = dependencies.renderFieldButton(
    scene,
    () => {},
    x + 76,
    top + 474,
    132,
    MIN_SUPPORTED_TOUCH_TARGET,
    selected?.favorite ? 'Unfavorite' : 'Favorite',
    Boolean(selected) && !state.savedDeckRenameInput,
    () => toggleSelectedSavedDeckFavorite(scene, state, dependencies),
    UI_FIELD.gold,
    false,
  );
  favorite.setName('profile-folio-favorite-hit');
  const rename = dependencies.renderFieldButton(
    scene,
    () => {},
    x + 224,
    top + 474,
    132,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Rename',
    Boolean(selected) && !state.savedDeckRenameInput,
    () => beginSavedDeckRename(scene, state, dependencies),
    UI_FIELD.violet,
    false,
  );
  rename.setName('profile-folio-rename-hit');
}

function renderCardShowcase(
  scene: Phaser.Scene,
  x: number,
  top: number,
  entries: readonly ProfileShowcaseEntry[],
) {
  scene.add.text(x + 150, top + 253, 'YOUR PRESENTED FLOCK', {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
  }).setResolution(2).setOrigin(0.5).setName('profile-showcase-title');
  if (entries.length === 0) {
    scene.add.rectangle(x + 150, top + 365, 282, 170, 0x0b1420, 0.88)
      .setStrokeStyle(1, UI_FIELD.violet, 0.52)
      .setName('profile-showcase-empty-frame');
    scene.add.text(
      x + 150,
      top + 365,
      'No cards presented yet.\n\nOpen a discovered card in the Codex,\nthen choose ADD TO SHOWCASE or press G / R3.',
      {
        fontFamily: UI_FONT,
        fontSize: '12px',
        color: UI_SOFT,
        align: 'center',
        lineSpacing: 6,
        wordWrap: { width: 244 },
      },
    ).setResolution(2).setOrigin(0.5).setName('profile-showcase-empty');
  } else {
    entries.forEach((entry, index) => {
      const cx = x + 48 + index * 102;
      const cy = top + 345;
      scene.add.rectangle(cx, cy, 86, 126, 0x09111c, 0.96)
        .setStrokeStyle(2, UI_FIELD.violet, 0.76)
        .setName('profile-showcase-card-frame')
        .setData('cardId', entry.id);
      if (entry.artKey && scene.textures.exists(entry.artKey)) {
        scene.textures.get(entry.artKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
        scene.add.image(cx, cy, entry.artKey)
          .setDisplaySize(78, 116)
          .setName('profile-showcase-card-art')
          .setData('cardId', entry.id);
      } else {
        scene.add.text(cx, cy, entry.name, {
          fontFamily: UI_FONT,
          fontSize: '11px',
          fontStyle: UI_BOLD,
          color: UI_FIELD.warm,
          align: 'center',
          wordWrap: { width: 68 },
        }).setResolution(2).setOrigin(0.5);
      }
      scene.add.text(cx, top + 421, entry.name, {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: UI_FIELD.warm,
        align: 'center',
        fixedWidth: 92,
        wordWrap: { width: 92 },
        maxLines: 2,
      }).setResolution(2).setOrigin(0.5, 0).setName('profile-showcase-card-name').setData('cardId', entry.id);
      scene.add.text(cx, top + 451, `${entry.family} / ${entry.rarity}`, {
        fontFamily: UI_FONT,
        fontSize: '8px',
        fontStyle: UI_BOLD,
        color: UI_FIELD.cyanText,
        fixedWidth: 94,
        align: 'center',
        maxLines: 1,
      }).setResolution(2).setOrigin(0.5, 0).setName('profile-showcase-card-meta').setData('cardId', entry.id);
    });
  }
  scene.add.text(x + 150, top + 494, `${entries.length}/${CARD_SHOWCASE_LIMIT} presented / identity only / no power`, {
    fontFamily: UI_FONT,
    fontSize: '9px',
    fontStyle: UI_BOLD,
    color: UI_MUTED,
  }).setResolution(2).setOrigin(0.5).setName('profile-showcase-note');
}

function renderFlightLogOverlay(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  history: FlightHistoryEntry[],
) {
  const close = () => closeFlightLog(scene, state, dependencies);
  const page = Math.floor(state.flightLogIndex / FLIGHT_LOG_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(history.length / FLIGHT_LOG_PAGE_SIZE));
  const pageStart = page * FLIGHT_LOG_PAGE_SIZE;
  const pageEntries = history.slice(pageStart, pageStart + FLIGHT_LOG_PAGE_SIZE);
  const pageEnd = pageStart + pageEntries.length;
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020408, 0.9)
    .setInteractive()
    .setName('profile-flight-log-blocker');
  const panel = dependencies.renderFieldPanel(scene, () => {}, GAME_WIDTH / 2, 360, 1040, 620, {
    accent: UI_FIELD.violet,
    fill: UI_FIELD.ink,
  });
  dependencies.renderCloseControl(scene, () => {}, panel.right - 42, panel.top + 38, close);
  scene.add.text(panel.left + 40, panel.top + 28, 'FLIGHT LOG', {
    fontFamily: 'Georgia, serif',
    fontSize: '30px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 4,
  }).setResolution(2).setName('profile-flight-log-title');
  scene.add.text(panel.left + 42, panel.top + 72, 'Up to 50 completed flights stay local, survive reloads, and remain part of Save Data backups.', {
    fontFamily: UI_FONT,
    fontSize: '12px',
    color: UI_SOFT,
    fixedWidth: 850,
    maxLines: 1,
  }).setResolution(2);
  scene.add.text(panel.left + 42, panel.top + 98, `${controlBindingLabel('previous')} / ${controlBindingLabel('next')}: Choose   Page Up / Down or LB / RB: Page   ${controlBindingLabel('confirm')}: Review   ${controlBindingLabel('back')}: Return`, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
  }).setResolution(2).setName('profile-flight-log-input-hint');

  scene.add.rectangle(panel.left + 220, panel.top + 365, 378, 480, 0x070d16, 0.94)
    .setStrokeStyle(1, UI_FIELD.violet, 0.46)
    .setName('profile-flight-log-list-panel');
  scene.add.text(panel.left + 48, panel.top + 135, `FLIGHTS ${pageStart + 1}-${pageEnd} OF ${history.length}  /  PAGE ${page + 1}/${pageCount}`, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: '#ead8ff',
    fixedWidth: 214,
  }).setResolution(2);
  const newerPageHit = dependencies.renderFieldButton(
    scene,
    () => {},
    panel.left + 292,
    panel.top + 145,
    72,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Newer',
    page > 0,
    () => pageFlightHistory(scene, state, dependencies, -1),
    UI_FIELD.cyan,
    false,
  ).setName('profile-flight-log-page-newer');
  const olderPageHit = dependencies.renderFieldButton(
    scene,
    () => {},
    panel.left + 372,
    panel.top + 145,
    72,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Older',
    page < pageCount - 1,
    () => pageFlightHistory(scene, state, dependencies, 1),
    UI_FIELD.violet,
    false,
  ).setName('profile-flight-log-page-older');
  newerPageHit.setData('page', Math.max(1, page));
  olderPageHit.setData('page', Math.min(pageCount, page + 2));
  pageEntries.forEach((entry, index) => {
    const globalIndex = pageStart + index;
    const y = panel.top + 214 + index * 60;
    const selected = globalIndex === state.flightLogIndex;
    const hit = scene.add.rectangle(panel.left + 220, y, 352, MIN_SUPPORTED_TOUCH_TARGET, selected ? 0x183451 : 0x0b1420, 0.96)
      .setStrokeStyle(selected ? 3 : 1, selected ? UI_FIELD.cyan : 0x4c526d, selected ? 0.98 : 0.46)
      .setInteractive({ useHandCursor: true })
      .setName(`profile-flight-log-row-${globalIndex}`)
      .setData('runId', entry.id);
    hit.on('pointerdown', () => {
      state.flightLogIndex = globalIndex;
      openSelectedFlight(scene, state, dependencies);
    });
    scene.add.text(panel.left + 58, y - 18, `${entry.result === 'win' ? 'WIN' : 'LOSS'}  ·  ${entry.difficulty}  ·  ${entry.runMode === 'quick' ? 'Quick' : 'Full'}`, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: entry.result === 'win' ? '#a9f4b7' : '#ffb8ad',
      fixedWidth: 320,
      maxLines: 1,
    }).setResolution(2);
    scene.add.text(panel.left + 58, y + 4, `${entry.leader}  ·  ${entry.deckSize} cards  ·  ${entry.stops} stops`, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      color: selected ? '#dffbff' : UI_SOFT,
      fixedWidth: 320,
      maxLines: 1,
    }).setResolution(2);
  });

  const selected = history[state.flightLogIndex];
  const previewX = panel.left + 638;
  scene.add.rectangle(previewX, panel.top + 354, 420, 450, 0x07101a, 0.96)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.48)
    .setName('profile-flight-log-preview');
  if (!selected) {
    scene.add.text(previewX, panel.top + 344, 'No completed flights yet.', {
      fontFamily: UI_FONT,
      fontSize: '16px',
      fontStyle: UI_BOLD,
      color: UI_MUTED,
    }).setOrigin(0.5);
  } else {
    const totalSeconds = Math.max(0, Math.round(selected.durationMs / 1000));
    const duration = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
    scene.add.text(previewX, panel.top + 150, selected.result === 'win' ? 'COMPLETED FLIGHT' : 'SCATTERED FLIGHT', {
      fontFamily: UI_FONT,
      fontSize: '14px',
      fontStyle: UI_BOLD,
      color: selected.result === 'win' ? '#a9f4b7' : '#ffb8ad',
    }).setOrigin(0.5);
    scene.add.text(previewX, panel.top + 184, `FLIGHT ${selected.seed}`, {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.warm,
      fixedWidth: 380,
      align: 'center',
      maxLines: 1,
    }).setOrigin(0.5);
    scene.add.text(previewX, panel.top + 218, `${selected.leader}  ·  ${selected.difficulty}  ·  ${selected.runMode === 'quick' ? 'Quick' : 'Full'}`, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      color: UI_FIELD.cyanText,
      fixedWidth: 380,
      align: 'center',
      maxLines: 1,
    }).setOrigin(0.5);
    scene.add.text(previewX - 166, panel.top + 262, [
      `Recorded       ${formatFlightDate(selected.completedAtMs)}`,
      `Duration       ${duration}`,
      `Cohesion       ${selected.currentCohesion}/${selected.maxCohesion}`,
      `Beats          ${selected.turns}`,
      `Final deck     ${selected.deckSize} cards`,
      `Route          ${selected.stops} stops`,
      `Waymarks       ${selected.waymarks}`,
      `Supplies used  ${selected.supplies}`,
    ].join('\n'), {
      fontFamily: UI_FONT,
      fontSize: '12px',
      color: '#d7e3ec',
      lineSpacing: 10,
      fixedWidth: 332,
    }).setResolution(2);
    scene.add.text(previewX, panel.bottom - 82, state.flightLogMessage || 'Confirm to inspect the complete deck, path, kit, decisions, and results.', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: state.flightLogMessage.includes('could not') ? '#ffb8ad' : UI_FIELD.cyanText,
      fixedWidth: 360,
      align: 'center',
      wordWrap: { width: 360 },
      maxLines: 2,
    }).setOrigin(0.5);
  }

  if (state.flightReview) {
    const root = scene.add.container(0, 0).setName('profile-flight-review-root');
    renderOutcomeFlightDetails(scene, root, state.flightReview.details, {
      title: 'Recorded Flight',
      subtitle: state.flightReview.subtitle,
      fontFamily: UI_FONT,
      boldStyle: UI_BOLD,
      focused: true,
      focusedAction: state.flightReviewAction === 0 ? 'copy' : 'close',
      copyStatus: state.flightCopyStatus,
      onCopy: () => copyReviewedFlight(scene, state, dependencies),
      onClose: () => closeFlightReview(scene, state, dependencies),
    });
  }
}

function formatFlightDate(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 'Earlier flight';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Earlier flight' : date.toLocaleDateString();
}

function renderSaveDataOverlay(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  playtestMode: boolean,
  playtestRunCount: number,
) {
  const close = () => closeSaveData(scene, state, dependencies);
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020408, 0.78)
    .setInteractive()
    .setName('profile-save-data-blocker');
  const expanded = Boolean(state.pendingRestore) || playtestMode;
  const panel = dependencies.renderFieldPanel(scene, () => {}, GAME_WIDTH / 2, 360, 700, expanded ? 620 : 340, {
    accent: UI_FIELD.cyan,
    fill: UI_FIELD.ink,
  });
  dependencies.renderCloseControl(scene, () => {}, panel.right - 42, panel.top + 38, close);
  scene.add.text(panel.left + 44, panel.top + 30, 'SAVE DATA', {
    fontFamily: 'Georgia, serif',
    fontSize: '30px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 4,
  }).setResolution(2).setName('profile-save-data-title');
  scene.add.text(panel.left + 46, panel.top + 72, 'Keep a local copy of your full flock record, active flight, tutorial progress, controls, and settings.', {
    fontFamily: UI_FONT,
    fontSize: '13px',
    color: UI_SOFT,
    wordWrap: { width: 590 },
  }).setResolution(2);
  scene.add.text(panel.left + 46, panel.top + 106, `${controlBindingLabel('previous')} / ${controlBindingLabel('next')}: Navigate   ${controlBindingLabel('confirm')}: Select   ${controlBindingLabel('back')}: Close`, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
  }).setResolution(2).setName('profile-save-input-hint');

  if (state.pendingRestore) {
    const pending = state.pendingRestore;
    scene.add.text(panel.cx, panel.top + 132, 'BACKUP READY TO RESTORE', {
      fontFamily: UI_FONT,
      fontSize: '16px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.cyanText,
    }).setResolution(2).setOrigin(0.5);
    scene.add.rectangle(panel.cx, panel.top + 214, 572, 112, 0x0b1420, 0.92)
      .setStrokeStyle(1, UI_FIELD.cyan, 0.5);
    const summary = [
      `${pending.runs} run${pending.runs === 1 ? '' : 's'}  |  ${pending.wins} win${pending.wins === 1 ? '' : 's'}  |  ${pending.leaders} leader${pending.leaders === 1 ? '' : 's'} unlocked`,
      pending.activeRun ? 'Includes an active flight checkpoint' : 'No active flight checkpoint',
      `Created ${formatBackupDate(pending.exportedAt)}`,
    ];
    scene.add.text(panel.cx, panel.top + 181, summary.join('\n'), {
      fontFamily: UI_FONT,
      fontSize: '14px',
      color: UI_FIELD.warm,
      align: 'center',
      lineSpacing: 10,
    }).setResolution(2).setOrigin(0.5, 0);
    scene.add.text(panel.cx, panel.top + 296, 'Restoring replaces Bird Squad save data and settings on this device. Other site data is left alone.', {
      fontFamily: UI_FONT,
      fontSize: '13px',
      color: '#ffcf9e',
      align: 'center',
      wordWrap: { width: 560 },
    }).setResolution(2).setOrigin(0.5, 0);
    const confirmHit = dependencies.renderFieldButton(
      scene,
      () => {},
      panel.cx - 116,
      panel.bottom - 54,
      202,
      58,
      'Confirm Restore',
      true,
      () => confirmSaveRestore(scene, state, dependencies),
      UI_FIELD.green,
    );
    confirmHit.setName('profile-save-restore-confirm-hit');
    renderProfileFocusRing(scene, confirmHit, state.focus === 'restoreConfirm', 'restoreConfirm');
    const cancelHit = dependencies.renderFieldButton(
      scene,
      () => {},
      panel.cx + 116,
      panel.bottom - 54,
      176,
      58,
      'Cancel',
      true,
      () => cancelSaveRestore(scene, state, dependencies),
      UI_FIELD.gold,
      'close',
    );
    cancelHit.setName('profile-save-restore-cancel-hit');
    renderProfileFocusRing(scene, cancelHit, state.focus === 'restoreCancel', 'restoreCancel');
    return;
  }

  const downloadHit = dependencies.renderFieldButton(
    scene,
    () => {},
    panel.cx - 126,
    panel.top + 170,
    220,
    60,
    'Download Backup',
    true,
    () => downloadFullSave(scene, state, dependencies),
    UI_FIELD.cyan,
  );
  downloadHit.setName('profile-save-download-hit');
  renderProfileFocusRing(scene, downloadHit, state.focus === 'saveDownload', 'saveDownload');
  const restoreHit = dependencies.renderFieldButton(
    scene,
    () => {},
    panel.cx + 126,
    panel.top + 170,
    220,
    60,
    'Restore Backup',
    true,
    () => selectSaveToRestore(scene, state, dependencies),
    UI_FIELD.gold,
  );
  restoreHit.setName('profile-save-restore-file-hit');
  renderProfileFocusRing(scene, restoreHit, state.focus === 'saveRestore', 'saveRestore');
  const statusColor = state.saveDataStatus === 'invalid' || state.saveDataStatus === 'restoreFailed'
    ? '#ffb8ad'
    : state.saveDataStatus === 'restored'
      ? '#a9f4b7'
      : UI_FIELD.cyanText;
  scene.add.text(panel.cx, panel.top + 222, state.saveDataMessage || 'Backups stay on your device. Nothing is uploaded.', {
    fontFamily: UI_FONT,
    fontSize: '12px',
    fontStyle: UI_BOLD,
    color: statusColor,
    fixedWidth: 580,
    align: 'center',
    wordWrap: { width: 580 },
  }).setResolution(2).setOrigin(0.5, 0).setName('profile-save-data-status');

  if (playtestMode) {
    scene.add.rectangle(panel.cx, panel.top + 262, 574, 1, UI_FIELD.cyan, 0.34);
    scene.add.rectangle(panel.cx, panel.top + 278, 574, 32, 0x07111b, 0.86)
      .setStrokeStyle(1, UI_FIELD.cyan, 0.28)
      .setName('profile-playtest-rating-header');
    scene.add.text(panel.left + 64, panel.top + 271, 'PLAYTEST RATINGS / LATEST RUN', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: UI_SOFT,
    }).setResolution(2);
    const latestLabel = state.playtestRunId
      ? `${state.playtestRunResult === 'win' ? 'WIN' : 'LOSS'}  /  RUN ${state.playtestRunId.split('-').at(-1) ?? state.playtestRunId}`
      : 'Complete a run, then return here to rate it.';
    scene.add.text(panel.right - 64, panel.top + 271, latestLabel, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: state.playtestRunId ? UI_FIELD.cyanText : UI_FIELD.muted,
      fixedWidth: 300,
      align: 'right',
    }).setResolution(2).setOrigin(1, 0).setName('profile-playtest-latest-run');

    const ratingRows: Array<{ key: PlaytestRatingKey; label: string; focus: ProfileFocus }> = [
      { key: 'fun', label: 'Fun', focus: 'playtestFun' },
      { key: 'fairness', label: 'Fair', focus: 'playtestFairness' },
      { key: 'clarity', label: 'Clear', focus: 'playtestClarity' },
      { key: 'replay', label: 'Replay', focus: 'playtestReplay' },
    ];
    ratingRows.forEach(({ key, label, focus }, index) => {
      const y = panel.top + 328 + index * MIN_SUPPORTED_TOUCH_TARGET;
      const enabled = Boolean(state.playtestRunId);
      const focused = state.focus === focus;
      const selected = state.playtestFeedback[key];
      scene.add.rectangle(panel.cx, y, 574, 42, 0x0b1420, focused ? 0.94 : 0.68)
        .setStrokeStyle(1, focused ? UI_FIELD.cyan : 0x344b5b, focused ? 0.88 : 0.45);
      const rowHit = scene.add.rectangle(panel.cx, y, 574, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
        .setName(`profile-playtest-feedback-${key}-row`);
      if (enabled) {
        rowHit.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          setPlaytestRating(scene, state, dependencies, key, ((selected ?? 0) % 5) + 1);
        });
      }
      scene.add.text(panel.left + 78, y - 7, label, {
        fontFamily: UI_FONT,
        fontSize: '12px',
        fontStyle: UI_BOLD,
        color: enabled ? UI_FIELD.warm : '#596a78',
      }).setResolution(2);
      scene.add.text(panel.left + 174, y - 6, selected ? `${selected}/5` : 'Not rated', {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: selected ? UI_FIELD.cyanText : UI_FIELD.muted,
      }).setResolution(2);
      for (let rating = 1; rating <= 5; rating += 1) {
        const x = panel.right - 274 + (rating - 1) * MIN_SUPPORTED_TOUCH_TARGET;
        const chosen = selected === rating;
        scene.add.rectangle(x, y, 34, 24, chosen ? UI_FIELD.violet : 0x141b22, chosen ? 0.92 : 0.86)
          .setStrokeStyle(1, chosen ? 0xf0d8ff : 0x66798a, chosen ? 0.95 : 0.6);
        scene.add.text(x, y - 6, `${rating}`, {
          fontFamily: UI_FONT,
          fontSize: '11px',
          fontStyle: UI_BOLD,
          color: enabled ? (chosen ? '#ffffff' : UI_SOFT) : '#596a78',
        }).setResolution(2).setOrigin(0.5, 0);
        if (enabled) {
          scene.add.rectangle(x, y, MIN_SUPPORTED_TOUCH_TARGET, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
            .setName(`profile-playtest-feedback-${key}-${rating}`)
            .setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            setPlaytestRating(scene, state, dependencies, key, rating);
          });
        }
      }
      renderProfileFocusRing(scene, rowHit, focused, focus);
    });
    const exportHit = dependencies.renderFieldButton(
      scene,
      () => {},
      panel.cx,
      panel.bottom - 54,
      230,
      44,
      `Export ${playtestRunCount} Run${playtestRunCount === 1 ? '' : 's'}`,
      playtestRunCount > 0,
      () => exportPlaytestHistory(scene, state, dependencies),
      UI_FIELD.violet,
    );
    exportHit.setName('profile-playtest-export-hit');
    renderProfileFocusRing(scene, exportHit, state.focus === 'playtestExport', 'playtestExport');
    scene.add.text(panel.cx, panel.bottom - 16, playtestStatusText(state, playtestRunCount), {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: state.playtestExportStatus === 'failed' || state.playtestFeedbackStatus === 'failed' ? '#ffb8ad' : UI_FIELD.cyanText,
      fixedWidth: 520,
      align: 'center',
    }).setResolution(2).setOrigin(0.5).setName('profile-playtest-export-status');
  }
}

function formatBackupDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function playtestExportStatusText(status: ProfileViewState['playtestExportStatus'], count: number) {
  if (status === 'downloaded') return `${count} local run${count === 1 ? '' : 's'} downloaded`;
  if (status === 'empty') return 'Complete a run before exporting';
  if (status === 'failed') return 'Export failed; local data was unchanged';
  return 'LOCAL ONLY / NO NETWORK UPLOAD';
}

function playtestStatusText(state: ProfileViewState, count: number) {
  if (state.playtestExportStatus !== 'idle') return playtestExportStatusText(state.playtestExportStatus, count);
  if (state.playtestFeedbackStatus === 'saved') return 'RATING SAVED LOCALLY / INCLUDED IN EXPORT';
  if (state.playtestFeedbackStatus === 'failed') return 'Rating could not be saved; local run data was unchanged';
  return playtestExportStatusText(state.playtestExportStatus, count);
}

function renderProfileRecordRowFrame(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  width: number,
  height: number,
  accent: number,
  active: boolean,
) {
  const key = profileIconKey('profile-record-row-frame');
  if (scene.textures.exists(key)) {
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const row = scene.add.image(cx, cy, key)
      .setDisplaySize(width + 14, height + 8)
      .setAlpha(active ? 0.44 : 0.22)
      .setName('profile-record-row-frame');
    if (!active) row.setTint(0x707986);
    return;
  }
  scene.add.rectangle(cx, cy, width, height, active ? 0x111a25 : 0x0d141d, 0.9)
    .setStrokeStyle(1, active ? accent : 0x34404b, active ? 0.55 : 0.32);
}

function renderProfileTitlePlaque(scene: Phaser.Scene, cx: number, cy: number) {
  const key = profileIconKey('profile-title-plaque');
  if (!scene.textures.exists(key)) return;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  scene.add.image(cx, cy, key).setDisplaySize(560, 104).setAlpha(0.5).setName('profile-title-plaque');
}

function renderProfileSectionTabFrame(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  width: number,
  accent: number,
) {
  const key = profileIconKey('profile-section-tab-frame');
  if (scene.textures.exists(key)) {
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    scene.add.image(cx, cy, key)
      .setDisplaySize(width, 48)
      .setAlpha(0.58)
      .setName('profile-section-tab-frame');
    return;
  }
  scene.add.rectangle(cx, cy, width - 18, 32, 0x07101c, 0.62).setStrokeStyle(1, accent, 0.36);
}

function renderProfileReturnCommand(
  scene: Phaser.Scene,
  dependencies: ProfileSceneDependencies,
  cx: number,
  cy: number,
  width: number,
  height: number,
  onClick: () => void,
) {
  const key = profileIconKey('profile-return-command-frame');
  if (!scene.textures.exists(key)) {
    return dependencies.renderFieldButton(scene, () => {}, cx, cy, width, height, 'Return', true, onClick, UI_FIELD.gold);
  }
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const frame = scene.add.image(cx, cy, key)
    .setDisplaySize(width + 34, 62)
    .setAlpha(0.68)
    .setName('profile-return-command-frame');
  const label = scene.add.text(cx, cy - 9, 'Return', {
    fontFamily: UI_FONT,
    fontSize: '15px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#05070c',
    strokeThickness: 3,
  }).setResolution(2).setOrigin(0.5, 0);
  const hit = scene.add.rectangle(
    cx,
    cy,
    Math.max(width, MIN_SUPPORTED_TOUCH_TARGET),
    Math.max(height, MIN_SUPPORTED_TOUCH_TARGET),
    0x000000,
    0.01,
  ).setInteractive({ useHandCursor: true });
  hit.on('pointerover', () => {
    frame.setAlpha(0.84);
    label.setColor('#ffffff');
  });
  hit.on('pointerout', () => {
    frame.setAlpha(0.68);
    label.setColor(UI_FIELD.warm);
  });
  hit.on('pointerdown', () => {
    dependencies.playUiSound('close');
    onClick();
  });
  return hit;
}

function renderRecordStatChip(
  scene: Phaser.Scene,
  dependencies: ProfileSceneDependencies,
  cx: number,
  cy: number,
  width: number,
  label: string,
  value: string,
  accent: number,
) {
  const key = profileIconKey('profile-stat-chip-frame');
  if (scene.textures.exists(key)) {
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    scene.add.image(cx, cy + 1, key)
      .setDisplaySize(width + 10, 54)
      .setAlpha(0.66)
      .setName('profile-stat-chip-frame');
    scene.add.image(cx, cy + 1, key)
      .setDisplaySize(width + 14, 56)
      .setAlpha(dependencies.prefersReducedMotion() ? 0.018 : 0.032)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('profile-stat-chip-frame');
  } else {
    scene.add.rectangle(cx, cy, width, 58, 0x0b1017, 0.9).setStrokeStyle(1, accent, 0.48);
    scene.add.rectangle(cx, cy - 25, width - 16, 2, accent, 0.68);
  }
  scene.add.text(cx, cy - 15, label.toUpperCase(), {
    fontFamily: UI_FONT,
    fontSize: '9px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.muted,
  }).setResolution(2).setOrigin(0.5);
  scene.add.text(cx, cy + 10, value, {
    fontFamily: UI_FONT,
    fontSize: value.length > 12 ? '13px' : '17px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    align: 'center',
    wordWrap: { width: width - 18 },
  }).setResolution(2).setOrigin(0.5);
}

function renderProgressRail(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  label: string,
  value: number,
  total: number,
  accent: number,
) {
  const fraction = total <= 0 ? 0 : Phaser.Math.Clamp(value / total, 0, 1);
  const frameKey = profileIconKey('profile-progress-rail-frame');
  const trackInset = scene.textures.exists(frameKey) ? 14 : 0;
  const trackWidth = width - trackInset * 2;
  scene.add.text(x, y - 16, label.toUpperCase(), {
    fontFamily: UI_FONT,
    fontSize: '9px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.muted,
  }).setResolution(2);
  scene.add.text(x + width, y - 18, `${value}/${total}`, {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
  }).setResolution(2).setOrigin(1, 0);
  if (scene.textures.exists(frameKey)) {
    scene.textures.get(frameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    scene.add.image(x + width / 2, y + 6, frameKey)
      .setDisplaySize(width + 28, 34)
      .setAlpha(0.48)
      .setName('profile-progress-rail-frame');
    scene.add.rectangle(x + width / 2, y + 6, trackWidth, 8, 0x05080d, 0.58);
  } else {
    scene.add.rectangle(x + width / 2, y + 6, width, 12, 0x05080d, 0.92)
      .setStrokeStyle(1, 0x2f3c48, 0.65);
  }
  const fillWidth = fraction <= 0 ? 0 : Math.max(10, trackWidth * fraction);
  const fillKey = profileIconKey('profile-progress-fill-strip');
  if (fillWidth > 0 && scene.textures.exists(fillKey)) {
    scene.textures.get(fillKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const fill = scene.add.image(x + trackInset + fillWidth / 2, y + 6, fillKey)
      .setDisplaySize(fillWidth + 18, 16)
      .setAlpha(0.82)
      .setName('profile-progress-fill-strip');
    if (accent !== UI_FIELD.cyan) fill.setTint(accent);
    scene.add.rectangle(x + trackInset + fillWidth / 2, y + 6, Math.max(8, fillWidth - 10), 4, 0xffffff, 0.1)
      .setBlendMode(Phaser.BlendModes.ADD);
    return;
  }
  if (fillWidth > 0) scene.add.rectangle(x + trackInset + fillWidth / 2, y + 6, fillWidth, 8, accent, 0.88);
}

function renderProfileRecordFlourish(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  frame: FieldFrame,
) {
  const key = profileIconKey('profile-record-flourish');
  if (!scene.textures.exists(key)) return;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const firstReveal = state.revealBursts === 0;
  if (firstReveal) {
    state.revealBursts += 1;
    dependencies.audio.play('profileRecord', 0.78);
  }
  const reduced = dependencies.prefersReducedMotion();
  const main = scene.add.image(frame.cx, frame.cy + 8, key)
    .setDisplaySize(Math.min(frame.w + 18, 812), Math.min(frame.h - 36, 568))
    .setAlpha(reduced ? 0.36 : 0.48)
    .setName('profile-record-flourish');
  const glint = scene.add.image(frame.cx, frame.cy + 8, key)
    .setDisplaySize(Math.min(frame.w + 26, 826), Math.min(frame.h - 26, 580))
    .setAlpha(reduced ? 0.1 : 0.18)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setName('profile-record-flourish');
  if (reduced) return;
  scene.tweens.add({
    targets: [main, glint],
    alpha: { value: (target: Phaser.GameObjects.Image) => target === main ? 0.4 : 0.1 },
    scaleX: '+=0.012',
    scaleY: '+=0.012',
    duration: 2400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  if (!firstReveal) return;
  const burst = scene.add.particles(frame.cx, frame.top + 96, key, {
    lifespan: 640,
    speed: { min: 24, max: 82 },
    scale: { start: 0.018, end: 0 },
    alpha: { start: 0.2, end: 0 },
    rotate: { min: -35, max: 35 },
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
  }).setName('profile-record-flourish');
  burst.explode(8);
  scene.time.delayedCall(760, () => burst.destroy());
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI + (index / 9) * Math.PI;
    const startX = frame.cx + Math.cos(angle) * Phaser.Math.Between(60, 210);
    const startY = frame.top + 78 + Math.sin(angle) * Phaser.Math.Between(6, 34);
    const mote = scene.add.rectangle(startX, startY, Phaser.Math.Between(4, 8), 2, index % 2 === 0 ? UI_FIELD.brass : UI_FIELD.cyan, 0.78)
      .setAngle(Phaser.Math.Between(-30, 30))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('profile-record-flourish');
    scene.tweens.add({
      targets: mote,
      x: startX + Math.cos(angle) * Phaser.Math.Between(28, 74),
      y: startY - Phaser.Math.Between(10, 34),
      alpha: 0,
      scaleX: 0.2,
      duration: Phaser.Math.Between(520, 860),
      ease: 'Cubic.easeOut',
      onComplete: () => mote.destroy(),
    });
  }
}

function countTextureInGameObjects(children: any[], textureKey: string): number {
  return children.reduce((sum, child) => {
    const self = child?.texture?.key === textureKey ? 1 : 0;
    const nested = Array.isArray(child?.list) ? countTextureInGameObjects(child.list, textureKey) : 0;
    return sum + self + nested;
  }, 0);
}

function textureState(scene: Phaser.Scene, iconId: string) {
  const key = profileIconKey(iconId);
  const count = countTextureInGameObjects(scene.children.list, key);
  return { loaded: scene.textures.exists(key), rendered: count > 0, count };
}

function profileRecordFlourishState(
  scene: Phaser.Scene,
  state: ProfileViewState,
) {
  const key = profileIconKey('profile-record-flourish');
  const count = scene.children.list.filter((child: any) => (
    child.texture?.key === key || child.name === 'profile-record-flourish'
  )).length;
  return {
    loaded: scene.textures.exists(key),
    rendered: count > 0,
    count,
    revealBursts: state.revealBursts,
  };
}
