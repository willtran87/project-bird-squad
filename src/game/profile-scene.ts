import Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET } from './theme';
import { alphaCardLibrary, alphaCardSet } from './runtime-data';
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
  activeSavedDecks,
  archivedSavedDecks,
  createSavedDeckRecord,
  renameSavedDeck,
  sanitizeSavedDecks,
  SAVED_DECK_ARCHIVE_LIMIT,
  SAVED_DECK_DESCRIPTION_LIMIT,
  SAVED_DECK_FOLDERS,
  SAVED_DECK_LIMIT,
  SAVED_DECK_NAME_LIMIT,
  SAVED_DECK_NOTES_LIMIT,
  SAVED_DECK_SLEEVES,
  SAVED_DECK_TAG_LIMIT,
  SAVED_DECK_TAGS,
  setSavedDeckArchived,
  setSavedDeckCoverCard,
  setSavedDeckFolder,
  setSavedDeckSleeve,
  toggleSavedDeckFavorite,
  toggleSavedDeckTag,
  updateSavedDeckDescription,
  updateSavedDeckNotes,
  type SavedDeckFolderId,
  type SavedDeckRecord,
  type SavedDeckSleeveId,
} from './saved-decks';
import {
  duplicateSavedDeck,
  importSavedDeckCode,
  SAVED_DECK_CODE_LIMIT,
  SAVED_DECK_CODE_VERSION,
  savedDeckShareCode,
  tuneSavedDeck,
} from './saved-deck-library';
import {
  analyzeSavedDeck,
  suggestSavedDeckReplacements,
  type SavedDeckLabAnalysis,
  type SavedDeckLabReplacement,
} from './saved-deck-lab';
import {
  analyzeSavedDeckCollectionSignals,
  type SavedDeckCollectionSignals,
} from './saved-deck-collection-signals';
import {
  compareSavedDeckRevisions,
  restoreSavedDeckRevision,
  savedDeckRevisionTargets,
  type SavedDeckRevisionComparison,
} from './saved-deck-revisions';
import {
  buildSavedDeckFieldRecord,
  type SavedDeckFieldRecord,
} from './saved-deck-field-record';
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
const BADGE_PAGE_SIZE = 5;
const SAVED_DECK_PAGE_SIZE = 1;
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
  leaderId: string;
  leader: string;
  difficulty: string;
  runMode: SharedRouteMode;
  completedAtMs: number;
  durationMs: number;
  currentCohesion: number;
  maxCohesion: number;
  turns: number;
  deckSize: number;
  deck: SavedDeckRecord['cards'];
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
  savedDeckArchiveView: boolean;
  savedDeckStatus:
    | 'idle'
    | 'favorited'
    | 'unfavorited'
    | 'renamed'
    | 'duplicated'
    | 'tuned'
    | 'revisionRestored'
    | 'notesSaved'
    | 'organized'
    | 'personalized'
    | 'descriptionSaved'
    | 'templateCreated'
    | 'templateUnavailable'
    | 'tagLimit'
    | 'archived'
    | 'restored'
    | 'archiveFull'
    | 'activeFull'
    | 'full'
    | 'codeCopied'
    | 'copyFailed'
    | 'imported'
    | 'invalidCode'
    | 'failed';
  savedDeckRenameInput?: HTMLInputElement;
  savedDeckCodeInput?: HTMLInputElement;
  savedDeckTemplateOpen?: boolean;
  savedDeckTemplateIndex?: number;
  savedDeckOrganizerOpen: boolean;
  savedDeckOrganizerDeckId?: string;
  savedDeckOrganizerSection: 'folder' | 'tags';
  savedDeckOrganizerIndex: number;
  savedDeckIdentityOpen: boolean;
  savedDeckIdentityDeckId?: string;
  savedDeckIdentitySection: 'cover' | 'sleeve';
  savedDeckIdentityIndex: number;
  savedDeckDescriptionInput?: HTMLInputElement;
  savedDeckLabOpen: boolean;
  savedDeckLabSample: number;
  savedDeckCollectionSignalsOpen: boolean;
  savedDeckCollectionSignalsDeckId?: string;
  savedDeckFieldRecordOpen: boolean;
  savedDeckFieldRecordDeckId?: string;
  savedDeckNotesInput?: HTMLTextAreaElement;
  savedDeckHistoryOpen: boolean;
  savedDeckHistoryDeckId?: string;
  savedDeckHistoryTargetIndex: number;
  savedDeckWorkshopOpen: boolean;
  savedDeckWorkshopDeckId?: string;
  savedDeckWorkshopCardIndex: number;
  savedDeckWorkshopSuggestionIndex: number;
}

export interface ProfileSceneDependencies {
  advanceGameTime: (game: Phaser.Game, ms: number) => void;
  hasActiveRun: () => boolean;
  run: (
    leaderId: string,
    difficulty: number,
    runMode: SavedDeckRecord['runMode'],
    seed: undefined,
    cards: SavedDeckRecord['cards'],
  ) => unknown;
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
    const decks = savedDecksForView(state, sanitizeSavedDecks(loadAccount().decks));
    return Math.max(1, Math.ceil(decks.length / SAVED_DECK_PAGE_SIZE));
  }
  const total = state.badgeView === 'achievements'
    ? achievements.length + COLLECTION_MILESTONE_COUNT
    : loadAccount().contractBadges.length;
  return Math.max(1, Math.ceil(total / BADGE_PAGE_SIZE));
}

function savedDecksForView(
  state: ProfileViewState,
  decks: readonly SavedDeckRecord[],
) {
  return state.savedDeckArchiveView ? archivedSavedDecks(decks) : activeSavedDecks(decks);
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
  const decks = savedDecksForView(state, sanitizeSavedDecks(loadAccount().decks));
  state.savedDeckIndex = Phaser.Math.Clamp(state.savedDeckIndex, 0, Math.max(0, decks.length - 1));
  return decks[state.savedDeckIndex];
}

function selectSavedDeck(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  index: number,
) {
  const decks = savedDecksForView(state, sanitizeSavedDecks(loadAccount().decks));
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
  const decks = savedDecksForView(state, sanitizeSavedDecks(loadAccount().decks));
  if (decks.length === 0) {
    dependencies.playUiSound('locked');
    return;
  }
  selectSavedDeck(scene, state, dependencies, (state.savedDeckIndex + direction + decks.length) % decks.length);
}

function toggleSavedDeckArchiveView(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  state.savedDeckArchiveView = !state.savedDeckArchiveView;
  state.savedDeckIndex = 0;
  state.badgePage = 0;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function toggleSelectedSavedDeckArchived(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const account = loadAccount();
  const decks = sanitizeSavedDecks(account.decks);
  const selected = selectedSavedDeck(state);
  if (!selected) {
    dependencies.playUiSound('locked');
    return;
  }
  const archived = archivedSavedDecks(decks);
  const active = activeSavedDecks(decks);
  if (!selected.archived && archived.length >= SAVED_DECK_ARCHIVE_LIMIT) {
    state.savedDeckStatus = 'archiveFull';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  if (selected.archived && active.length >= SAVED_DECK_LIMIT) {
    state.savedDeckStatus = 'activeFull';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  const next = setSavedDeckArchived(decks, selected.id, !selected.archived);
  const changed = next.find((deck) => deck.id === selected.id)?.archived !== selected.archived;
  if (!changed) {
    state.savedDeckStatus = 'failed';
    dependencies.playUiSound('locked');
  } else {
    account.decks = next;
    if (!saveAccount(account)) {
      state.savedDeckStatus = 'failed';
      dependencies.playUiSound('locked');
    } else {
      state.savedDeckArchiveView = !selected.archived;
      state.savedDeckIndex = 0;
      state.badgePage = 0;
      state.savedDeckStatus = selected.archived ? 'restored' : 'archived';
      dependencies.playUiSound(selected.archived ? 'confirm' : 'close');
    }
  }
  renderProfileScene(scene, state, dependencies);
}

function savedDeckTemplateOptions(account = loadAccount()) {
  const owned = new Set(Object.entries(account.cardCollection)
    .filter(([, record]) => record.timesClaimed > 0)
    .map(([id]) => id));
  const activeCount = activeSavedDecks(sanitizeSavedDecks(account.decks)).length;
  return flockLeaders.map((leader) => {
    const missing = leader.startingDeckIds.filter((id) => !owned.has(id));
    const missingNames = missing.map((id) => (
      alphaCardSet.cards.find((card) => card.id === id)?.displayName ?? id
    ));
    const unlocked = isLeaderUnlocked(account, leader.id);
    const available = activeCount < SAVED_DECK_LIMIT && unlocked && missing.length === 0;
    return {
      leader,
      unlocked,
      owned: leader.startingDeckIds.length - missing.length,
      missing: missing.length,
      missingIds: missing,
      missingNames,
      available,
      reason: activeCount >= SAVED_DECK_LIMIT
        ? 'Active Folios full'
        : !unlocked
          ? 'Leader locked'
          : missing.length > 0
            ? `Claim ${missing.length} starter card${missing.length === 1 ? '' : 's'}`
            : 'Ready to build',
    };
  });
}

function openSavedDeckTemplate(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  state.savedDeckTemplateOpen = true;
  state.savedDeckTemplateIndex = 0;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function closeSavedDeckTemplate(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  state.savedDeckTemplateOpen = false;
  state.savedDeckTemplateIndex = 0;
  dependencies.playUiSound('close');
  renderProfileScene(scene, state, dependencies);
}

function cycleSavedDeckTemplate(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  direction: -1 | 1,
) {
  const options = savedDeckTemplateOptions();
  state.savedDeckTemplateIndex = (
    (state.savedDeckTemplateIndex ?? 0) + direction + options.length
  ) % options.length;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function createSavedDeckFromTemplate(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const account = loadAccount();
  const decks = sanitizeSavedDecks(account.decks);
  const options = savedDeckTemplateOptions(account);
  const selected = options[Phaser.Math.Clamp(state.savedDeckTemplateIndex ?? 0, 0, options.length - 1)];
  if (!selected?.available) {
    state.savedDeckStatus = 'templateUnavailable';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  const priorTemplates = decks.filter((deck) => (
    deck.sourceSeed === `starter-template:${selected.leader.id}`
  )).length;
  const record = createSavedDeckRecord({
    name: `${selected.leader.name} Starter${priorTemplates > 0 ? ` ${priorTemplates + 1}` : ''}`,
    leaderId: selected.leader.id,
    cards: selected.leader.startingDeckIds.map((id) => ({ id })),
    sourceSeed: `starter-template:${selected.leader.id}`,
    runMode: 'full',
  });
  account.decks = [record, ...decks];
  if (!saveAccount(account)) {
    state.savedDeckStatus = 'failed';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  state.savedDeckTemplateOpen = false;
  state.savedDeckTemplateIndex = 0;
  state.savedDeckArchiveView = false;
  state.savedDeckIndex = 0;
  state.badgePage = 0;
  state.savedDeckStatus = 'templateCreated';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function savedDeckOrganizerDeck(state: ProfileViewState, account = loadAccount()) {
  return sanitizeSavedDecks(account.decks)
    .find((deck) => deck.id === state.savedDeckOrganizerDeckId);
}

function organizerChoiceCount(state: ProfileViewState) {
  return state.savedDeckOrganizerSection === 'folder'
    ? SAVED_DECK_FOLDERS.length
    : SAVED_DECK_TAGS.length;
}

function openSavedDeckOrganizer(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const selected = selectedSavedDeck(state);
  if (!selected || state.savedDeckRenameInput || state.savedDeckCodeInput) {
    dependencies.playUiSound('locked');
    return;
  }
  state.savedDeckOrganizerOpen = true;
  state.savedDeckOrganizerDeckId = selected.id;
  state.savedDeckOrganizerSection = 'folder';
  state.savedDeckOrganizerIndex = Math.max(
    0,
    SAVED_DECK_FOLDERS.findIndex((folder) => folder.id === (selected.folder ?? 'unfiled')),
  );
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function closeSavedDeckOrganizer(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  state.savedDeckOrganizerOpen = false;
  state.savedDeckOrganizerDeckId = undefined;
  state.focus = 'folios';
  dependencies.playUiSound('close');
  renderProfileScene(scene, state, dependencies);
}

function switchSavedDeckOrganizerSection(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  section?: 'folder' | 'tags',
) {
  if (!state.savedDeckOrganizerOpen) return;
  state.savedDeckOrganizerSection = section
    ?? (state.savedDeckOrganizerSection === 'folder' ? 'tags' : 'folder');
  const deck = savedDeckOrganizerDeck(state);
  state.savedDeckOrganizerIndex = state.savedDeckOrganizerSection === 'folder'
    ? Math.max(0, SAVED_DECK_FOLDERS.findIndex((folder) => folder.id === (deck?.folder ?? 'unfiled')))
    : Math.max(0, SAVED_DECK_TAGS.findIndex((tag) => deck?.tags?.includes(tag.id)));
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function cycleSavedDeckOrganizerChoice(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  direction: -1 | 1,
) {
  if (!state.savedDeckOrganizerOpen) return;
  const count = organizerChoiceCount(state);
  state.savedDeckOrganizerIndex = (state.savedDeckOrganizerIndex + direction + count) % count;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function applySavedDeckOrganizerChoice(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const account = loadAccount();
  const decks = sanitizeSavedDecks(account.decks);
  const deck = savedDeckOrganizerDeck(state, account);
  if (!deck) {
    state.savedDeckStatus = 'failed';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  if (state.savedDeckOrganizerSection === 'folder') {
    const folder = SAVED_DECK_FOLDERS[state.savedDeckOrganizerIndex]?.id as SavedDeckFolderId | undefined;
    if (!folder) return;
    account.decks = setSavedDeckFolder(decks, deck.id, folder);
  } else {
    const tag = SAVED_DECK_TAGS[state.savedDeckOrganizerIndex]?.id;
    if (!tag) return;
    const before = deck.tags ?? [];
    const next = toggleSavedDeckTag(decks, deck.id, tag);
    const after = next.find((candidate) => candidate.id === deck.id)?.tags ?? [];
    if (!before.includes(tag) && after.length === before.length) {
      state.savedDeckStatus = 'tagLimit';
      dependencies.playUiSound('locked');
      renderProfileScene(scene, state, dependencies);
      return;
    }
    account.decks = next;
  }
  if (!saveAccount(account)) {
    state.savedDeckStatus = 'failed';
    dependencies.playUiSound('locked');
  } else {
    state.savedDeckStatus = 'organized';
    dependencies.playUiSound('confirm');
  }
  renderProfileScene(scene, state, dependencies);
}

function savedDeckIdentityDeck(state: ProfileViewState, account = loadAccount()) {
  return sanitizeSavedDecks(account.decks)
    .find((deck) => deck.id === state.savedDeckIdentityDeckId);
}

function savedDeckCoverChoices(deck: SavedDeckRecord) {
  return [...new Set(deck.cards.map((card) => card.id))];
}

function identityChoiceCount(state: ProfileViewState, deck: SavedDeckRecord) {
  return state.savedDeckIdentitySection === 'cover'
    ? savedDeckCoverChoices(deck).length
    : SAVED_DECK_SLEEVES.length;
}

function openSavedDeckIdentity(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const deck = savedDeckOrganizerDeck(state) ?? selectedSavedDeck(state);
  if (
    !deck
    || state.savedDeckRenameInput
    || state.savedDeckCodeInput
    || state.savedDeckDescriptionInput
  ) {
    dependencies.playUiSound('locked');
    return;
  }
  state.savedDeckOrganizerOpen = false;
  state.savedDeckIdentityOpen = true;
  state.savedDeckIdentityDeckId = deck.id;
  state.savedDeckIdentitySection = 'cover';
  const choices = savedDeckCoverChoices(deck);
  state.savedDeckIdentityIndex = Math.max(0, choices.indexOf(deck.coverCardId ?? choices[0]));
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  dependencies.queueCardShowcaseAssets(scene, choices, () => {
    if (scene.scene.isActive() && state.savedDeckIdentityOpen) {
      renderProfileScene(scene, state, dependencies);
    }
  });
  renderProfileScene(scene, state, dependencies);
}

function closeSavedDeckDescription(state: ProfileViewState) {
  state.savedDeckDescriptionInput?.remove();
  state.savedDeckDescriptionInput = undefined;
}

function closeSavedDeckIdentity(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  closeSavedDeckDescription(state);
  const deckId = state.savedDeckIdentityDeckId;
  state.savedDeckIdentityOpen = false;
  state.savedDeckIdentityDeckId = undefined;
  state.savedDeckOrganizerOpen = Boolean(deckId);
  state.savedDeckOrganizerDeckId = deckId;
  state.focus = 'folios';
  dependencies.playUiSound('close');
  renderProfileScene(scene, state, dependencies);
}

function switchSavedDeckIdentitySection(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  section?: 'cover' | 'sleeve',
) {
  const deck = savedDeckIdentityDeck(state);
  if (!deck || state.savedDeckDescriptionInput) return;
  state.savedDeckIdentitySection = section
    ?? (state.savedDeckIdentitySection === 'cover' ? 'sleeve' : 'cover');
  if (state.savedDeckIdentitySection === 'cover') {
    const choices = savedDeckCoverChoices(deck);
    state.savedDeckIdentityIndex = Math.max(0, choices.indexOf(deck.coverCardId ?? choices[0]));
  } else {
    state.savedDeckIdentityIndex = Math.max(
      0,
      SAVED_DECK_SLEEVES.findIndex((sleeve) => sleeve.id === (deck.sleeve ?? 'field')),
    );
  }
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function cycleSavedDeckIdentityChoice(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  direction: -1 | 1,
) {
  const deck = savedDeckIdentityDeck(state);
  if (!deck || state.savedDeckDescriptionInput) return;
  const count = identityChoiceCount(state, deck);
  if (count <= 1) {
    dependencies.playUiSound('locked');
    return;
  }
  state.savedDeckIdentityIndex = (state.savedDeckIdentityIndex + direction + count) % count;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function applySavedDeckIdentityChoice(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const account = loadAccount();
  const decks = sanitizeSavedDecks(account.decks);
  const deck = savedDeckIdentityDeck(state, account);
  if (!deck || state.savedDeckDescriptionInput) {
    dependencies.playUiSound('locked');
    return;
  }
  if (state.savedDeckIdentitySection === 'cover') {
    const coverCardId = savedDeckCoverChoices(deck)[state.savedDeckIdentityIndex];
    if (!coverCardId) return;
    account.decks = setSavedDeckCoverCard(decks, deck.id, coverCardId);
  } else {
    const sleeve = SAVED_DECK_SLEEVES[state.savedDeckIdentityIndex]?.id as SavedDeckSleeveId | undefined;
    if (!sleeve) return;
    account.decks = setSavedDeckSleeve(decks, deck.id, sleeve);
  }
  if (!saveAccount(account)) {
    state.savedDeckStatus = 'failed';
    dependencies.playUiSound('locked');
  } else {
    state.savedDeckStatus = 'personalized';
    dependencies.playUiSound('confirm');
  }
  renderProfileScene(scene, state, dependencies);
}

function beginSavedDeckDescription(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const deck = savedDeckIdentityDeck(state);
  if (!deck || state.savedDeckDescriptionInput) {
    dependencies.playUiSound('locked');
    return;
  }
  const input = document.createElement('input');
  input.type = 'text';
  input.value = deck.description ?? '';
  input.maxLength = SAVED_DECK_DESCRIPTION_LIMIT;
  input.placeholder = 'Describe this Folio in one clear line';
  input.setAttribute('aria-label', 'Private Folio description');
  input.setAttribute('autocomplete', 'off');
  Object.assign(input.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    width: 'min(680px, calc(100vw - 48px))',
    transform: 'translate(-50%, -50%)',
    zIndex: '10000',
    boxSizing: 'border-box',
    padding: '14px 18px',
    border: '2px solid #f0c36f',
    borderRadius: '4px',
    outline: '4px solid rgba(5, 12, 20, 0.92)',
    background: '#0a1420',
    color: '#ffe1a3',
    font: 'bold 17px Arial',
    textAlign: 'left',
  });
  document.body.append(input);
  state.savedDeckDescriptionInput = input;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);

  let finished = false;
  const finish = (commit: boolean) => {
    if (finished) return;
    finished = true;
    if (commit) {
      const account = loadAccount();
      account.decks = updateSavedDeckDescription(
        sanitizeSavedDecks(account.decks),
        deck.id,
        input.value,
      );
      if (saveAccount(account)) {
        state.savedDeckStatus = 'descriptionSaved';
        dependencies.playUiSound('confirm');
      } else {
        state.savedDeckStatus = 'failed';
        dependencies.playUiSound('locked');
      }
    } else {
      dependencies.playUiSound('close');
    }
    closeSavedDeckDescription(state);
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
  scene.events.once('shutdown', () => closeSavedDeckDescription(state));
  window.setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
}

function openSavedDeckLab(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const selected = selectedSavedDeck(state);
  if (!selected || state.savedDeckRenameInput || state.savedDeckCodeInput || state.savedDeckOrganizerOpen) {
    dependencies.playUiSound('locked');
    return;
  }
  state.savedDeckLabOpen = true;
  state.savedDeckLabSample = 0;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  dependencies.queueCardShowcaseAssets(
    scene,
    [...new Set(selected.cards.map((card) => card.id).filter((id) => alphaCardLibrary.has(id)))],
    () => {
      if (scene.scene.isActive() && state.savedDeckLabOpen) renderProfileScene(scene, state, dependencies);
    },
  );
  renderProfileScene(scene, state, dependencies);
}

function closeSavedDeckLab(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  state.savedDeckLabOpen = false;
  state.focus = 'folios';
  dependencies.playUiSound('close');
  renderProfileScene(scene, state, dependencies);
}

function cycleSavedDeckLabSample(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  direction: -1 | 1,
) {
  if (!state.savedDeckLabOpen) return;
  const next = Phaser.Math.Clamp(state.savedDeckLabSample + direction, 0, 999);
  if (next === state.savedDeckLabSample) {
    dependencies.playUiSound('locked');
    return;
  }
  state.savedDeckLabSample = next;
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

type SavedDeckLaunchBlock =
  | 'activeFlight'
  | 'archived'
  | 'lockedLeader'
  | 'reviewNeeded'
  | 'unownedCards';

interface SavedDeckLaunchState {
  available: boolean;
  block?: SavedDeckLaunchBlock;
  missingOwnedIds: string[];
  label: string;
  detail: string;
}

function savedDeckLaunchState(
  deck: SavedDeckRecord,
  analysis: SavedDeckLabAnalysis,
  account: PlayerAccount,
  dependencies: ProfileSceneDependencies,
): SavedDeckLaunchState {
  const owned = new Set(Object.entries(account.cardCollection)
    .filter(([, record]) => record.timesClaimed > 0)
    .map(([id]) => id));
  const missingOwnedIds = [...new Set(deck.cards.map((card) => card.id))]
    .filter((id) => !owned.has(id));
  if (dependencies.hasActiveRun()) {
    return {
      available: false,
      block: 'activeFlight',
      missingOwnedIds,
      label: 'Flight Active',
      detail: 'Resume or finish the active flight before launching another.',
    };
  }
  if (deck.archived) {
    return {
      available: false,
      block: 'archived',
      missingOwnedIds,
      label: 'Restore to Fly',
      detail: 'Archived Folios stay preserved; restore this one to Active first.',
    };
  }
  if (!isLeaderUnlocked(account, deck.leaderId)) {
    return {
      available: false,
      block: 'lockedLeader',
      missingOwnedIds,
      label: 'Leader Locked',
      detail: 'Unlock this Folio leader before taking the saved deck into a flight.',
    };
  }
  if (!analysis.legalForStandardFlight) {
    return {
      available: false,
      block: 'reviewNeeded',
      missingOwnedIds,
      label: 'Review Folio',
      detail: 'Resolve duplicate or unavailable card definitions before launch.',
    };
  }
  if (missingOwnedIds.length > 0) {
    return {
      available: false,
      block: 'unownedCards',
      missingOwnedIds,
      label: `Claim ${missingOwnedIds.length} Card${missingOwnedIds.length === 1 ? '' : 's'}`,
      detail: 'Shared codes never grant collection ownership. Claim every card before launch.',
    };
  }
  return {
    available: true,
    missingOwnedIds: [],
    label: 'Fly This Folio',
    detail: 'Tier 0 / fresh route / exact saved order and Base or Preened states.',
  };
}

function launchSelectedSavedDeck(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const deck = selectedSavedDeck(state);
  if (!deck) {
    dependencies.playUiSound('locked');
    return;
  }
  const launch = savedDeckLaunchState(
    deck,
    analyzeSavedDeck(deck, alphaCardLibrary, state.savedDeckLabSample),
    loadAccount(),
    dependencies,
  );
  if (!launch.available) {
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  dependencies.playUiSound('confirm');
  scene.scene.start('RouteScene', {
    runState: dependencies.run(deck.leaderId, 0, deck.runMode, undefined, deck.cards),
  });
}

function savedDeckCollectionSignalsState(
  state: ProfileViewState,
  account = loadAccount(),
) {
  const decks = sanitizeSavedDecks(account.decks);
  const deck = decks.find((candidate) => candidate.id === state.savedDeckCollectionSignalsDeckId);
  if (!deck) return undefined;
  return analyzeSavedDeckCollectionSignals(deck, decks, account.cardCollection, alphaCardLibrary);
}

function openSavedDeckCollectionSignals(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const selected = selectedSavedDeck(state);
  if (!selected || state.savedDeckRenameInput || state.savedDeckCodeInput) {
    dependencies.playUiSound('locked');
    return;
  }
  state.savedDeckLabOpen = false;
  state.savedDeckCollectionSignalsOpen = true;
  state.savedDeckCollectionSignalsDeckId = selected.id;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function closeSavedDeckCollectionSignals(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  state.savedDeckCollectionSignalsOpen = false;
  state.savedDeckLabOpen = true;
  state.savedDeckLabSample = 0;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('close');
  renderProfileScene(scene, state, dependencies);
}

interface SavedDeckFieldRecordState {
  deck: SavedDeckRecord;
  record: SavedDeckFieldRecord;
}

function savedDeckFieldRecordState(
  state: ProfileViewState,
  flights: readonly FlightHistoryEntry[],
  account = loadAccount(),
): SavedDeckFieldRecordState | undefined {
  const deck = sanitizeSavedDecks(account.decks)
    .find((candidate) => candidate.id === state.savedDeckFieldRecordDeckId);
  if (!deck) return undefined;
  return {
    deck,
    record: buildSavedDeckFieldRecord(deck, flights),
  };
}

function closeSavedDeckNotes(state: ProfileViewState) {
  state.savedDeckNotesInput?.remove();
  state.savedDeckNotesInput = undefined;
}

function openSavedDeckFieldRecord(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const selected = selectedSavedDeck(state);
  if (!selected || state.savedDeckRenameInput || state.savedDeckCodeInput) {
    dependencies.playUiSound('locked');
    return;
  }
  state.savedDeckLabOpen = false;
  state.savedDeckFieldRecordOpen = true;
  state.savedDeckFieldRecordDeckId = selected.id;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function closeSavedDeckFieldRecord(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  closeSavedDeckNotes(state);
  state.savedDeckFieldRecordOpen = false;
  state.savedDeckLabOpen = true;
  state.savedDeckLabSample = 0;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('close');
  renderProfileScene(scene, state, dependencies);
}

function beginSavedDeckNotes(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const field = savedDeckFieldRecordState(state, dependencies.flightHistory());
  if (!field || state.savedDeckNotesInput) {
    dependencies.playUiSound('locked');
    return;
  }
  const input = document.createElement('textarea');
  input.value = field.deck.notes ?? '';
  input.maxLength = SAVED_DECK_NOTES_LIMIT;
  input.rows = 4;
  input.setAttribute('aria-label', 'Private Folio matchup notes');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'true');
  Object.assign(input.style, {
    position: 'fixed',
    left: '50%',
    top: '52%',
    width: 'min(620px, calc(100vw - 48px))',
    minHeight: '132px',
    transform: 'translate(-50%, -50%)',
    zIndex: '10000',
    boxSizing: 'border-box',
    padding: '14px 18px',
    border: '2px solid #8df4ff',
    borderRadius: '4px',
    outline: '4px solid rgba(5, 12, 20, 0.92)',
    background: '#0a1420',
    color: '#ffe1a3',
    font: 'bold 16px Arial',
    lineHeight: '1.45',
    resize: 'none',
  });
  document.body.append(input);
  state.savedDeckNotesInput = input;
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
      account.decks = updateSavedDeckNotes(decks, field.deck.id, input.value);
      if (saveAccount(account)) {
        state.savedDeckStatus = 'notesSaved';
        dependencies.playUiSound('confirm');
      } else {
        state.savedDeckStatus = 'failed';
        dependencies.playUiSound('locked');
      }
    } else {
      dependencies.playUiSound('close');
    }
    closeSavedDeckNotes(state);
    if (scene.scene.isActive()) renderProfileScene(scene, state, dependencies);
  };
  input.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      finish(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true), { once: true });
  scene.events.once('shutdown', () => closeSavedDeckNotes(state));
  window.setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
}

interface SavedDeckHistoryState {
  source: SavedDeckRecord;
  targets: SavedDeckRecord[];
  target?: SavedDeckRecord;
  targetIndex: number;
  comparison?: SavedDeckRevisionComparison;
}

function savedDeckHistoryState(
  state: ProfileViewState,
  account = loadAccount(),
): SavedDeckHistoryState | undefined {
  const decks = sanitizeSavedDecks(account.decks);
  const source = decks.find((deck) => deck.id === state.savedDeckHistoryDeckId);
  if (!source) return undefined;
  const targets = savedDeckRevisionTargets(decks, source.id);
  const targetIndex = Phaser.Math.Clamp(
    state.savedDeckHistoryTargetIndex,
    0,
    Math.max(0, targets.length - 1),
  );
  const target = targets[targetIndex];
  return {
    source,
    targets,
    target,
    targetIndex,
    ...(target ? { comparison: compareSavedDeckRevisions(source, target) } : {}),
  };
}

function queueSavedDeckHistoryAssets(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const history = savedDeckHistoryState(state);
  if (!history?.target) return;
  const ids = history.comparison?.cardChanges.flatMap((change) => [
    change.current?.id,
    change.target?.id,
  ]).filter((id): id is string => typeof id === 'string' && alphaCardLibrary.has(id)) ?? [];
  dependencies.queueCardShowcaseAssets(scene, [...new Set(ids)], () => {
    if (scene.scene.isActive() && state.savedDeckHistoryOpen) {
      renderProfileScene(scene, state, dependencies);
    }
  });
}

function openSavedDeckHistory(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const selected = selectedSavedDeck(state);
  if (!selected || state.savedDeckRenameInput || state.savedDeckCodeInput) {
    dependencies.playUiSound('locked');
    return;
  }
  state.savedDeckLabOpen = false;
  state.savedDeckHistoryOpen = true;
  state.savedDeckHistoryDeckId = selected.id;
  state.savedDeckHistoryTargetIndex = 0;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  queueSavedDeckHistoryAssets(scene, state, dependencies);
  renderProfileScene(scene, state, dependencies);
}

function closeSavedDeckHistory(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  state.savedDeckHistoryOpen = false;
  state.savedDeckLabOpen = true;
  state.savedDeckLabSample = 0;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('close');
  renderProfileScene(scene, state, dependencies);
}

function cycleSavedDeckHistoryTarget(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  direction: -1 | 1,
) {
  const history = savedDeckHistoryState(state);
  if (!history || history.targets.length <= 1) {
    dependencies.playUiSound('locked');
    return;
  }
  state.savedDeckHistoryTargetIndex = (
    history.targetIndex + direction + history.targets.length
  ) % history.targets.length;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  queueSavedDeckHistoryAssets(scene, state, dependencies);
  renderProfileScene(scene, state, dependencies);
}

function restoreSelectedSavedDeckRevision(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const account = loadAccount();
  const decks = sanitizeSavedDecks(account.decks);
  const history = savedDeckHistoryState(state, account);
  if (!history?.target || history.comparison?.exactMatch) {
    state.savedDeckStatus = 'failed';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  if (activeSavedDecks(decks).length >= SAVED_DECK_LIMIT) {
    state.savedDeckStatus = 'activeFull';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  const restored = restoreSavedDeckRevision(
    decks,
    history.source.id,
    history.target.id,
  );
  if (restored.length !== decks.length + 1) {
    state.savedDeckStatus = 'failed';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  account.decks = restored;
  if (!saveAccount(account)) {
    state.savedDeckStatus = 'failed';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  state.savedDeckHistoryOpen = false;
  state.savedDeckHistoryDeckId = undefined;
  state.savedDeckArchiveView = false;
  state.savedDeckIndex = 0;
  state.badgePage = 0;
  state.savedDeckStatus = 'revisionRestored';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

interface SavedDeckWorkshopState {
  deck: SavedDeckRecord;
  cardIndex: number;
  sourceCard: SavedDeckRecord['cards'][number];
  sourceName: string;
  suggestions: SavedDeckLabReplacement[];
}

function savedDeckWorkshopState(
  state: ProfileViewState,
  account = loadAccount(),
): SavedDeckWorkshopState | undefined {
  const decks = sanitizeSavedDecks(account.decks);
  const deck = decks.find((candidate) => candidate.id === state.savedDeckWorkshopDeckId);
  if (!deck || deck.cards.length === 0) return undefined;
  const cardIndex = Phaser.Math.Clamp(state.savedDeckWorkshopCardIndex, 0, deck.cards.length - 1);
  const sourceCard = deck.cards[cardIndex];
  const sourceName = alphaCardLibrary.get(sourceCard.id)?.displayName ?? sourceCard.id;
  const ownedCardIds = Object.entries(account.cardCollection)
    .filter(([, record]) => record.timesClaimed > 0)
    .map(([id]) => id);
  const suggestions = suggestSavedDeckReplacements(
    deck,
    cardIndex,
    ownedCardIds,
    alphaCardLibrary,
  );
  return { deck, cardIndex, sourceCard, sourceName, suggestions };
}

function queueSavedDeckWorkshopAssets(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const workshop = savedDeckWorkshopState(state);
  if (!workshop) return;
  const ids = [workshop.sourceCard.id, ...workshop.suggestions.map((candidate) => candidate.id)]
    .filter((id) => alphaCardLibrary.has(id));
  dependencies.queueCardShowcaseAssets(scene, [...new Set(ids)], () => {
    if (scene.scene.isActive() && state.savedDeckWorkshopOpen) renderProfileScene(scene, state, dependencies);
  });
}

function openSavedDeckWorkshop(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const selected = selectedSavedDeck(state);
  if (!selected || state.savedDeckRenameInput || state.savedDeckCodeInput) {
    dependencies.playUiSound('locked');
    return;
  }
  state.savedDeckLabOpen = false;
  state.savedDeckWorkshopOpen = true;
  state.savedDeckWorkshopDeckId = selected.id;
  state.savedDeckWorkshopCardIndex = 0;
  state.savedDeckWorkshopSuggestionIndex = 0;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  queueSavedDeckWorkshopAssets(scene, state, dependencies);
  renderProfileScene(scene, state, dependencies);
}

function closeSavedDeckWorkshop(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  state.savedDeckWorkshopOpen = false;
  state.savedDeckLabOpen = true;
  state.savedDeckLabSample = 0;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('close');
  renderProfileScene(scene, state, dependencies);
}

function cycleSavedDeckWorkshopCard(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  direction: -1 | 1,
) {
  const workshop = savedDeckWorkshopState(state);
  if (!workshop) {
    dependencies.playUiSound('locked');
    return;
  }
  state.savedDeckWorkshopCardIndex = (
    workshop.cardIndex + direction + workshop.deck.cards.length
  ) % workshop.deck.cards.length;
  state.savedDeckWorkshopSuggestionIndex = 0;
  dependencies.playUiSound('confirm');
  queueSavedDeckWorkshopAssets(scene, state, dependencies);
  renderProfileScene(scene, state, dependencies);
}

function cycleSavedDeckWorkshopSuggestion(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  direction: -1 | 1,
) {
  const workshop = savedDeckWorkshopState(state);
  if (!workshop || workshop.suggestions.length === 0) {
    dependencies.playUiSound('locked');
    return;
  }
  state.savedDeckWorkshopSuggestionIndex = (
    state.savedDeckWorkshopSuggestionIndex + direction + workshop.suggestions.length
  ) % workshop.suggestions.length;
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function saveSavedDeckWorkshopRevision(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const account = loadAccount();
  const decks = sanitizeSavedDecks(account.decks);
  const workshop = savedDeckWorkshopState(state, account);
  const replacement = workshop?.suggestions[
    Phaser.Math.Clamp(state.savedDeckWorkshopSuggestionIndex, 0, Math.max(0, workshop.suggestions.length - 1))
  ];
  if (!workshop || !replacement) {
    state.savedDeckStatus = 'failed';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  if (activeSavedDecks(decks).length >= SAVED_DECK_LIMIT) {
    state.savedDeckStatus = 'activeFull';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  const tuned = tuneSavedDeck(
    decks,
    workshop.deck.id,
    workshop.cardIndex,
    replacement.id,
  );
  if (tuned.length !== decks.length + 1) {
    state.savedDeckStatus = 'failed';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  account.decks = tuned;
  if (!saveAccount(account)) {
    state.savedDeckStatus = 'failed';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  state.savedDeckWorkshopOpen = false;
  state.savedDeckWorkshopDeckId = undefined;
  state.savedDeckArchiveView = false;
  state.savedDeckIndex = 0;
  state.badgePage = 0;
  state.savedDeckStatus = 'tuned';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function toggleSelectedSavedDeckFavorite(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const account = loadAccount();
  const decks = sanitizeSavedDecks(account.decks);
  const selected = selectedSavedDeck(state);
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

function duplicateSelectedSavedDeck(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const account = loadAccount();
  const decks = sanitizeSavedDecks(account.decks);
  const selected = selectedSavedDeck(state);
  const active = activeSavedDecks(decks);
  if (!selected || active.length >= SAVED_DECK_LIMIT) {
    state.savedDeckStatus = active.length >= SAVED_DECK_LIMIT ? 'full' : 'failed';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  const duplicated = duplicateSavedDeck(decks, selected.id);
  if (duplicated.length !== decks.length + 1) {
    state.savedDeckStatus = 'failed';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  account.decks = duplicated;
  if (!saveAccount(account)) {
    state.savedDeckStatus = 'failed';
    dependencies.playUiSound('locked');
  } else {
    state.savedDeckArchiveView = false;
    state.savedDeckIndex = 0;
    state.badgePage = 0;
    state.savedDeckStatus = 'duplicated';
    dependencies.playUiSound('confirm');
  }
  renderProfileScene(scene, state, dependencies);
}

function copySelectedSavedDeckCode(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const selected = selectedSavedDeck(state);
  if (!selected) {
    dependencies.playUiSound('locked');
    return;
  }
  const code = savedDeckShareCode(selected);
  void (async () => {
    let copied = false;
    try {
      await navigator.clipboard?.writeText(code);
      copied = Boolean(navigator.clipboard);
    } catch {
      copied = false;
    }
    if (!scene.scene.isActive()) return;
    state.savedDeckStatus = copied ? 'codeCopied' : 'copyFailed';
    dependencies.playUiSound(copied ? 'confirm' : 'locked');
    renderProfileScene(scene, state, dependencies);
  })();
}

function closeSavedDeckRename(state: ProfileViewState) {
  state.savedDeckRenameInput?.remove();
  state.savedDeckRenameInput = undefined;
}

function closeSavedDeckImport(state: ProfileViewState) {
  state.savedDeckCodeInput?.remove();
  state.savedDeckCodeInput = undefined;
}

function beginSavedDeckRename(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const selected = selectedSavedDeck(state);
  if (!selected || state.savedDeckRenameInput || state.savedDeckCodeInput) {
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

function beginSavedDeckImport(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
) {
  const decks = sanitizeSavedDecks(loadAccount().decks);
  if (activeSavedDecks(decks).length >= SAVED_DECK_LIMIT) {
    state.savedDeckStatus = 'full';
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  if (state.savedDeckCodeInput || state.savedDeckRenameInput) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = SAVED_DECK_CODE_LIMIT;
  input.placeholder = `Paste a BSF${SAVED_DECK_CODE_VERSION} flight code`;
  input.setAttribute('aria-label', 'Flight share code');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('spellcheck', 'false');
  Object.assign(input.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    width: 'min(640px, calc(100vw - 48px))',
    transform: 'translate(-50%, -50%)',
    zIndex: '10000',
    boxSizing: 'border-box',
    padding: '14px 18px',
    border: '2px solid #8df4ff',
    borderRadius: '4px',
    outline: '4px solid rgba(5, 12, 20, 0.92)',
    background: '#0a1420',
    color: '#ffe1a3',
    font: 'bold 16px monospace',
    textAlign: 'center',
  });
  document.body.append(input);
  state.savedDeckCodeInput = input;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);

  let finished = false;
  const finish = (commit: boolean) => {
    if (finished) return;
    finished = true;
    if (commit) {
      const result = importSavedDeckCode(input.value);
      const account = loadAccount();
      const current = sanitizeSavedDecks(account.decks);
      if (!result.ok) {
        state.savedDeckStatus = 'invalidCode';
        dependencies.playUiSound('locked');
      } else if (activeSavedDecks(current).length >= SAVED_DECK_LIMIT) {
        state.savedDeckStatus = 'full';
        dependencies.playUiSound('locked');
      } else {
        account.decks = [result.deck, ...current];
        if (saveAccount(account)) {
          state.savedDeckArchiveView = false;
          state.savedDeckIndex = 0;
          state.badgePage = 0;
          state.savedDeckStatus = 'imported';
          dependencies.playUiSound('confirm');
        } else {
          state.savedDeckStatus = 'failed';
          dependencies.playUiSound('locked');
        }
      }
    } else {
      dependencies.playUiSound('close');
    }
    closeSavedDeckImport(state);
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
  scene.events.once('shutdown', () => closeSavedDeckImport(state));
  window.setTimeout(() => input.focus(), 0);
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
  state.savedDeckTemplateOpen = false;
  state.savedDeckTemplateIndex = 0;
  if (playtestExportEnabled()) syncLatestPlaytestRun(state, dependencies);
  const returnToMenu = () => {
    if (state.savedDeckTemplateOpen) {
      closeSavedDeckTemplate(scene, state, dependencies);
      return;
    }
    if (state.savedDeckDescriptionInput) {
      closeSavedDeckDescription(state);
      dependencies.playUiSound('close');
      renderProfileScene(scene, state, dependencies);
      return;
    }
    if (state.savedDeckRenameInput) {
      closeSavedDeckRename(state);
      dependencies.playUiSound('close');
      renderProfileScene(scene, state, dependencies);
      return;
    }
    if (state.savedDeckNotesInput) {
      closeSavedDeckNotes(state);
      dependencies.playUiSound('close');
      renderProfileScene(scene, state, dependencies);
      return;
    }
    if (state.savedDeckCollectionSignalsOpen) {
      closeSavedDeckCollectionSignals(scene, state, dependencies);
      return;
    }
    if (state.savedDeckFieldRecordOpen) {
      closeSavedDeckFieldRecord(scene, state, dependencies);
      return;
    }
    if (state.savedDeckHistoryOpen) {
      closeSavedDeckHistory(scene, state, dependencies);
      return;
    }
    if (state.savedDeckWorkshopOpen) {
      closeSavedDeckWorkshop(scene, state, dependencies);
      return;
    }
    if (state.savedDeckLabOpen) {
      closeSavedDeckLab(scene, state, dependencies);
      return;
    }
    if (state.savedDeckIdentityOpen) {
      closeSavedDeckIdentity(scene, state, dependencies);
      return;
    }
    if (state.savedDeckOrganizerOpen) {
      closeSavedDeckOrganizer(scene, state, dependencies);
      return;
    }
    if (state.savedDeckCodeInput) {
      closeSavedDeckImport(state);
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
    previous: () => state.savedDeckTemplateOpen
      ? cycleSavedDeckTemplate(scene, state, dependencies, -1)
      : state.savedDeckIdentityOpen
      ? cycleSavedDeckIdentityChoice(scene, state, dependencies, -1)
      : state.savedDeckOrganizerOpen
      ? cycleSavedDeckOrganizerChoice(scene, state, dependencies, -1)
      : state.savedDeckCollectionSignalsOpen
      ? dependencies.playUiSound('locked')
      : state.savedDeckFieldRecordOpen
      ? dependencies.playUiSound('locked')
      : state.savedDeckHistoryOpen
      ? cycleSavedDeckHistoryTarget(scene, state, dependencies, -1)
      : state.savedDeckWorkshopOpen
      ? cycleSavedDeckWorkshopCard(scene, state, dependencies, -1)
      : state.savedDeckLabOpen
      ? cycleSavedDeckLabSample(scene, state, dependencies, -1)
      : state.flightLogOpen
      ? cycleFlightHistory(scene, state, dependencies, -1)
      : state.badgeView === 'folios' && state.focus === 'folios'
        ? cycleSavedDeck(scene, state, dependencies, -1)
        : cycleProfileFocus(scene, state, dependencies, -1),
    next: () => state.savedDeckTemplateOpen
      ? cycleSavedDeckTemplate(scene, state, dependencies, 1)
      : state.savedDeckIdentityOpen
      ? cycleSavedDeckIdentityChoice(scene, state, dependencies, 1)
      : state.savedDeckOrganizerOpen
      ? cycleSavedDeckOrganizerChoice(scene, state, dependencies, 1)
      : state.savedDeckCollectionSignalsOpen
      ? dependencies.playUiSound('locked')
      : state.savedDeckFieldRecordOpen
      ? dependencies.playUiSound('locked')
      : state.savedDeckHistoryOpen
      ? cycleSavedDeckHistoryTarget(scene, state, dependencies, 1)
      : state.savedDeckWorkshopOpen
      ? cycleSavedDeckWorkshopCard(scene, state, dependencies, 1)
      : state.savedDeckLabOpen
      ? cycleSavedDeckLabSample(scene, state, dependencies, 1)
      : state.flightLogOpen
      ? cycleFlightHistory(scene, state, dependencies, 1)
      : state.badgeView === 'folios' && state.focus === 'folios'
        ? cycleSavedDeck(scene, state, dependencies, 1)
        : cycleProfileFocus(scene, state, dependencies, 1),
    confirm: () => {
      if (state.savedDeckTemplateOpen) {
        createSavedDeckFromTemplate(scene, state, dependencies);
      } else if (state.savedDeckIdentityOpen) {
        applySavedDeckIdentityChoice(scene, state, dependencies);
      } else if (state.savedDeckOrganizerOpen) {
        applySavedDeckOrganizerChoice(scene, state, dependencies);
      } else if (state.savedDeckCollectionSignalsOpen) {
        dependencies.playUiSound('locked');
      } else if (state.savedDeckFieldRecordOpen) {
        beginSavedDeckNotes(scene, state, dependencies);
      } else if (state.savedDeckHistoryOpen) {
        restoreSelectedSavedDeckRevision(scene, state, dependencies);
      } else if (state.savedDeckWorkshopOpen) {
        saveSavedDeckWorkshopRevision(scene, state, dependencies);
      } else if (state.savedDeckLabOpen) {
        cycleSavedDeckLabSample(scene, state, dependencies, 1);
      } else if (!state.flightLogOpen) {
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
    if (state.savedDeckTemplateOpen) cycleSavedDeckTemplate(scene, state, dependencies, event.shiftKey ? -1 : 1);
    else if (state.savedDeckIdentityOpen) switchSavedDeckIdentitySection(scene, state, dependencies);
    else if (state.savedDeckOrganizerOpen) switchSavedDeckOrganizerSection(scene, state, dependencies);
    else if (state.savedDeckCollectionSignalsOpen) dependencies.playUiSound('locked');
    else if (state.savedDeckFieldRecordOpen) dependencies.playUiSound('locked');
    else if (state.savedDeckHistoryOpen) cycleSavedDeckHistoryTarget(scene, state, dependencies, event.shiftKey ? -1 : 1);
    else if (state.savedDeckWorkshopOpen) cycleSavedDeckWorkshopSuggestion(scene, state, dependencies, event.shiftKey ? -1 : 1);
    else if (state.savedDeckLabOpen) cycleSavedDeckLabSample(scene, state, dependencies, event.shiftKey ? -1 : 1);
    else if (state.flightLogOpen) cycleFlightHistory(scene, state, dependencies, event.shiftKey ? -1 : 1);
    else cycleProfileFocus(scene, state, dependencies, event.shiftKey ? -1 : 1);
  };
  const onPageUp = (event: KeyboardEvent) => {
    if (state.saveDataOpen || state.flightReview) return;
    event.preventDefault();
    event.stopPropagation();
    if (state.savedDeckTemplateOpen) cycleSavedDeckTemplate(scene, state, dependencies, -1);
    else if (state.savedDeckIdentityOpen) cycleSavedDeckIdentityChoice(scene, state, dependencies, -1);
    else if (state.savedDeckOrganizerOpen) cycleSavedDeckOrganizerChoice(scene, state, dependencies, -1);
    else if (state.savedDeckCollectionSignalsOpen) dependencies.playUiSound('locked');
    else if (state.savedDeckFieldRecordOpen) dependencies.playUiSound('locked');
    else if (state.savedDeckHistoryOpen) cycleSavedDeckHistoryTarget(scene, state, dependencies, -1);
    else if (state.savedDeckWorkshopOpen) cycleSavedDeckWorkshopCard(scene, state, dependencies, -1);
    else if (state.savedDeckLabOpen) cycleSavedDeckLabSample(scene, state, dependencies, -1);
    else if (state.flightLogOpen) pageFlightHistory(scene, state, dependencies, -1);
    else cycleBadgePage(scene, state, dependencies, -1);
  };
  const onPageDown = (event: KeyboardEvent) => {
    if (state.saveDataOpen || state.flightReview) return;
    event.preventDefault();
    event.stopPropagation();
    if (state.savedDeckTemplateOpen) cycleSavedDeckTemplate(scene, state, dependencies, 1);
    else if (state.savedDeckIdentityOpen) cycleSavedDeckIdentityChoice(scene, state, dependencies, 1);
    else if (state.savedDeckOrganizerOpen) cycleSavedDeckOrganizerChoice(scene, state, dependencies, 1);
    else if (state.savedDeckCollectionSignalsOpen) dependencies.playUiSound('locked');
    else if (state.savedDeckFieldRecordOpen) dependencies.playUiSound('locked');
    else if (state.savedDeckHistoryOpen) cycleSavedDeckHistoryTarget(scene, state, dependencies, 1);
    else if (state.savedDeckWorkshopOpen) cycleSavedDeckWorkshopCard(scene, state, dependencies, 1);
    else if (state.savedDeckLabOpen) cycleSavedDeckLabSample(scene, state, dependencies, 1);
    else if (state.flightLogOpen) pageFlightHistory(scene, state, dependencies, 1);
    else cycleBadgePage(scene, state, dependencies, 1);
  };
  const onGamepadDown = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
    if (state.savedDeckTemplateOpen) {
      if (button.index === 12 || button.index === 14 || button.index === 4) {
        cycleSavedDeckTemplate(scene, state, dependencies, -1);
      } else if (button.index === 13 || button.index === 15 || button.index === 5) {
        cycleSavedDeckTemplate(scene, state, dependencies, 1);
      } else if (button.index === 0) {
        createSavedDeckFromTemplate(scene, state, dependencies);
      } else if (button.index === 1) {
        closeSavedDeckTemplate(scene, state, dependencies);
      }
      return;
    }
    if (state.savedDeckIdentityOpen) {
      if (state.savedDeckDescriptionInput) return;
      if (button.index === 12 || button.index === 14) {
        cycleSavedDeckIdentityChoice(scene, state, dependencies, -1);
      } else if (button.index === 13 || button.index === 15) {
        cycleSavedDeckIdentityChoice(scene, state, dependencies, 1);
      } else if (button.index === 4 || button.index === 5) {
        switchSavedDeckIdentitySection(scene, state, dependencies);
      } else if (button.index === 0) {
        applySavedDeckIdentityChoice(scene, state, dependencies);
      } else if (button.index === 2) {
        beginSavedDeckDescription(scene, state, dependencies);
      } else if (button.index === 1) {
        closeSavedDeckIdentity(scene, state, dependencies);
      }
      return;
    }
    if (state.savedDeckOrganizerOpen) {
      if (state.savedDeckRenameInput) return;
      if (button.index === 12 || button.index === 14) {
        cycleSavedDeckOrganizerChoice(scene, state, dependencies, -1);
      } else if (button.index === 13 || button.index === 15) {
        cycleSavedDeckOrganizerChoice(scene, state, dependencies, 1);
      } else if (button.index === 4 || button.index === 5) {
        switchSavedDeckOrganizerSection(scene, state, dependencies);
      } else if (button.index === 0) {
        applySavedDeckOrganizerChoice(scene, state, dependencies);
      } else if (button.index === 2) {
        openSavedDeckIdentity(scene, state, dependencies);
      } else if (button.index === 3) {
        beginSavedDeckRename(scene, state, dependencies);
      } else if (button.index === 1) {
        closeSavedDeckOrganizer(scene, state, dependencies);
      }
      return;
    }
    if (state.savedDeckCollectionSignalsOpen) {
      if (button.index === 1 || button.index === 11) {
        closeSavedDeckCollectionSignals(scene, state, dependencies);
      }
      return;
    }
    if (state.savedDeckFieldRecordOpen) {
      if (button.index === 0) {
        beginSavedDeckNotes(scene, state, dependencies);
      } else if (button.index === 1) {
        closeSavedDeckFieldRecord(scene, state, dependencies);
      }
      return;
    }
    if (state.savedDeckHistoryOpen) {
      if (button.index === 12 || button.index === 14 || button.index === 4) {
        cycleSavedDeckHistoryTarget(scene, state, dependencies, -1);
      } else if (button.index === 13 || button.index === 15 || button.index === 5) {
        cycleSavedDeckHistoryTarget(scene, state, dependencies, 1);
      } else if (button.index === 0) {
        restoreSelectedSavedDeckRevision(scene, state, dependencies);
      } else if (button.index === 1) {
        closeSavedDeckHistory(scene, state, dependencies);
      }
      return;
    }
    if (state.savedDeckWorkshopOpen) {
      if (button.index === 12) {
        cycleSavedDeckWorkshopSuggestion(scene, state, dependencies, -1);
      } else if (button.index === 13) {
        cycleSavedDeckWorkshopSuggestion(scene, state, dependencies, 1);
      } else if (button.index === 14 || button.index === 4) {
        cycleSavedDeckWorkshopCard(scene, state, dependencies, -1);
      } else if (button.index === 15 || button.index === 5) {
        cycleSavedDeckWorkshopCard(scene, state, dependencies, 1);
      } else if (button.index === 0) {
        saveSavedDeckWorkshopRevision(scene, state, dependencies);
      } else if (button.index === 1) {
        closeSavedDeckWorkshop(scene, state, dependencies);
      }
      return;
    }
    if (state.savedDeckLabOpen) {
      if (button.index === 12 || button.index === 14 || button.index === 4) {
        cycleSavedDeckLabSample(scene, state, dependencies, -1);
      } else if (button.index === 13 || button.index === 15 || button.index === 5 || button.index === 0) {
        cycleSavedDeckLabSample(scene, state, dependencies, 1);
      } else if (button.index === 9) {
        launchSelectedSavedDeck(scene, state, dependencies);
      } else if (button.index === 1) {
        closeSavedDeckLab(scene, state, dependencies);
      } else if (button.index === 2) {
        openSavedDeckWorkshop(scene, state, dependencies);
      } else if (button.index === 3) {
        openSavedDeckHistory(scene, state, dependencies);
      } else if (button.index === 10) {
        openSavedDeckFieldRecord(scene, state, dependencies);
      } else if (button.index === 11) {
        openSavedDeckCollectionSignals(scene, state, dependencies);
      }
      return;
    }
    if (
      state.badgeView === 'folios'
      && state.focus === 'folios'
      && !state.savedDeckRenameInput
      && !state.savedDeckCodeInput
    ) {
      if (button.index === 5) {
        openSavedDeckTemplate(scene, state, dependencies);
        return;
      }
      if (button.index === 0) {
        openSavedDeckOrganizer(scene, state, dependencies);
        return;
      }
      if (button.index === 2) {
        toggleSelectedSavedDeckFavorite(scene, state, dependencies);
        return;
      }
      if (button.index === 3) {
        beginSavedDeckRename(scene, state, dependencies);
        return;
      }
      if (button.index === 6) {
        duplicateSelectedSavedDeck(scene, state, dependencies);
        return;
      }
      if (button.index === 7) {
        copySelectedSavedDeckCode(scene, state, dependencies);
        return;
      }
      if (button.index === 10) {
        beginSavedDeckImport(scene, state, dependencies);
        return;
      }
      if (button.index === 11) {
        openSavedDeckLab(scene, state, dependencies);
        return;
      }
      if (button.index === 8) {
        toggleSavedDeckArchiveView(scene, state, dependencies);
        return;
      }
      if (button.index === 9) {
        toggleSelectedSavedDeckArchived(scene, state, dependencies);
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
  const onSavedDeckTemplate = (event: KeyboardEvent) => {
    if (
      state.savedDeckTemplateOpen
      || state.badgeView !== 'folios'
      || state.focus !== 'folios'
      || state.savedDeckRenameInput
      || state.savedDeckCodeInput
      || state.savedDeckOrganizerOpen
      || state.savedDeckIdentityOpen
      || state.savedDeckCollectionSignalsOpen
      || state.savedDeckLabOpen
      || state.savedDeckFieldRecordOpen
      || state.savedDeckHistoryOpen
      || state.savedDeckWorkshopOpen
    ) return;
    event.preventDefault();
    event.stopPropagation();
    openSavedDeckTemplate(scene, state, dependencies);
  };
  const onSavedDeckFavorite = (event: KeyboardEvent) => {
    if (state.savedDeckTemplateOpen) return;
    if (
      state.badgeView !== 'folios'
      || state.focus !== 'folios'
      || state.savedDeckRenameInput
      || state.savedDeckCodeInput
      || state.savedDeckOrganizerOpen
      || state.savedDeckIdentityOpen
      || state.savedDeckCollectionSignalsOpen
      || state.savedDeckLabOpen
      || state.savedDeckFieldRecordOpen
      || state.savedDeckHistoryOpen
      || state.savedDeckWorkshopOpen
    ) return;
    event.preventDefault();
    event.stopPropagation();
    toggleSelectedSavedDeckFavorite(scene, state, dependencies);
  };
  const onSavedDeckRename = (event: KeyboardEvent) => {
    if (state.savedDeckTemplateOpen) return;
    if (
      state.badgeView !== 'folios'
      || state.focus !== 'folios'
      || state.savedDeckRenameInput
      || state.savedDeckCodeInput
      || state.savedDeckIdentityOpen
      || state.savedDeckCollectionSignalsOpen
      || state.savedDeckLabOpen
      || state.savedDeckFieldRecordOpen
      || state.savedDeckHistoryOpen
      || state.savedDeckWorkshopOpen
    ) return;
    event.preventDefault();
    event.stopPropagation();
    beginSavedDeckRename(scene, state, dependencies);
  };
  const onSavedDeckDuplicate = (event: KeyboardEvent) => {
    if (state.savedDeckTemplateOpen) return;
    if (
      state.badgeView !== 'folios'
      || state.focus !== 'folios'
      || state.savedDeckRenameInput
      || state.savedDeckCodeInput
      || state.savedDeckOrganizerOpen
      || state.savedDeckIdentityOpen
      || state.savedDeckCollectionSignalsOpen
      || state.savedDeckLabOpen
      || state.savedDeckFieldRecordOpen
      || state.savedDeckHistoryOpen
      || state.savedDeckWorkshopOpen
    ) return;
    event.preventDefault();
    event.stopPropagation();
    duplicateSelectedSavedDeck(scene, state, dependencies);
  };
  const onSavedDeckCopy = (event: KeyboardEvent) => {
    if (state.savedDeckTemplateOpen) return;
    if (
      state.badgeView !== 'folios'
      || state.focus !== 'folios'
      || state.savedDeckRenameInput
      || state.savedDeckCodeInput
      || state.savedDeckOrganizerOpen
      || state.savedDeckIdentityOpen
      || state.savedDeckCollectionSignalsOpen
      || state.savedDeckLabOpen
      || state.savedDeckFieldRecordOpen
      || state.savedDeckHistoryOpen
      || state.savedDeckWorkshopOpen
    ) return;
    event.preventDefault();
    event.stopPropagation();
    copySelectedSavedDeckCode(scene, state, dependencies);
  };
  const onSavedDeckImport = (event: KeyboardEvent) => {
    if (state.savedDeckTemplateOpen) return;
    if (
      state.badgeView !== 'folios'
      || state.focus !== 'folios'
      || state.savedDeckRenameInput
      || state.savedDeckCodeInput
      || state.savedDeckOrganizerOpen
      || state.savedDeckIdentityOpen
      || state.savedDeckCollectionSignalsOpen
      || state.savedDeckLabOpen
      || state.savedDeckFieldRecordOpen
      || state.savedDeckHistoryOpen
      || state.savedDeckWorkshopOpen
    ) return;
    event.preventDefault();
    event.stopPropagation();
    beginSavedDeckImport(scene, state, dependencies);
  };
  const onSavedDeckLab = (event: KeyboardEvent) => {
    if (state.savedDeckTemplateOpen) return;
    if (
      state.badgeView !== 'folios'
      || state.focus !== 'folios'
      || state.savedDeckRenameInput
      || state.savedDeckCodeInput
      || state.savedDeckOrganizerOpen
      || state.savedDeckIdentityOpen
      || state.savedDeckCollectionSignalsOpen
      || state.savedDeckLabOpen
      || state.savedDeckFieldRecordOpen
      || state.savedDeckHistoryOpen
      || state.savedDeckWorkshopOpen
    ) return;
    event.preventDefault();
    event.stopPropagation();
    openSavedDeckLab(scene, state, dependencies);
  };
  const onSavedDeckOrganizer = (event: KeyboardEvent) => {
    if (state.savedDeckTemplateOpen) return;
    if (
      state.badgeView !== 'folios'
      || state.focus !== 'folios'
      || state.savedDeckRenameInput
      || state.savedDeckCodeInput
      || state.savedDeckOrganizerOpen
      || state.savedDeckCollectionSignalsOpen
      || state.savedDeckLabOpen
      || state.savedDeckFieldRecordOpen
      || state.savedDeckHistoryOpen
      || state.savedDeckWorkshopOpen
    ) return;
    event.preventDefault();
    event.stopPropagation();
    openSavedDeckOrganizer(scene, state, dependencies);
  };
  const onSavedDeckIdentity = (event: KeyboardEvent) => {
    if (
      !state.savedDeckOrganizerOpen
      || state.savedDeckRenameInput
      || state.savedDeckDescriptionInput
    ) return;
    event.preventDefault();
    event.stopPropagation();
    openSavedDeckIdentity(scene, state, dependencies);
  };
  const onSavedDeckDescription = (event: KeyboardEvent) => {
    if (!state.savedDeckIdentityOpen || state.savedDeckDescriptionInput) return;
    event.preventDefault();
    event.stopPropagation();
    beginSavedDeckDescription(scene, state, dependencies);
  };
  const onSavedDeckArchiveView = (event: KeyboardEvent) => {
    if (state.savedDeckTemplateOpen) return;
    if (
      state.badgeView !== 'folios'
      || state.focus !== 'folios'
      || state.savedDeckRenameInput
      || state.savedDeckCodeInput
      || state.savedDeckOrganizerOpen
      || state.savedDeckIdentityOpen
      || state.savedDeckCollectionSignalsOpen
      || state.savedDeckLabOpen
      || state.savedDeckFieldRecordOpen
      || state.savedDeckHistoryOpen
      || state.savedDeckWorkshopOpen
    ) return;
    event.preventDefault();
    event.stopPropagation();
    toggleSavedDeckArchiveView(scene, state, dependencies);
  };
  const onSavedDeckArchive = (event: KeyboardEvent) => {
    if (state.savedDeckTemplateOpen) return;
    if (
      state.badgeView !== 'folios'
      || state.focus !== 'folios'
      || state.savedDeckRenameInput
      || state.savedDeckCodeInput
      || state.savedDeckOrganizerOpen
      || state.savedDeckIdentityOpen
      || state.savedDeckCollectionSignalsOpen
      || state.savedDeckLabOpen
      || state.savedDeckFieldRecordOpen
      || state.savedDeckHistoryOpen
      || state.savedDeckWorkshopOpen
    ) return;
    event.preventDefault();
    event.stopPropagation();
    toggleSelectedSavedDeckArchived(scene, state, dependencies);
  };
  const onSavedDeckLabDeal = (event: KeyboardEvent) => {
    if (!state.savedDeckLabOpen) return;
    event.preventDefault();
    event.stopPropagation();
    cycleSavedDeckLabSample(scene, state, dependencies, 1);
  };
  const onSavedDeckLaunch = (event: KeyboardEvent) => {
    if (!state.savedDeckLabOpen) return;
    event.preventDefault();
    event.stopPropagation();
    launchSelectedSavedDeck(scene, state, dependencies);
  };
  const onSavedDeckCollectionSignals = (event: KeyboardEvent) => {
    if (!state.savedDeckLabOpen && !state.savedDeckCollectionSignalsOpen) return;
    event.preventDefault();
    event.stopPropagation();
    if (state.savedDeckCollectionSignalsOpen) {
      closeSavedDeckCollectionSignals(scene, state, dependencies);
    } else {
      openSavedDeckCollectionSignals(scene, state, dependencies);
    }
  };
  const onSavedDeckWorkshop = (event: KeyboardEvent) => {
    if (!state.savedDeckLabOpen || state.savedDeckWorkshopOpen) return;
    event.preventDefault();
    event.stopPropagation();
    openSavedDeckWorkshop(scene, state, dependencies);
  };
  const onSavedDeckHistory = (event: KeyboardEvent) => {
    if (!state.savedDeckLabOpen || state.savedDeckHistoryOpen) return;
    event.preventDefault();
    event.stopPropagation();
    openSavedDeckHistory(scene, state, dependencies);
  };
  const onSavedDeckFieldRecord = (event: KeyboardEvent) => {
    if (!state.savedDeckLabOpen || state.savedDeckFieldRecordOpen) return;
    event.preventDefault();
    event.stopPropagation();
    openSavedDeckFieldRecord(scene, state, dependencies);
  };
  const onSavedDeckNotes = (event: KeyboardEvent) => {
    if (!state.savedDeckFieldRecordOpen || state.savedDeckNotesInput) return;
    event.preventDefault();
    event.stopPropagation();
    beginSavedDeckNotes(scene, state, dependencies);
  };
  const onSavedDeckWorkshopSuggestionUp = (event: KeyboardEvent) => {
    if (
      !state.savedDeckIdentityOpen
      && !state.savedDeckOrganizerOpen
      && !state.savedDeckWorkshopOpen
      && !state.savedDeckHistoryOpen
    ) return;
    event.preventDefault();
    event.stopPropagation();
    if (state.savedDeckIdentityOpen) cycleSavedDeckIdentityChoice(scene, state, dependencies, -1);
    else if (state.savedDeckOrganizerOpen) cycleSavedDeckOrganizerChoice(scene, state, dependencies, -1);
    else if (state.savedDeckHistoryOpen) cycleSavedDeckHistoryTarget(scene, state, dependencies, -1);
    else cycleSavedDeckWorkshopSuggestion(scene, state, dependencies, -1);
  };
  const onSavedDeckWorkshopSuggestionDown = (event: KeyboardEvent) => {
    if (
      !state.savedDeckIdentityOpen
      && !state.savedDeckOrganizerOpen
      && !state.savedDeckWorkshopOpen
      && !state.savedDeckHistoryOpen
    ) return;
    event.preventDefault();
    event.stopPropagation();
    if (state.savedDeckIdentityOpen) cycleSavedDeckIdentityChoice(scene, state, dependencies, 1);
    else if (state.savedDeckOrganizerOpen) cycleSavedDeckOrganizerChoice(scene, state, dependencies, 1);
    else if (state.savedDeckHistoryOpen) cycleSavedDeckHistoryTarget(scene, state, dependencies, 1);
    else cycleSavedDeckWorkshopSuggestion(scene, state, dependencies, 1);
  };
  scene.input.keyboard?.on('keydown-TAB', onTab);
  scene.input.keyboard?.on('keydown-PAGE_UP', onPageUp);
  scene.input.keyboard?.on('keydown-PAGE_DOWN', onPageDown);
  scene.input.keyboard?.on('keydown-K', onSavedDeckTemplate);
  scene.input.keyboard?.on('keydown-C', onSavedDeckFavorite);
  scene.input.keyboard?.on('keydown-R', onSavedDeckRename);
  scene.input.keyboard?.on('keydown-D', onSavedDeckDuplicate);
  scene.input.keyboard?.on('keydown-E', onSavedDeckCopy);
  scene.input.keyboard?.on('keydown-I', onSavedDeckImport);
  scene.input.keyboard?.on('keydown-L', onSavedDeckLab);
  scene.input.keyboard?.on('keydown-O', onSavedDeckOrganizer);
  scene.input.keyboard?.on('keydown-P', onSavedDeckIdentity);
  scene.input.keyboard?.on('keydown-V', onSavedDeckArchiveView);
  scene.input.keyboard?.on('keydown-A', onSavedDeckArchive);
  scene.input.keyboard?.on('keydown-SPACE', onSavedDeckLabDeal);
  scene.input.keyboard?.on('keydown-S', onSavedDeckLaunch);
  scene.input.keyboard?.on('keydown-G', onSavedDeckCollectionSignals);
  scene.input.keyboard?.on('keydown-T', onSavedDeckWorkshop);
  scene.input.keyboard?.on('keydown-R', onSavedDeckHistory);
  scene.input.keyboard?.on('keydown-N', onSavedDeckFieldRecord);
  scene.input.keyboard?.on('keydown-E', onSavedDeckNotes);
  scene.input.keyboard?.on('keydown-E', onSavedDeckDescription);
  scene.input.keyboard?.on('keydown-UP', onSavedDeckWorkshopSuggestionUp);
  scene.input.keyboard?.on('keydown-DOWN', onSavedDeckWorkshopSuggestionDown);
  scene.input.gamepad?.on('down', onGamepadDown);
  scene.events.once('shutdown', () => {
    closeSavedDeckRename(state);
    closeSavedDeckImport(state);
    closeSavedDeckNotes(state);
    closeSavedDeckDescription(state);
    scene.input.keyboard?.off('keydown-TAB', onTab);
    scene.input.keyboard?.off('keydown-PAGE_UP', onPageUp);
    scene.input.keyboard?.off('keydown-PAGE_DOWN', onPageDown);
    scene.input.keyboard?.off('keydown-K', onSavedDeckTemplate);
    scene.input.keyboard?.off('keydown-C', onSavedDeckFavorite);
    scene.input.keyboard?.off('keydown-R', onSavedDeckRename);
    scene.input.keyboard?.off('keydown-D', onSavedDeckDuplicate);
    scene.input.keyboard?.off('keydown-E', onSavedDeckCopy);
    scene.input.keyboard?.off('keydown-I', onSavedDeckImport);
    scene.input.keyboard?.off('keydown-L', onSavedDeckLab);
    scene.input.keyboard?.off('keydown-O', onSavedDeckOrganizer);
    scene.input.keyboard?.off('keydown-P', onSavedDeckIdentity);
    scene.input.keyboard?.off('keydown-V', onSavedDeckArchiveView);
    scene.input.keyboard?.off('keydown-A', onSavedDeckArchive);
    scene.input.keyboard?.off('keydown-SPACE', onSavedDeckLabDeal);
    scene.input.keyboard?.off('keydown-S', onSavedDeckLaunch);
    scene.input.keyboard?.off('keydown-G', onSavedDeckCollectionSignals);
    scene.input.keyboard?.off('keydown-T', onSavedDeckWorkshop);
    scene.input.keyboard?.off('keydown-R', onSavedDeckHistory);
    scene.input.keyboard?.off('keydown-N', onSavedDeckFieldRecord);
    scene.input.keyboard?.off('keydown-E', onSavedDeckNotes);
    scene.input.keyboard?.off('keydown-E', onSavedDeckDescription);
    scene.input.keyboard?.off('keydown-UP', onSavedDeckWorkshopSuggestionUp);
    scene.input.keyboard?.off('keydown-DOWN', onSavedDeckWorkshopSuggestionDown);
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
  const allSavedDecks = sanitizeSavedDecks(account.decks);
  const activeDecks = activeSavedDecks(allSavedDecks);
  const archivedDecks = archivedSavedDecks(allSavedDecks);
  const savedDecks = state.savedDeckArchiveView ? archivedDecks : activeDecks;
  const savedDeckTemplates = state.savedDeckTemplateOpen
    ? savedDeckTemplateOptions(account)
    : undefined;
  if (savedDeckTemplates) {
    state.savedDeckTemplateIndex = Phaser.Math.Clamp(
      state.savedDeckTemplateIndex ?? 0,
      0,
      Math.max(0, savedDeckTemplates.length - 1),
    );
  }
  state.savedDeckIndex = Phaser.Math.Clamp(state.savedDeckIndex, 0, Math.max(0, savedDecks.length - 1));
  if (state.savedDeckLabOpen && savedDecks.length === 0) state.savedDeckLabOpen = false;
  const savedDeckLab = state.savedDeckLabOpen && savedDecks[state.savedDeckIndex]
    ? analyzeSavedDeck(savedDecks[state.savedDeckIndex], alphaCardLibrary, state.savedDeckLabSample)
    : undefined;
  const savedDeckLaunch = savedDeckLab
    ? savedDeckLaunchState(savedDecks[state.savedDeckIndex], savedDeckLab, account, dependencies)
    : undefined;
  let savedDeckCollectionSignals = state.savedDeckCollectionSignalsOpen
    ? savedDeckCollectionSignalsState(state, account)
    : undefined;
  if (state.savedDeckCollectionSignalsOpen && !savedDeckCollectionSignals) {
    state.savedDeckCollectionSignalsOpen = false;
    state.savedDeckCollectionSignalsDeckId = undefined;
    savedDeckCollectionSignals = undefined;
  }
  let savedDeckHistory = state.savedDeckHistoryOpen
    ? savedDeckHistoryState(state, account)
    : undefined;
  if (state.savedDeckHistoryOpen && !savedDeckHistory) {
    state.savedDeckHistoryOpen = false;
    state.savedDeckHistoryDeckId = undefined;
    savedDeckHistory = undefined;
  }
  if (savedDeckHistory) state.savedDeckHistoryTargetIndex = savedDeckHistory.targetIndex;
  let savedDeckWorkshop = state.savedDeckWorkshopOpen
    ? savedDeckWorkshopState(state, account)
    : undefined;
  if (state.savedDeckWorkshopOpen && !savedDeckWorkshop) {
    state.savedDeckWorkshopOpen = false;
    state.savedDeckWorkshopDeckId = undefined;
    savedDeckWorkshop = undefined;
  }
  if (savedDeckWorkshop) {
    state.savedDeckWorkshopCardIndex = savedDeckWorkshop.cardIndex;
    state.savedDeckWorkshopSuggestionIndex = Phaser.Math.Clamp(
      state.savedDeckWorkshopSuggestionIndex,
      0,
      Math.max(0, savedDeckWorkshop.suggestions.length - 1),
    );
  }
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
  let savedDeckOrganizer = state.savedDeckOrganizerOpen
    ? savedDeckOrganizerDeck(state, account)
    : undefined;
  if (state.savedDeckOrganizerOpen && !savedDeckOrganizer) {
    state.savedDeckOrganizerOpen = false;
    state.savedDeckOrganizerDeckId = undefined;
    savedDeckOrganizer = undefined;
  }
  let savedDeckIdentity = state.savedDeckIdentityOpen
    ? savedDeckIdentityDeck(state, account)
    : undefined;
  if (state.savedDeckIdentityOpen && !savedDeckIdentity) {
    closeSavedDeckDescription(state);
    state.savedDeckIdentityOpen = false;
    state.savedDeckIdentityDeckId = undefined;
    savedDeckIdentity = undefined;
  }
  if (savedDeckIdentity) {
    state.savedDeckIdentityIndex = Phaser.Math.Clamp(
      state.savedDeckIdentityIndex,
      0,
      Math.max(0, identityChoiceCount(state, savedDeckIdentity) - 1),
    );
  }
  const playtestMode = playtestExportEnabled();
  const playtestRuns = playtestRunPayload(dependencies.exportRunHistory()) ?? [];
  const flightHistory = dependencies.flightHistory();
  let savedDeckFieldRecord = state.savedDeckFieldRecordOpen
    ? savedDeckFieldRecordState(state, flightHistory, account)
    : undefined;
  if (state.savedDeckFieldRecordOpen && !savedDeckFieldRecord) {
    closeSavedDeckNotes(state);
    state.savedDeckFieldRecordOpen = false;
    state.savedDeckFieldRecordDeckId = undefined;
    savedDeckFieldRecord = undefined;
  }
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
      count: activeDecks.length,
      capacity: SAVED_DECK_LIMIT,
      archivedCount: archivedDecks.length,
      archiveCapacity: SAVED_DECK_ARCHIVE_LIMIT,
      view: state.savedDeckArchiveView ? 'archive' : 'active',
      viewCount: savedDecks.length,
      items: savedDecks.map((deck) => ({
        id: deck.id,
        name: deck.name,
        leaderId: deck.leaderId,
        leader: flockLeaders.find((leader) => leader.id === deck.leaderId)?.name ?? deck.leaderId,
        cardCount: deck.cards.length,
        upgradedCount: deck.cards.filter((card) => card.upgraded).length,
        cards: deck.cards.map((card) => ({ ...card })),
        lineageId: deck.lineageId,
        revision: deck.revision,
        parentId: deck.parentId ?? null,
        favorite: deck.favorite,
        archived: deck.archived,
        sourceSeed: deck.sourceSeed,
        runMode: deck.runMode,
        description: deck.description ?? '',
        coverCardId: deck.coverCardId ?? deck.cards[0]?.id ?? null,
        coverCardName: alphaCardSet.cards.find(
          (card) => card.id === (deck.coverCardId ?? deck.cards[0]?.id),
        )?.displayName ?? deck.coverCardId ?? deck.cards[0]?.id ?? null,
        sleeve: deck.sleeve ?? 'field',
        sleeveLabel: SAVED_DECK_SLEEVES.find((sleeve) => sleeve.id === (deck.sleeve ?? 'field'))?.label
          ?? 'Field Canvas',
        folder: deck.folder ?? 'unfiled',
        folderLabel: SAVED_DECK_FOLDERS.find((folder) => folder.id === (deck.folder ?? 'unfiled'))?.label
          ?? 'Open Shelf',
        tags: (deck.tags ?? []).map((id) => ({
          id,
          label: SAVED_DECK_TAGS.find((tag) => tag.id === id)?.label ?? id,
        })),
        createdAt: deck.createdAt,
        updatedAt: deck.updatedAt,
      })),
      empty: savedDecks.length === 0,
      full: activeDecks.length >= SAVED_DECK_LIMIT,
      selected: savedDecks[state.savedDeckIndex]?.id ?? null,
      selectedIndex: savedDecks.length > 0 ? state.savedDeckIndex : null,
      viewActive: state.badgeView === 'folios',
      page: state.badgePage + 1,
      pageCount: badgePageCount,
      status: state.savedDeckStatus,
      renaming: Boolean(state.savedDeckRenameInput),
      importing: Boolean(state.savedDeckCodeInput),
      organizing: state.savedDeckOrganizerOpen,
      personalizing: state.savedDeckIdentityOpen,
      descriptionEditing: Boolean(state.savedDeckDescriptionInput),
      persisted: true,
      affectsPower: false,
      refusesReplacementAtCapacity: true,
      canDuplicate: !state.savedDeckArchiveView && savedDecks.length > 0 && activeDecks.length < SAVED_DECK_LIMIT,
      canImport: activeDecks.length < SAVED_DECK_LIMIT,
      canArchive: !state.savedDeckArchiveView && savedDecks.length > 0 && archivedDecks.length < SAVED_DECK_ARCHIVE_LIMIT,
      canRestore: state.savedDeckArchiveView && savedDecks.length > 0 && activeDecks.length < SAVED_DECK_LIMIT,
      archiveRefusesDeletion: true,
      template: savedDeckTemplates ? {
        open: true,
        selectedIndex: state.savedDeckTemplateIndex ?? 0,
        selectedLeaderId: savedDeckTemplates[state.savedDeckTemplateIndex ?? 0]?.leader.id ?? null,
        activeCount: activeDecks.length,
        capacity: SAVED_DECK_LIMIT,
        items: savedDeckTemplates.map((option) => ({
          leaderId: option.leader.id,
          leader: option.leader.name,
          bird: option.leader.bird,
          suit: option.leader.suit,
          cardCount: option.leader.startingDeckIds.length,
          ownedCount: option.owned,
          missingCount: option.missing,
          missingIds: option.missingIds,
          missingNames: option.missingNames,
          unlocked: option.unlocked,
          available: option.available,
          reason: option.reason,
        })),
        status: state.savedDeckStatus,
        createsNewRecord: true,
        grantsOwnership: false,
        changesCollectionHistory: false,
        usesBaseCards: true,
        runMode: 'full',
        source: 'owned leader starter',
        inputs: {
          choose: `${controlBindingLabel('previous')} / ${controlBindingLabel('next')} / D-pad / pointer`,
          build: `${controlBindingLabel('confirm')} / controller A / pointer`,
          close: `${controlBindingLabel('back')} / controller B / pointer`,
        },
      } : {
        open: false,
        input: 'K / controller RB / pointer',
        grantsOwnership: false,
      },
      shareCode: {
        version: SAVED_DECK_CODE_VERSION,
        prefix: `BSF${SAVED_DECK_CODE_VERSION}`,
        checksumValidated: true,
        excludesAccountData: true,
        excludesCustomName: true,
        excludesFlightSeed: true,
        excludesPrivateNotes: true,
        excludesOrganization: true,
        excludesIdentity: true,
        preservesCardOrder: true,
        preservesDuplicates: true,
        preservesPreenedState: true,
      },
      organizer: savedDeckOrganizer ? {
        open: true,
        deckId: savedDeckOrganizer.id,
        deckName: savedDeckOrganizer.name,
        folder: savedDeckOrganizer.folder ?? 'unfiled',
        folderLabel: SAVED_DECK_FOLDERS.find(
          (folder) => folder.id === (savedDeckOrganizer?.folder ?? 'unfiled'),
        )?.label ?? 'Open Shelf',
        tags: savedDeckOrganizer.tags ?? [],
        tagLabels: (savedDeckOrganizer.tags ?? []).map(
          (id) => SAVED_DECK_TAGS.find((tag) => tag.id === id)?.label ?? id,
        ),
        tagLimit: SAVED_DECK_TAG_LIMIT,
        section: state.savedDeckOrganizerSection,
        selectedIndex: state.savedDeckOrganizerIndex,
        selectedFolder: state.savedDeckOrganizerSection === 'folder'
          ? SAVED_DECK_FOLDERS[state.savedDeckOrganizerIndex] ?? null
          : null,
        selectedTag: state.savedDeckOrganizerSection === 'tags'
          ? SAVED_DECK_TAGS[state.savedDeckOrganizerIndex] ?? null
          : null,
        folders: SAVED_DECK_FOLDERS.map((folder) => ({
          ...folder,
          selected: folder.id === (savedDeckOrganizer?.folder ?? 'unfiled'),
        })),
        availableTags: SAVED_DECK_TAGS.map((tag) => ({
          ...tag,
          selected: savedDeckOrganizer?.tags?.includes(tag.id) ?? false,
        })),
        private: true,
        includedInBackups: true,
        excludedFromShareCodes: true,
        affectsPower: false,
        status: state.savedDeckStatus,
        inputs: {
          section: 'Tab / controller LB or RB / pointer',
          choice: `${controlBindingLabel('previous')} / ${controlBindingLabel('next')} / Up / Down / D-pad / pointer`,
          apply: `${controlBindingLabel('confirm')} / controller A / pointer`,
          rename: 'R / controller Y / pointer',
          identity: 'P / controller X / pointer',
          close: `${controlBindingLabel('back')} / controller B / pointer`,
        },
      } : {
        open: false,
        input: 'O / controller A / pointer',
        affectsPower: false,
      },
      identity: savedDeckIdentity ? {
        open: true,
        deckId: savedDeckIdentity.id,
        deckName: savedDeckIdentity.name,
        description: savedDeckIdentity.description ?? '',
        descriptionLimit: SAVED_DECK_DESCRIPTION_LIMIT,
        descriptionEditing: Boolean(state.savedDeckDescriptionInput),
        section: state.savedDeckIdentitySection,
        selectedIndex: state.savedDeckIdentityIndex,
        coverCardId: savedDeckIdentity.coverCardId ?? savedDeckIdentity.cards[0]?.id ?? null,
        coverCard: (() => {
          const choices = savedDeckCoverChoices(savedDeckIdentity);
          const id = state.savedDeckIdentitySection === 'cover'
            ? choices[state.savedDeckIdentityIndex] ?? choices[0]
            : savedDeckIdentity.coverCardId ?? choices[0];
          const card = alphaCardSet.cards.find((candidate) => candidate.id === id);
          return id ? {
            id,
            name: card?.displayName ?? id,
            selected: id === (savedDeckIdentity.coverCardId ?? choices[0]),
            available: alphaCardLibrary.has(id),
          } : null;
        })(),
        coverCards: savedDeckCoverChoices(savedDeckIdentity).map((id) => ({
          id,
          name: alphaCardSet.cards.find((card) => card.id === id)?.displayName ?? id,
          selected: id === (savedDeckIdentity.coverCardId ?? savedDeckIdentity.cards[0]?.id),
          available: alphaCardLibrary.has(id),
        })),
        sleeve: savedDeckIdentity.sleeve ?? 'field',
        sleeveLabel: SAVED_DECK_SLEEVES.find(
          (sleeve) => sleeve.id === (savedDeckIdentity.sleeve ?? 'field'),
        )?.label ?? 'Field Canvas',
        selectedSleeve: state.savedDeckIdentitySection === 'sleeve'
          ? SAVED_DECK_SLEEVES[state.savedDeckIdentityIndex] ?? null
          : null,
        sleeves: SAVED_DECK_SLEEVES.map((sleeve) => ({
          id: sleeve.id,
          label: sleeve.label,
          description: sleeve.description,
          selected: sleeve.id === (savedDeckIdentity?.sleeve ?? 'field'),
        })),
        private: true,
        includedInBackups: true,
        excludedFromShareCodes: true,
        affectsPower: false,
        status: state.savedDeckStatus,
        inputs: {
          section: 'Tab / controller LB or RB',
          choice: `${controlBindingLabel('previous')} / ${controlBindingLabel('next')} / Up / Down / D-pad / pointer`,
          apply: `${controlBindingLabel('confirm')} / controller A / pointer`,
          description: 'E / controller X / pointer',
          close: `${controlBindingLabel('back')} / controller B / pointer`,
        },
      } : {
        open: false,
        input: 'Folio Organizer: P / controller X / pointer',
        affectsPower: false,
      },
      flightLab: savedDeckLab ? {
        open: true,
        deckId: savedDecks[state.savedDeckIndex].id,
        deckName: savedDecks[state.savedDeckIndex].name,
        savedCopies: savedDeckLab.savedCopies,
        playableCards: savedDeckLab.playableCards,
        duplicateCopies: savedDeckLab.duplicateCopies,
        unavailableCopies: savedDeckLab.unavailableCopies,
        preenedCards: savedDeckLab.preenedCards,
        legalForStandardFlight: savedDeckLab.legalForStandardFlight,
        issues: savedDeckLab.issues,
        averageCost: savedDeckLab.averageCost,
        costCurve: savedDeckLab.costCurve,
        roles: savedDeckLab.roles,
        families: savedDeckLab.families,
        resourceHooks: savedDeckLab.resourceHooks,
        consistency: savedDeckLab.consistency,
        sample: {
          ...savedDeckLab.sample,
          cards: savedDeckLab.sample.cards.map((card) => ({
            id: card.id,
            name: card.name,
            cost: card.cost,
            upgraded: card.upgraded,
            family: card.family,
            role: card.role,
            playable: card.playable,
            pressure: card.pressure,
          })),
        },
        rules: savedDeckLab.rules,
        launch: savedDeckLaunch,
        inputs: {
          previous: `${controlBindingLabel('previous')} / D-pad Left / LB`,
          dealAgain: `${controlBindingLabel('next')} / ${controlBindingLabel('confirm')} / Space / A`,
          collectionSignals: 'G / controller R3 / pointer',
          fieldRecord: 'N / controller L3 / pointer',
          revisionTrail: 'R / controller Y / pointer',
          tune: 'T / controller X / pointer',
          launch: 'S / controller Start / pointer',
          close: `${controlBindingLabel('back')} / controller B / pointer`,
        },
      } : {
        open: false,
        available: savedDecks.length > 0,
        input: 'L / controller R3 / pointer',
        affectsPower: false,
        spendsResources: false,
      },
      collectionSignals: savedDeckCollectionSignals ? {
        open: true,
        deckId: savedDeckCollectionSignals.deckId,
        deckName: savedDeckCollectionSignals.deckName,
        ownedCount: savedDeckCollectionSignals.ownedCount,
        folioCount: savedDeckCollectionSignals.folioCount,
        activeFolioCount: savedDeckCollectionSignals.activeFolioCount,
        archivedFolioCount: savedDeckCollectionSignals.archivedFolioCount,
        unusedCount: savedDeckCollectionSignals.unusedCount,
        unused: savedDeckCollectionSignals.unused,
        frequentlyFiled: savedDeckCollectionSignals.frequentlyFiled,
        recentlyAcquired: savedDeckCollectionSignals.recentlyAcquired,
        commonlyPaired: savedDeckCollectionSignals.commonlyPaired,
        rules: savedDeckCollectionSignals.rules,
        inputs: {
          close: `${controlBindingLabel('back')} / G / controller B or R3 / pointer`,
        },
      } : {
        open: false,
        input: 'Flight Lab: G / controller R3 / pointer',
        affectsPower: false,
      },
      fieldRecord: savedDeckFieldRecord ? {
        open: true,
        deckId: savedDeckFieldRecord.deck.id,
        deckName: savedDeckFieldRecord.deck.name,
        revision: savedDeckFieldRecord.deck.revision,
        archived: savedDeckFieldRecord.deck.archived,
        notes: savedDeckFieldRecord.deck.notes ?? '',
        notesLength: savedDeckFieldRecord.deck.notes?.length ?? 0,
        notesEditing: Boolean(state.savedDeckNotesInput),
        notesPrivate: true,
        notesExcludedFromShareCodes: true,
        flights: savedDeckFieldRecord.record.flights,
        wins: savedDeckFieldRecord.record.wins,
        losses: savedDeckFieldRecord.record.losses,
        winRate: savedDeckFieldRecord.record.winRate,
        averageTurns: savedDeckFieldRecord.record.averageTurns,
        fastestWinTurns: savedDeckFieldRecord.record.fastestWinTurns,
        bestCohesionPercent: savedDeckFieldRecord.record.bestCohesionPercent,
        recent: savedDeckFieldRecord.record.recent.map((flight) => ({
          id: flight.id,
          seed: flight.seed,
          result: flight.result,
          difficulty: flight.difficulty,
          completedAtMs: flight.completedAtMs,
          durationMs: flight.durationMs,
          currentCohesion: flight.currentCohesion,
          maxCohesion: flight.maxCohesion,
          turns: flight.turns,
        })),
        exactMatchRules: savedDeckFieldRecord.record.exactMatchRules,
        affectsPower: false,
        status: state.savedDeckStatus,
        inputs: {
          editNotes: `${controlBindingLabel('confirm')} / E / controller A / pointer`,
          close: `${controlBindingLabel('back')} / controller B / pointer`,
        },
      } : {
        open: false,
        input: 'Flight Lab: N / controller L3 / pointer',
        affectsPower: false,
      },
      revisionTrail: savedDeckHistory ? {
        open: true,
        source: {
          id: savedDeckHistory.source.id,
          name: savedDeckHistory.source.name,
          revision: savedDeckHistory.source.revision,
          parentId: savedDeckHistory.source.parentId ?? null,
          archived: savedDeckHistory.source.archived,
          leaderId: savedDeckHistory.source.leaderId,
          leader: flockLeaders.find((leader) => leader.id === savedDeckHistory.source.leaderId)?.name
            ?? savedDeckHistory.source.leaderId,
          runMode: savedDeckHistory.source.runMode,
          cardCount: savedDeckHistory.source.cards.length,
        },
        targetCount: savedDeckHistory.targets.length,
        targetIndex: savedDeckHistory.targets.length > 0 ? savedDeckHistory.targetIndex : null,
        targets: savedDeckHistory.targets.map((target) => ({
          id: target.id,
          name: target.name,
          revision: target.revision,
          parentId: target.parentId ?? null,
          archived: target.archived,
          isDirectParent: target.id === savedDeckHistory.source.parentId,
          leaderId: target.leaderId,
          runMode: target.runMode,
          cardCount: target.cards.length,
          changedCards: compareSavedDeckRevisions(savedDeckHistory.source, target).cardChanges.length,
          exactMatch: compareSavedDeckRevisions(savedDeckHistory.source, target).exactMatch,
        })),
        selectedTarget: savedDeckHistory.target ? {
          id: savedDeckHistory.target.id,
          name: savedDeckHistory.target.name,
          revision: savedDeckHistory.target.revision,
          parentId: savedDeckHistory.target.parentId ?? null,
          archived: savedDeckHistory.target.archived,
          isDirectParent: savedDeckHistory.target.id === savedDeckHistory.source.parentId,
          leaderId: savedDeckHistory.target.leaderId,
          leader: flockLeaders.find((leader) => leader.id === savedDeckHistory.target?.leaderId)?.name
            ?? savedDeckHistory.target.leaderId,
          runMode: savedDeckHistory.target.runMode,
          cardCount: savedDeckHistory.target.cards.length,
        } : null,
        comparison: savedDeckHistory.comparison ? {
          cardChanges: savedDeckHistory.comparison.cardChanges.map((change) => ({
            position: change.position,
            kind: change.kind,
            current: change.current ? {
              ...change.current,
              name: alphaCardLibrary.get(change.current.id)?.displayName ?? change.current.id,
              available: alphaCardLibrary.has(change.current.id),
            } : null,
            target: change.target ? {
              ...change.target,
              name: alphaCardLibrary.get(change.target.id)?.displayName ?? change.target.id,
              available: alphaCardLibrary.has(change.target.id),
            } : null,
          })),
          unchangedCards: savedDeckHistory.comparison.unchangedCards,
          leaderChanged: savedDeckHistory.comparison.leaderChanged,
          runModeChanged: savedDeckHistory.comparison.runModeChanged,
          exactMatch: savedDeckHistory.comparison.exactMatch,
        } : null,
        createsNewRevision: true,
        preservesSourceAndTarget: true,
        restoresExactTargetOrderAndStates: true,
        canRestore: activeDecks.length < SAVED_DECK_LIMIT
          && Boolean(savedDeckHistory.target)
          && savedDeckHistory.comparison?.exactMatch === false,
        activeCount: activeDecks.length,
        capacity: SAVED_DECK_LIMIT,
        status: state.savedDeckStatus,
        inputs: {
          target: `${controlBindingLabel('previous')} / ${controlBindingLabel('next')} / Up / Down / LB / RB / pointer`,
          restore: `${controlBindingLabel('confirm')} / controller A / pointer`,
          close: `${controlBindingLabel('back')} / controller B / pointer`,
        },
      } : {
        open: false,
        input: 'Flight Lab: R / controller Y / pointer',
        affectsPower: false,
      },
      workshop: savedDeckWorkshop ? {
        open: true,
        deckId: savedDeckWorkshop.deck.id,
        deckName: savedDeckWorkshop.deck.name,
        sourceArchived: savedDeckWorkshop.deck.archived,
        sourceCardIndex: savedDeckWorkshop.cardIndex,
        sourceCardNumber: savedDeckWorkshop.cardIndex + 1,
        sourceCardCount: savedDeckWorkshop.deck.cards.length,
        sourceCard: {
          id: savedDeckWorkshop.sourceCard.id,
          name: savedDeckWorkshop.sourceName,
          upgraded: savedDeckWorkshop.sourceCard.upgraded,
          available: alphaCardLibrary.has(savedDeckWorkshop.sourceCard.id),
        },
        suggestionIndex: state.savedDeckWorkshopSuggestionIndex,
        suggestions: savedDeckWorkshop.suggestions,
        selectedSuggestion: savedDeckWorkshop.suggestions[state.savedDeckWorkshopSuggestionIndex] ?? null,
        ownedCandidatesOnly: true,
        createsNewRevision: true,
        preservesSource: true,
        replacementIsBase: true,
        canSave: activeDecks.length < SAVED_DECK_LIMIT && savedDeckWorkshop.suggestions.length > 0,
        activeCount: activeDecks.length,
        capacity: SAVED_DECK_LIMIT,
        status: state.savedDeckStatus,
        inputs: {
          sourceCard: `${controlBindingLabel('previous')} / ${controlBindingLabel('next')} / LB / RB`,
          suggestion: 'Up / Down / D-pad Up / Down / pointer',
          save: `${controlBindingLabel('confirm')} / controller A / pointer`,
          close: `${controlBindingLabel('back')} / controller B / pointer`,
        },
      } : {
        open: false,
        input: 'Flight Lab: T / controller X / pointer',
        affectsPower: false,
      },
      inputs: {
        select: `${controlBindingLabel('previous')} / ${controlBindingLabel('next')}`,
        favorite: 'C / controller X',
        rename: 'R / controller Y / pointer',
        organize: 'O / controller A / pointer',
        duplicate: 'D / controller LT / pointer',
        copyCode: 'E / controller RT / pointer',
        importCode: 'I / controller L3 / pointer',
        flightLab: 'L / controller R3 / pointer',
        archiveOrRestore: 'A / controller Start / pointer',
        switchLibrary: 'V / controller Select / pointer',
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
  if (!state.saveDataOpen && state.badgeView !== 'folios') {
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
  const tabs: Array<{ view: ProfileBadgeView; x: number; label: string; count: number }> = [
    { view: 'achievements', x: badgeX + 32, label: 'Badges', count: earned.length },
    { view: 'contracts', x: badgeX + 108, label: 'Contracts', count: account.contractBadges.length },
    { view: 'showcase', x: badgeX + 184, label: 'Showcase', count: showcaseEntries.length },
    { view: 'folios', x: badgeX + 260, label: 'Folios', count: savedDecks.length },
  ];
  tabs.forEach((tab) => {
    const selected = state.badgeView === tab.view;
    const focused = state.focus === tab.view;
    const hit = scene.add.rectangle(tab.x, frame.top + 210, 72, MIN_SUPPORTED_TOUCH_TARGET, selected ? 0x183451 : 0x0d1420, 0.94)
      .setStrokeStyle(focused ? 3 : 1, focused ? UI_FIELD.cyan : selected ? UI_FIELD.gold : UI_FIELD.cyan, focused ? 0.98 : selected ? 0.86 : 0.34)
      .setInteractive({ useHandCursor: true })
      .setName(`profile-${tab.view}-tab-hit`)
      .setData('label', tab.label)
      .setData('count', tab.count)
      .setData('selected', selected);
    scene.add.text(tab.x, frame.top + 203, tab.label, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: selected ? UI_GOLD : UI_SOFT,
      fixedWidth: 70,
      align: 'center',
      maxLines: 1,
    }).setResolution(2).setOrigin(0.5).setName('profile-badge-tab-label').setData('view', tab.view);
    scene.add.text(tab.x, frame.top + 220, `${tab.count}`, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: selected ? UI_FIELD.warm : UI_MUTED,
      fixedWidth: 70,
      align: 'center',
      maxLines: 1,
    }).setResolution(2).setOrigin(0.5).setName('profile-badge-tab-count').setData('view', tab.view);
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
    renderSavedFlightFolios(
      scene,
      state,
      dependencies,
      badgeX,
      frame.top,
      savedDecks,
      visibleSavedDecks,
      savedDeckVisibleStart,
      activeDecks.length,
      archivedDecks.length,
    );
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
    const y = frame.top + 256 + index * 39;
    renderProfileRecordRowFrame(scene, badgeX + 150, y, 300, 35, UI_FIELD.brass, badge.earned);
    const icon = addProfileIconImage(scene, 'achievement-medallion', badgeX + 17, y, 12);
    icon?.setAlpha(badge.earned ? 0.95 : 0.34);
    if (!badge.earned) icon?.setTint(0x6d7683);
    scene.add.text(badgeX + 34, y - 13, badge.name, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: badge.earned ? '#ffe1a3' : '#7b8794',
    }).setResolution(2).setName('profile-badge-name').setData('badgeId', badge.id);
    scene.add.text(badgeX + 34, y + 3, badge.description, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      color: badge.earned ? '#cdd9e6' : '#5f6c7a',
      wordWrap: { width: 244 },
      maxLines: 1,
    }).setResolution(2).setName('profile-badge-description').setData('badgeId', badge.id);
  });
  if (state.badgeView !== 'showcase' && badgePageCount > 1) {
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
  if (state.savedDeckTemplateOpen && savedDeckTemplates) {
    renderSavedDeckTemplatePicker(scene, state, dependencies, savedDeckTemplates);
  }
  if (state.savedDeckCodeInput) renderSavedDeckCodePrompt(scene);
  if (state.savedDeckOrganizerOpen && savedDeckOrganizer) {
    renderSavedDeckOrganizer(scene, state, dependencies, savedDeckOrganizer);
  }
  if (state.savedDeckIdentityOpen && savedDeckIdentity) {
    renderSavedDeckIdentity(scene, state, dependencies, savedDeckIdentity);
  }
  if (state.savedDeckLabOpen && savedDeckLab) {
    renderSavedDeckLab(
      scene,
      state,
      dependencies,
      savedDecks[state.savedDeckIndex],
      savedDeckLab,
      savedDeckLaunch!,
    );
  }
  if (state.savedDeckCollectionSignalsOpen && savedDeckCollectionSignals) {
    renderSavedDeckCollectionSignals(scene, state, dependencies, savedDeckCollectionSignals);
  }
  if (state.savedDeckFieldRecordOpen && savedDeckFieldRecord) {
    renderSavedDeckFieldRecord(scene, state, dependencies, savedDeckFieldRecord);
  }
  if (state.savedDeckHistoryOpen && savedDeckHistory) {
    renderSavedDeckHistory(scene, state, dependencies, savedDeckHistory, activeDecks.length);
  }
  if (state.savedDeckWorkshopOpen && savedDeckWorkshop) {
    renderSavedDeckWorkshop(scene, state, dependencies, savedDeckWorkshop, activeDecks.length);
  }
}

function renderSavedDeckOrganizer(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  deck: SavedDeckRecord,
) {
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02050a, 0.9)
    .setInteractive()
    .setName('profile-folio-organizer-scrim');
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1040, 632, 0x07111c, 0.995)
    .setStrokeStyle(3, UI_FIELD.violet, 0.94)
    .setName('profile-folio-organizer-frame');
  scene.add.text(154, 62, 'FOLIO ORGANIZER', {
    fontFamily: 'Georgia, serif',
    fontSize: '29px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 4,
  }).setResolution(2).setName('profile-folio-organizer-title');
  scene.add.text(154, 100, `${deck.name}  /  REV ${deck.revision}`, {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
    fixedWidth: 620,
  }).setResolution(2).setName('profile-folio-organizer-deck-name');
  scene.add.rectangle(1020, 82, 220, 46, 0x143a30, 0.94)
    .setStrokeStyle(2, UI_FIELD.green, 0.86);
  scene.add.text(1020, 82, 'PRIVATE  /  COLLECTION ONLY', {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: '#b9ffdb',
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-organizer-private');

  const folderActive = state.savedDeckOrganizerSection === 'folder';
  scene.add.rectangle(336, 350, 392, 452, 0x091622, 0.96)
    .setStrokeStyle(folderActive ? 2 : 1, folderActive ? UI_FIELD.gold : UI_FIELD.violet, folderActive ? 0.9 : 0.46);
  scene.add.text(158, 142, 'COLLECTION FOLDER', {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: folderActive ? UI_FIELD.warm : UI_FIELD.cyanText,
  }).setResolution(2);
  scene.add.text(492, 144, folderActive ? 'ACTIVE SECTION' : 'TAB / LB / RB', {
    fontFamily: UI_FONT,
    fontSize: '8px',
    fontStyle: UI_BOLD,
    color: folderActive ? UI_FIELD.warm : UI_MUTED,
  }).setResolution(2).setOrigin(1, 0);
  SAVED_DECK_FOLDERS.forEach((folder, index) => {
    const y = 196 + index * 92;
    const assigned = folder.id === (deck.folder ?? 'unfiled');
    const focused = folderActive && state.savedDeckOrganizerIndex === index;
    const hit = scene.add.rectangle(336, y, 354, 78, assigned ? 0x143a30 : focused ? 0x183451 : 0x0d1824, 0.96)
      .setStrokeStyle(focused ? 3 : assigned ? 2 : 1, focused ? UI_FIELD.gold : assigned ? UI_FIELD.green : UI_FIELD.violet, focused ? 0.98 : 0.58)
      .setInteractive({ useHandCursor: true })
      .setName('profile-folio-organizer-folder-hit')
      .setData('folderId', folder.id)
      .setData('index', index);
    hit.on('pointerdown', () => {
      state.savedDeckOrganizerSection = 'folder';
      state.savedDeckOrganizerIndex = index;
      applySavedDeckOrganizerChoice(scene, state, dependencies);
    });
    scene.add.text(176, y - 24, `${assigned ? 'SET / ' : ''}${folder.label.toUpperCase()}`, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: assigned ? '#b9ffdb' : focused ? UI_FIELD.warm : UI_FIELD.cyanText,
      fixedWidth: 316,
    }).setResolution(2).setName('profile-folio-organizer-folder-label').setData('folderId', folder.id);
    scene.add.text(176, y - 2, folder.description, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      color: UI_SOFT,
      fixedWidth: 316,
      wordWrap: { width: 316 },
      maxLines: 2,
    }).setResolution(2);
  });

  const tagsActive = state.savedDeckOrganizerSection === 'tags';
  scene.add.rectangle(826, 350, 548, 452, 0x091622, 0.96)
    .setStrokeStyle(tagsActive ? 2 : 1, tagsActive ? UI_FIELD.gold : UI_FIELD.cyan, tagsActive ? 0.9 : 0.46);
  scene.add.text(566, 142, `STRATEGY LABELS  /  ${(deck.tags ?? []).length}/${SAVED_DECK_TAG_LIMIT}`, {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: tagsActive ? UI_FIELD.warm : UI_FIELD.cyanText,
  }).setResolution(2);
  scene.add.text(1084, 144, tagsActive ? 'ACTIVE SECTION' : 'TAB / LB / RB', {
    fontFamily: UI_FONT,
    fontSize: '8px',
    fontStyle: UI_BOLD,
    color: tagsActive ? UI_FIELD.warm : UI_MUTED,
  }).setResolution(2).setOrigin(1, 0);
  SAVED_DECK_TAGS.forEach((tag, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 694 + column * 264;
    const y = 196 + row * 92;
    const assigned = deck.tags?.includes(tag.id) ?? false;
    const focused = tagsActive && state.savedDeckOrganizerIndex === index;
    const hit = scene.add.rectangle(x, y, 244, 78, assigned ? 0x143a30 : focused ? 0x183451 : 0x0d1824, 0.96)
      .setStrokeStyle(focused ? 3 : assigned ? 2 : 1, focused ? UI_FIELD.gold : assigned ? UI_FIELD.green : UI_FIELD.cyan, focused ? 0.98 : 0.52)
      .setInteractive({ useHandCursor: true })
      .setName('profile-folio-organizer-tag-hit')
      .setData('tagId', tag.id)
      .setData('index', index);
    hit.on('pointerdown', () => {
      state.savedDeckOrganizerSection = 'tags';
      state.savedDeckOrganizerIndex = index;
      applySavedDeckOrganizerChoice(scene, state, dependencies);
    });
    scene.add.text(x - 108, y - 24, `${assigned ? 'SET / ' : ''}${tag.label.toUpperCase()}`, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: assigned ? '#b9ffdb' : focused ? UI_FIELD.warm : UI_FIELD.cyanText,
      fixedWidth: 216,
    }).setResolution(2).setName('profile-folio-organizer-tag-label').setData('tagId', tag.id);
    scene.add.text(x - 108, y - 2, tag.description, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      color: UI_SOFT,
      fixedWidth: 216,
      wordWrap: { width: 216 },
      maxLines: 2,
    }).setResolution(2);
  });

  const status = state.savedDeckStatus === 'tagLimit'
    ? 'THREE-LABEL LIMIT  /  REMOVE ONE BEFORE ADDING ANOTHER'
    : state.savedDeckStatus === 'organized'
      ? 'ORGANIZATION SAVED  /  INCLUDED IN BACKUPS  /  EXCLUDED FROM BSF CODES'
      : 'ORGANIZATION IS PRIVATE  /  NO EFFECT ON FLIGHT POWER';
  scene.add.text(640, 566, status, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: state.savedDeckStatus === 'tagLimit' ? '#ffb09a' : '#b9ffdb',
    fixedWidth: 920,
    align: 'center',
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-organizer-status');
  const identity = dependencies.renderFieldButton(
    scene,
    () => {},
    650,
    626,
    220,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Folio Identity',
    !state.savedDeckRenameInput,
    () => openSavedDeckIdentity(scene, state, dependencies),
    UI_FIELD.gold,
    false,
  );
  identity.setName('profile-folio-organizer-identity-hit');
  const rename = dependencies.renderFieldButton(
    scene,
    () => {},
    870,
    626,
    180,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Rename Folio',
    !state.savedDeckRenameInput,
    () => beginSavedDeckRename(scene, state, dependencies),
    UI_FIELD.violet,
    false,
  );
  rename.setName('profile-folio-organizer-rename-hit');
  const close = dependencies.renderFieldButton(
    scene,
    () => {},
    1060,
    626,
    170,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Back to Folios',
    !state.savedDeckRenameInput,
    () => closeSavedDeckOrganizer(scene, state, dependencies),
    UI_FIELD.cyan,
    false,
  );
  close.setName('profile-folio-organizer-close-hit');
}

function renderSavedDeckIdentity(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  deck: SavedDeckRecord,
) {
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02050a, 0.91)
    .setInteractive()
    .setName('profile-folio-identity-scrim');
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1040, 632, 0x07111c, 0.995)
    .setStrokeStyle(3, UI_FIELD.gold, 0.94)
    .setName('profile-folio-identity-frame');
  scene.add.text(154, 62, 'FOLIO IDENTITY', {
    fontFamily: 'Georgia, serif',
    fontSize: '29px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 4,
  }).setResolution(2).setName('profile-folio-identity-title');
  scene.add.text(154, 100, `${deck.name}  /  COSMETIC COLLECTION PROFILE`, {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
    fixedWidth: 670,
  }).setResolution(2).setName('profile-folio-identity-deck-name');
  scene.add.rectangle(1010, 82, 240, 46, 0x143a30, 0.94)
    .setStrokeStyle(2, UI_FIELD.green, 0.86);
  scene.add.text(1010, 82, 'PRIVATE  /  NO GAMEPLAY POWER', {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: '#b9ffdb',
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-identity-private');

  const coverChoices = savedDeckCoverChoices(deck);
  const coverActive = state.savedDeckIdentitySection === 'cover';
  const selectedCoverId = coverActive
    ? coverChoices[state.savedDeckIdentityIndex] ?? coverChoices[0]
    : deck.coverCardId ?? coverChoices[0];
  const assignedCoverId = deck.coverCardId ?? coverChoices[0];
  const selectedCover = selectedCoverId ? dependencies.cardShowcaseEntry(selectedCoverId) : undefined;
  scene.add.rectangle(392, 336, 476, 400, 0x091622, 0.96)
    .setStrokeStyle(coverActive ? 3 : 1, coverActive ? UI_FIELD.gold : UI_FIELD.violet, coverActive ? 0.94 : 0.46);
  scene.add.text(174, 150, 'COVER CARD', {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: coverActive ? UI_FIELD.warm : UI_FIELD.cyanText,
  }).setResolution(2);
  scene.add.text(608, 151, `${Math.max(1, coverChoices.indexOf(selectedCoverId) + 1)} / ${coverChoices.length}`, {
    fontFamily: UI_FONT,
    fontSize: '9px',
    fontStyle: UI_BOLD,
    color: UI_MUTED,
  }).setResolution(2).setOrigin(1, 0);
  const artFrame = scene.add.rectangle(
    392,
    294,
    344,
    206,
    0x0c1824,
    0.98,
  ).setStrokeStyle(
    selectedCoverId === assignedCoverId ? 3 : coverActive ? 2 : 1,
    selectedCoverId === assignedCoverId ? UI_FIELD.green : UI_FIELD.cyan,
    0.92,
  ).setInteractive({ useHandCursor: true })
    .setName('profile-folio-identity-cover-hit')
    .setData('cardId', selectedCoverId ?? '');
  artFrame.on('pointerdown', () => {
    state.savedDeckIdentitySection = 'cover';
    state.savedDeckIdentityIndex = Math.max(0, coverChoices.indexOf(selectedCoverId));
    applySavedDeckIdentityChoice(scene, state, dependencies);
  });
  if (selectedCover?.artKey && scene.textures.exists(selectedCover.artKey)) {
    scene.add.image(392, 294, selectedCover.artKey)
      .setDisplaySize(328, 190)
      .setName('profile-folio-identity-cover-art')
      .setData('cardId', selectedCoverId);
  } else {
    scene.add.text(392, 294, 'CARD ART LOADING', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: UI_MUTED,
    }).setResolution(2).setOrigin(0.5).setName('profile-folio-identity-cover-loading');
  }
  const coverName = selectedCover?.name
    ?? alphaCardSet.cards.find((card) => card.id === selectedCoverId)?.displayName
    ?? selectedCoverId
    ?? 'No cover card';
  scene.add.text(392, 414, `${selectedCoverId === assignedCoverId ? 'SET / ' : ''}${coverName}`, {
    fontFamily: UI_FONT,
    fontSize: '14px',
    fontStyle: UI_BOLD,
    color: selectedCoverId === assignedCoverId ? '#b9ffdb' : UI_FIELD.warm,
    fixedWidth: 390,
    align: 'center',
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-identity-cover-name');
  const previousCover = dependencies.renderFieldButton(
    scene,
    () => {},
    292,
    454,
    180,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Previous Cover',
    coverChoices.length > 1 && !state.savedDeckDescriptionInput,
    () => {
      if (!coverActive) switchSavedDeckIdentitySection(scene, state, dependencies, 'cover');
      else cycleSavedDeckIdentityChoice(scene, state, dependencies, -1);
    },
    UI_FIELD.violet,
    false,
  );
  previousCover.setName('profile-folio-identity-cover-previous-hit');
  const nextCover = dependencies.renderFieldButton(
    scene,
    () => {},
    492,
    454,
    180,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Next Cover',
    coverChoices.length > 1 && !state.savedDeckDescriptionInput,
    () => {
      if (!coverActive) switchSavedDeckIdentitySection(scene, state, dependencies, 'cover');
      else cycleSavedDeckIdentityChoice(scene, state, dependencies, 1);
    },
    UI_FIELD.violet,
    false,
  );
  nextCover.setName('profile-folio-identity-cover-next-hit');
  scene.add.text(392, 509, deck.description || 'No description yet. Add one clear line about this Folio.', {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: deck.description ? UI_BOLD : 'normal',
    color: deck.description ? UI_SOFT : UI_MUTED,
    fixedWidth: 406,
    align: 'center',
    wordWrap: { width: 406 },
    maxLines: 2,
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-identity-description');

  const sleeveActive = state.savedDeckIdentitySection === 'sleeve';
  const assignedSleeveId = deck.sleeve ?? 'field';
  scene.add.rectangle(882, 336, 450, 400, 0x091622, 0.96)
    .setStrokeStyle(sleeveActive ? 3 : 1, sleeveActive ? UI_FIELD.gold : UI_FIELD.cyan, sleeveActive ? 0.94 : 0.46);
  scene.add.text(676, 150, 'CARD-BACK SLEEVE', {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: sleeveActive ? UI_FIELD.warm : UI_FIELD.cyanText,
  }).setResolution(2);
  scene.add.text(1086, 151, sleeveActive ? 'ACTIVE SECTION' : 'TAB / LB / RB', {
    fontFamily: UI_FONT,
    fontSize: '8px',
    fontStyle: UI_BOLD,
    color: sleeveActive ? UI_FIELD.warm : UI_MUTED,
  }).setResolution(2).setOrigin(1, 0);
  SAVED_DECK_SLEEVES.forEach((sleeve, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 776 + column * 214;
    const y = 256 + row * 184;
    const assigned = sleeve.id === assignedSleeveId;
    const focused = sleeveActive && state.savedDeckIdentityIndex === index;
    const hit = scene.add.rectangle(x, y, 190, 164, sleeve.primary, 0.98)
      .setStrokeStyle(focused ? 3 : assigned ? 2 : 1, focused ? UI_FIELD.gold : assigned ? UI_FIELD.green : sleeve.accent, focused ? 0.98 : 0.68)
      .setInteractive({ useHandCursor: true })
      .setName('profile-folio-identity-sleeve-hit')
      .setData('sleeveId', sleeve.id)
      .setData('index', index);
    hit.on('pointerdown', () => {
      state.savedDeckIdentitySection = 'sleeve';
      state.savedDeckIdentityIndex = index;
      applySavedDeckIdentityChoice(scene, state, dependencies);
    });
    scene.add.rectangle(x, y - 17, 66, 88, sleeve.primary, 1)
      .setStrokeStyle(3, sleeve.accent, 0.96);
    scene.add.line(x, y - 17, -22, -28, 22, 28, sleeve.accent, 0.82).setLineWidth(3);
    scene.add.line(x, y - 17, 22, -28, -22, 28, sleeve.ink, 0.72).setLineWidth(2);
    scene.add.circle(x, y - 17, 9, sleeve.ink, 0.92).setStrokeStyle(2, sleeve.accent, 0.96);
    scene.add.text(x, y + 46, `${assigned ? 'SET / ' : ''}${sleeve.label.toUpperCase()}`, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: assigned ? '#b9ffdb' : focused ? UI_FIELD.warm : UI_FIELD.cyanText,
      fixedWidth: 172,
      align: 'center',
    }).setResolution(2).setOrigin(0.5).setName('profile-folio-identity-sleeve-label').setData('sleeveId', sleeve.id);
    scene.add.text(x, y + 68, sleeve.description, {
      fontFamily: UI_FONT,
      fontSize: '8px',
      color: UI_SOFT,
      fixedWidth: 168,
      align: 'center',
      wordWrap: { width: 168 },
      maxLines: 2,
    }).setResolution(2).setOrigin(0.5, 0);
  });

  const status = state.savedDeckStatus === 'descriptionSaved'
    ? 'DESCRIPTION SAVED  /  PRIVATE COLLECTION METADATA'
    : state.savedDeckStatus === 'personalized'
      ? 'FOLIO IDENTITY SAVED  /  INCLUDED IN BACKUPS  /  EXCLUDED FROM BSF CODES'
      : 'COVER + SLEEVE + DESCRIPTION ARE COSMETIC  /  NO EFFECT ON FLIGHT POWER';
  scene.add.text(640, 566, status, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: state.savedDeckStatus === 'failed' ? '#ffb09a' : '#b9ffdb',
    fixedWidth: 920,
    align: 'center',
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-identity-status');
  const editDescription = dependencies.renderFieldButton(
    scene,
    () => {},
    518,
    626,
    200,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Edit Description',
    !state.savedDeckDescriptionInput,
    () => beginSavedDeckDescription(scene, state, dependencies),
    UI_FIELD.violet,
    false,
  );
  editDescription.setName('profile-folio-identity-description-hit');
  const apply = dependencies.renderFieldButton(
    scene,
    () => {},
    748,
    626,
    220,
    MIN_SUPPORTED_TOUCH_TARGET,
    state.savedDeckIdentitySection === 'cover' ? 'Set Cover Card' : 'Set Card Back',
    !state.savedDeckDescriptionInput,
    () => applySavedDeckIdentityChoice(scene, state, dependencies),
    UI_FIELD.green,
    false,
  );
  apply.setName('profile-folio-identity-apply-hit');
  const close = dependencies.renderFieldButton(
    scene,
    () => {},
    1010,
    626,
    180,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Back to Organizer',
    !state.savedDeckDescriptionInput,
    () => closeSavedDeckIdentity(scene, state, dependencies),
    UI_FIELD.cyan,
    false,
  );
  close.setName('profile-folio-identity-close-hit');
}

function renderSavedDeckCodePrompt(scene: Phaser.Scene) {
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02050a, 0.8)
    .setInteractive()
    .setName('profile-folio-import-scrim');
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 720, 196, 0x081421, 0.98)
    .setStrokeStyle(3, UI_FIELD.cyan, 0.94)
    .setName('profile-folio-import-prompt-frame');
  scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 68, `IMPORT BSF${SAVED_DECK_CODE_VERSION} FLIGHT CODE`, {
    fontFamily: 'Georgia, serif',
    fontSize: '24px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 3,
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-import-prompt-title');
  scene.add.text(
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2 + 62,
    'Paste into the focused field  ·  Enter: Import  ·  Esc: Cancel\nVersion and checksum are verified before any save changes.',
    {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.cyanText,
      align: 'center',
      lineSpacing: 6,
    },
  ).setResolution(2).setOrigin(0.5).setName('profile-folio-import-prompt-help');
}

function renderSavedDeckLab(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  deck: SavedDeckRecord,
  analysis: SavedDeckLabAnalysis,
  launch: SavedDeckLaunchState,
) {
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02050a, 0.88)
    .setInteractive()
    .setName('profile-flight-lab-scrim');
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1040, 632, 0x07111c, 0.99)
    .setStrokeStyle(3, UI_FIELD.cyan, 0.92)
    .setName('profile-flight-lab-frame');
  scene.add.text(154, 62, 'FLIGHT LAB', {
    fontFamily: 'Georgia, serif',
    fontSize: '29px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 4,
  }).setResolution(2).setName('profile-flight-lab-title');
  scene.add.text(154, 100, `${deck.name}  ·  REV ${deck.revision}`, {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
    fixedWidth: 620,
  }).setResolution(2).setName('profile-flight-lab-deck-name');
  const legalLabel = analysis.legalForStandardFlight ? 'STANDARD READY' : 'REVIEW NEEDED';
  const launchHit = dependencies.renderFieldButton(
    scene,
    () => {},
    1030,
    82,
    192,
    MIN_SUPPORTED_TOUCH_TARGET,
    launch.label,
    launch.available,
    () => launchSelectedSavedDeck(scene, state, dependencies),
    launch.available ? UI_FIELD.green : UI_FIELD.gold,
    false,
  );
  launchHit
    .setName('profile-flight-lab-launch-hit')
    .setData('available', launch.available)
    .setData('block', launch.block ?? null)
    .setData('missingOwnedIds', launch.missingOwnedIds);
  scene.add.text(154, 113, legalLabel, {
    fontFamily: UI_FONT,
    fontSize: '8px',
    fontStyle: UI_BOLD,
    color: analysis.legalForStandardFlight ? '#b9ffdb' : '#ffd7a0',
  }).setResolution(2).setName('profile-flight-lab-legality');
  scene.add.text(784, 100, launch.detail, {
    fontFamily: UI_FONT,
    fontSize: '9px',
    fontStyle: UI_BOLD,
    color: launch.available ? '#b9ffdb' : '#ffd7a0',
    fixedWidth: 360,
    align: 'right',
    maxLines: 2,
  }).setResolution(2).setOrigin(1, 0.5).setName('profile-flight-lab-launch-detail');

  scene.add.rectangle(336, 366, 392, 480, 0x0a1724, 0.96)
    .setStrokeStyle(1, UI_FIELD.violet, 0.58);
  scene.add.text(158, 142, 'DECK SHAPE', {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
  }).setResolution(2);
  const metrics = [
    ['SAVED', analysis.savedCopies],
    ['PLAYABLE', analysis.playableCards],
    ['PREENED', analysis.preenedCards],
    ['AVG COST', analysis.averageCost.toFixed(2)],
  ];
  metrics.forEach(([label, value], index) => {
    const x = 202 + index * 90;
    scene.add.rectangle(x, 184, 80, 56, 0x0d2231, 0.94)
      .setStrokeStyle(1, index === 3 ? UI_FIELD.gold : UI_FIELD.cyan, 0.58);
    scene.add.text(x, 170, String(label), {
      fontFamily: UI_FONT,
      fontSize: '8px',
      fontStyle: UI_BOLD,
      color: UI_MUTED,
    }).setResolution(2).setOrigin(0.5);
    scene.add.text(x, 194, String(value), {
      fontFamily: UI_FONT,
      fontSize: '15px',
      fontStyle: UI_BOLD,
      color: index === 3 ? UI_FIELD.warm : UI_FIELD.cyanText,
    }).setResolution(2).setOrigin(0.5);
  });

  scene.add.text(158, 228, 'COST CURVE', {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
  }).setResolution(2);
  const maxCurve = Math.max(1, ...analysis.costCurve.map((entry) => entry.count));
  analysis.costCurve.forEach((entry, index) => {
    const x = 202 + index * 90;
    const height = 10 + Math.round(entry.count / maxCurve * 38);
    scene.add.rectangle(x, 286 - height / 2, 50, height, index === 3 ? UI_FIELD.gold : UI_FIELD.violet, 0.74)
      .setStrokeStyle(1, index === 3 ? UI_FIELD.gold : UI_FIELD.cyan, 0.7);
    scene.add.text(x, 298, `${entry.label}  ·  ${entry.count}`, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: UI_SOFT,
    }).setResolution(2).setOrigin(0.5);
  });

  const compactRows: Array<[string, Array<{ label: string; count: number }>]> = [
    ['ROLES', analysis.roles],
    ['FAMILIES', analysis.families],
    ['RESOURCE HOOKS', analysis.resourceHooks],
  ];
  compactRows.forEach(([label, entries], index) => {
    const y = 330 + index * 62;
    scene.add.text(158, y, label, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: UI_MUTED,
    }).setResolution(2);
    scene.add.text(158, y + 20, entries.map((entry) => `${entry.label} ${entry.count}`).join('  ·  ') || 'None', {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_SOFT,
      fixedWidth: 354,
      wordWrap: { width: 354 },
      maxLines: 2,
    }).setResolution(2);
  });
  const issueText = analysis.issues.length > 0
    ? analysis.issues.join('\n')
    : 'Current singleton rules recognize every saved card. Practice never changes the folio.';
  scene.add.rectangle(336, 552, 356, 90, analysis.issues.length > 0 ? 0x2d1d18 : 0x10271f, 0.9)
    .setStrokeStyle(1, analysis.issues.length > 0 ? UI_FIELD.gold : UI_FIELD.green, 0.7);
  scene.add.text(172, 520, analysis.issues.length > 0 ? 'WHY REVIEW IS NEEDED' : 'NON-DESTRUCTIVE PRACTICE', {
    fontFamily: UI_FONT,
    fontSize: '9px',
    fontStyle: UI_BOLD,
    color: analysis.issues.length > 0 ? '#ffd7a0' : '#b9ffdb',
  }).setResolution(2);
  scene.add.text(172, 540, issueText, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    color: UI_SOFT,
    fixedWidth: 328,
    wordWrap: { width: 328 },
    maxLines: 3,
  }).setResolution(2).setName('profile-flight-lab-issues');

  scene.add.rectangle(826, 366, 548, 480, 0x091622, 0.96)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.52);
  scene.add.text(566, 142, `SAMPLE HAND ${analysis.sample.number}`, {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
  }).setResolution(2).setName('profile-flight-lab-sample-title');
  scene.add.text(1100, 144, `${analysis.rules.wingbeats} WINGBEATS  ·  ${analysis.rules.handSize} DRAW`, {
    fontFamily: UI_FONT,
    fontSize: '9px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
  }).setResolution(2).setOrigin(1, 0);
  analysis.sample.cards.forEach((card, index) => {
    const x = 610 + index * 104;
    const y = 250;
    scene.add.rectangle(x, y, 92, 150, card.playable ? 0x102637 : 0x1d1820, 0.98)
      .setStrokeStyle(2, card.pressure ? UI_FIELD.gold : card.playable ? UI_FIELD.cyan : UI_FIELD.violet, 0.8)
      .setName('profile-flight-lab-card-frame')
      .setData('cardId', card.id);
    const entry = dependencies.cardShowcaseEntry(card.id);
    if (entry?.artKey && scene.textures.exists(entry.artKey)) {
      scene.textures.get(entry.artKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      scene.add.image(x, y - 14, entry.artKey)
        .setDisplaySize(84, 116)
        .setName('profile-flight-lab-card-art')
        .setData('cardId', card.id);
    } else {
      scene.add.text(x, y - 14, card.name, {
        fontFamily: UI_FONT,
        fontSize: '11px',
        fontStyle: UI_BOLD,
        color: UI_FIELD.warm,
        align: 'center',
        wordWrap: { width: 74 },
      }).setResolution(2).setOrigin(0.5);
    }
    scene.add.circle(x - 33, y - 58, 14, 0x08111b, 0.98)
      .setStrokeStyle(2, UI_FIELD.gold, 0.9);
    scene.add.text(x - 33, y - 58, `${card.cost}`, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.warm,
    }).setResolution(2).setOrigin(0.5);
    scene.add.text(x, y + 48, `${card.upgraded ? 'PREENED  ·  ' : ''}${card.role.toUpperCase()}`, {
      fontFamily: UI_FONT,
      fontSize: '8px',
      fontStyle: UI_BOLD,
      color: card.playable ? UI_FIELD.cyanText : '#d9a9bd',
      fixedWidth: 86,
      align: 'center',
    }).setResolution(2).setOrigin(0.5);
  });
  if (analysis.sample.cards.length === 0) {
    scene.add.text(826, 250, 'No currently playable card definitions are available for this folio.', {
      fontFamily: UI_FONT,
      fontSize: '13px',
      color: UI_SOFT,
      align: 'center',
      fixedWidth: 480,
      wordWrap: { width: 480 },
    }).setResolution(2).setOrigin(0.5);
  }
  scene.add.text(
    826,
    350,
    `${analysis.sample.playableCount}/${analysis.sample.cards.length} playable now  ·  ${analysis.sample.pressureCount} pressure  ·  ${analysis.sample.totalCost} total cost  ·  ${analysis.sample.protectionSwaps} protection swaps`,
    {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.cyanText,
      fixedWidth: 500,
      align: 'center',
    },
  ).setResolution(2).setOrigin(0.5).setName('profile-flight-lab-sample-summary');
  scene.add.text(566, 390, `DRAW CONSISTENCY  ·  ${analysis.consistency.sampleCount} DETERMINISTIC HANDS`, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
  }).setResolution(2);
  const pressureText = analysis.consistency.pressureAvailable
    ? `${analysis.consistency.pressurePercent}% pressure`
    : 'No pressure card in deck';
  const consistencyRows = [
    `${analysis.consistency.averagePlayable} avg playable  ·  ${analysis.consistency.atLeastTwoPlayablePercent}% open with two playable`,
    `${pressureText}  ·  ${analysis.consistency.uniqueHands}/${analysis.consistency.sampleCount} distinct hands`,
    `${analysis.consistency.averageProtectionSwaps} avg protection swaps  ·  exact folio order remains unchanged`,
  ];
  consistencyRows.forEach((row, index) => {
    scene.add.rectangle(826, 430 + index * 38, 500, 30, 0x0d2231, 0.9)
      .setStrokeStyle(1, index === 1 ? UI_FIELD.gold : UI_FIELD.violet, 0.44);
    scene.add.text(826, 430 + index * 38, row, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      color: UI_SOFT,
      align: 'center',
      fixedWidth: 476,
    }).setResolution(2).setOrigin(0.5);
  });
  scene.add.text(826, 552, 'Representative practice only  ·  no Scrap spent  ·  no save or run changes', {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: '#b9ffdb',
  }).setResolution(2).setOrigin(0.5);

  const collectionSignals = dependencies.renderFieldButton(
    scene,
    () => {},
    200,
    626,
    126,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Signals',
    true,
    () => openSavedDeckCollectionSignals(scene, state, dependencies),
    UI_FIELD.gold,
    false,
  );
  collectionSignals.setName('profile-flight-lab-collection-signals-hit');
  const fieldRecord = dependencies.renderFieldButton(
    scene,
    () => {},
    340,
    626,
    126,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Field Record',
    true,
    () => openSavedDeckFieldRecord(scene, state, dependencies),
    UI_FIELD.cyan,
    false,
  );
  fieldRecord.setName('profile-flight-lab-field-record-hit');
  const history = dependencies.renderFieldButton(
    scene,
    () => {},
    480,
    626,
    126,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Revision Trail',
    true,
    () => openSavedDeckHistory(scene, state, dependencies),
    UI_FIELD.cyan,
    false,
  );
  history.setName('profile-flight-lab-history-hit');
  const tune = dependencies.renderFieldButton(
    scene,
    () => {},
    620,
    626,
    126,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Tune Copy',
    true,
    () => openSavedDeckWorkshop(scene, state, dependencies),
    UI_FIELD.green,
    false,
  );
  tune.setName('profile-flight-lab-tune-hit');
  const previous = dependencies.renderFieldButton(
    scene,
    () => {},
    760,
    626,
    126,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Previous Hand',
    state.savedDeckLabSample > 0,
    () => cycleSavedDeckLabSample(scene, state, dependencies, -1),
    UI_FIELD.violet,
    false,
  );
  previous.setName('profile-flight-lab-previous-hit');
  const deal = dependencies.renderFieldButton(
    scene,
    () => {},
    900,
    626,
    126,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Deal Again',
    true,
    () => cycleSavedDeckLabSample(scene, state, dependencies, 1),
    UI_FIELD.gold,
    false,
  );
  deal.setName('profile-flight-lab-deal-hit');
  const close = dependencies.renderFieldButton(
    scene,
    () => {},
    1040,
    626,
    126,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Close Lab',
    true,
    () => closeSavedDeckLab(scene, state, dependencies),
    UI_FIELD.cyan,
    false,
  );
  close.setName('profile-flight-lab-close-hit');
}

function renderSavedDeckCollectionSignals(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  signals: SavedDeckCollectionSignals,
) {
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02050a, 0.9)
    .setInteractive()
    .setName('profile-collection-signals-scrim');
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1040, 632, 0x07111c, 0.995)
    .setStrokeStyle(3, UI_FIELD.gold, 0.94)
    .setName('profile-collection-signals-frame');
  scene.add.text(154, 58, 'COLLECTION SIGNALS', {
    fontFamily: 'Georgia, serif',
    fontSize: '29px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 4,
  }).setResolution(2).setName('profile-collection-signals-title');
  scene.add.text(154, 96, `${signals.deckName}  /  READ-ONLY COLLECTION CONTEXT`, {
    fontFamily: UI_FONT,
    fontSize: '12px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
    fixedWidth: 760,
  }).setResolution(2).setName('profile-collection-signals-deck-name');
  dependencies.renderCloseControl(
    scene,
    () => {},
    1110,
    76,
    () => closeSavedDeckCollectionSignals(scene, state, dependencies),
  );

  const metrics: Array<[string, number, number]> = [
    ['OWNED CARDS', signals.ownedCount, UI_FIELD.cyan],
    ['SAVED FOLIOS', signals.folioCount, UI_FIELD.violet],
    ['IN ARCHIVE', signals.archivedFolioCount, UI_FIELD.green],
    ['UNUSED', signals.unusedCount, UI_FIELD.gold],
  ];
  metrics.forEach(([label, value, accent], index) => {
    const x = 264 + index * 250;
    scene.add.text(x, 140, `${label}  ${value}`, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: accent === UI_FIELD.gold ? UI_FIELD.warm : UI_FIELD.cyanText,
      fixedWidth: 224,
      align: 'center',
    }).setResolution(2).setOrigin(0.5);
  });

  type SignalRow = { title: string; detail: string; ids: string[]; current?: boolean };
  const dateLabel = (timestamp: number) => timestamp > 0
    ? new Date(timestamp).toISOString().slice(0, 10)
    : 'DATE UNKNOWN';
  const columns: Array<{
    id: string;
    title: string;
    description: string;
    accent: number;
    rows: SignalRow[];
    empty: string;
  }> = [
    {
      id: 'unused',
      title: 'UNUSED OWNED',
      description: 'Owned, in no saved Folio',
      accent: UI_FIELD.gold,
      rows: signals.unused.map((card) => ({
        title: card.name,
        detail: `${dateLabel(card.firstAcquiredAt)} / NEVER FILED`,
        ids: [card.id],
      })),
      empty: signals.ownedCount === 0 ? 'No permanent cards collected yet.' : 'Every owned card appears in a saved Folio.',
    },
    {
      id: 'frequent',
      title: 'MANY FOLIOS',
      description: 'Distinct Folios, copies ignored',
      accent: UI_FIELD.cyan,
      rows: signals.frequentlyFiled.map((card) => ({
        title: card.name,
        detail: `${card.folioCount} FOLIO${card.folioCount === 1 ? '' : 'S'} / ${card.activeFolioCount} ACTIVE${card.inSelectedFolio ? ' / HERE' : ''}`,
        ids: [card.id],
        current: card.inSelectedFolio,
      })),
      empty: 'No owned cards appear in a saved Folio yet.',
    },
    {
      id: 'recent',
      title: 'NEW ARRIVALS',
      description: 'First-acquired, newest first',
      accent: UI_FIELD.green,
      rows: signals.recentlyAcquired.map((card) => ({
        title: card.name,
        detail: `${dateLabel(card.firstAcquiredAt)} / ${card.folioCount === 0 ? 'UNUSED' : `${card.folioCount} FOLIO${card.folioCount === 1 ? '' : 'S'}`}`,
        ids: [card.id],
        current: card.inSelectedFolio,
      })),
      empty: 'No permanent acquisition records yet.',
    },
    {
      id: 'paired',
      title: 'COMMON PAIRS',
      description: 'Share a Folio; touches this list',
      accent: UI_FIELD.violet,
      rows: signals.commonlyPaired.map((pair) => ({
        title: `${pair.first.name} + ${pair.second.name}`,
        detail: `${pair.folioCount} FOLIO${pair.folioCount === 1 ? '' : 'S'} / ${pair.activeFolioCount} ACTIVE${pair.bothInSelectedFolio ? ' / BOTH HERE' : ''}`,
        ids: [pair.first.id, pair.second.id],
        current: pair.bothInSelectedFolio,
      })),
      empty: 'No owned card pair around this Folio yet.',
    },
  ];
  columns.forEach((column, columnIndex) => {
    const x = 264 + columnIndex * 250;
    scene.add.rectangle(x, 366, 224, 390, 0x091622, 0.46)
      .setName(`profile-collection-signals-${column.id}-panel`);
    if (columnIndex > 0) scene.add.rectangle(x - 125, 366, 1, 376, column.accent, 0.28);
    scene.add.text(x, 185, column.title, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: column.accent === UI_FIELD.gold ? UI_FIELD.warm : UI_FIELD.cyanText,
      fixedWidth: 204,
      align: 'center',
    }).setResolution(2).setOrigin(0.5);
    scene.add.text(x, 209, column.description, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      color: UI_MUTED,
      fixedWidth: 204,
      align: 'center',
    }).setResolution(2).setOrigin(0.5);
    if (column.rows.length === 0) {
      scene.add.text(x, 358, column.empty, {
        fontFamily: UI_FONT,
        fontSize: '11px',
        color: UI_SOFT,
        align: 'center',
        fixedWidth: 180,
        wordWrap: { width: 180 },
      }).setResolution(2).setOrigin(0.5).setName(`profile-collection-signals-${column.id}-empty`);
      return;
    }
    column.rows.forEach((row, rowIndex) => {
      const y = 255 + rowIndex * 58;
      scene.add.rectangle(x, y, 204, 50, row.current ? 0x123244 : 0x0b1824, row.current ? 0.92 : rowIndex % 2 === 0 ? 0.58 : 0.32)
        .setStrokeStyle(row.current ? 2 : 0, row.current ? UI_FIELD.cyan : column.accent, row.current ? 0.84 : 0)
        .setName(`profile-collection-signals-${column.id}-row`)
        .setData('cardIds', row.ids)
        .setData('currentFolio', row.current === true);
      scene.add.text(x - 92, y - 18, row.title, {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: row.current ? '#dffbff' : UI_FIELD.warm,
        fixedWidth: 184,
        maxLines: 2,
        wordWrap: { width: 184 },
      }).setResolution(2);
      scene.add.text(x - 92, y + 11, row.detail, {
        fontFamily: UI_FONT,
        fontSize: '9px',
        fontStyle: UI_BOLD,
        color: row.current ? UI_FIELD.cyanText : UI_MUTED,
        fixedWidth: 184,
        maxLines: 1,
      }).setResolution(2);
    });
  });

  scene.add.text(
    154,
    579,
    'Usage = distinct saved Folios, including Archive / duplicate copies count once / pair = same Folio',
    {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.cyanText,
      fixedWidth: 850,
    },
  ).setResolution(2).setName('profile-collection-signals-method');
  scene.add.text(
    154,
    600,
    'Descriptive context only / no recommendations / no Folio edits / no gameplay power',
    {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: '#b9ffdb',
      fixedWidth: 850,
    },
  ).setResolution(2).setName('profile-collection-signals-safety');
  dependencies.renderFieldButton(
    scene,
    () => {},
    1040,
    626,
    126,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Back to Lab',
    true,
    () => closeSavedDeckCollectionSignals(scene, state, dependencies),
    UI_FIELD.cyan,
    false,
  ).setName('profile-collection-signals-close-hit');
}

function renderSavedDeckNotesPrompt(scene: Phaser.Scene, deck: SavedDeckRecord) {
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02050a, 0.56)
    .setInteractive()
    .setName('profile-folio-notes-scrim');
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 720, 326, 0x081421, 0.995)
    .setStrokeStyle(3, UI_FIELD.cyan, 0.94)
    .setName('profile-folio-notes-prompt-frame');
  scene.add.text(GAME_WIDTH / 2, 232, 'EDIT PRIVATE MATCHUP NOTES', {
    fontFamily: 'Georgia, serif',
    fontSize: '24px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 3,
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-notes-prompt-title');
  scene.add.text(GAME_WIDTH / 2, 268, `${deck.name}  ·  REV ${deck.revision}  ·  ${SAVED_DECK_NOTES_LIMIT} CHARACTER LIMIT`, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
  }).setResolution(2).setOrigin(0.5);
  scene.add.text(
    GAME_WIDTH / 2,
    490,
    'Enter: Save  ·  Shift+Enter: New Line  ·  Esc: Cancel\nPrivate notes never enter BSF share codes and never affect play.',
    {
      fontFamily: UI_FONT,
      fontSize: '11px',
      color: UI_SOFT,
      align: 'center',
      lineSpacing: 5,
    },
  ).setResolution(2).setOrigin(0.5).setName('profile-folio-notes-prompt-help');
}

function renderSavedDeckFieldRecord(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  field: SavedDeckFieldRecordState,
) {
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02050a, 0.9)
    .setInteractive()
    .setName('profile-folio-field-record-scrim');
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1040, 632, 0x07111c, 0.995)
    .setStrokeStyle(3, UI_FIELD.gold, 0.92)
    .setName('profile-folio-field-record-frame');
  scene.add.text(154, 62, 'FOLIO FIELD RECORD', {
    fontFamily: 'Georgia, serif',
    fontSize: '29px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 4,
  }).setResolution(2).setName('profile-folio-field-record-title');
  scene.add.text(154, 100, `${field.deck.name}  ·  REV ${field.deck.revision}${field.deck.archived ? '  ·  ARCHIVED' : ''}`, {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
    fixedWidth: 660,
  }).setResolution(2).setName('profile-folio-field-record-deck-name');
  scene.add.rectangle(1000, 88, 252, 46, 0x143a30, 0.96)
    .setStrokeStyle(2, UI_FIELD.green, 0.92);
  scene.add.text(1000, 88, 'PRIVATE  ·  EXACT MATCHES ONLY', {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: '#b9ffdb',
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-field-record-private');

  scene.add.rectangle(336, 354, 392, 468, 0x0a1724, 0.96)
    .setStrokeStyle(1, UI_FIELD.violet, 0.58);
  scene.add.text(158, 138, 'EXACT DECK PERFORMANCE', {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
  }).setResolution(2);
  const metrics: Array<[string, string]> = [
    ['FLIGHTS', String(field.record.flights)],
    ['WINS', String(field.record.wins)],
    ['WIN RATE', field.record.flights > 0 ? `${field.record.winRate}%` : '—'],
    ['AVG TURNS', field.record.averageTurns === null ? '—' : String(field.record.averageTurns)],
  ];
  metrics.forEach(([label, value], index) => {
    const x = 202 + index * 90;
    scene.add.rectangle(x, 184, 80, 56, 0x0d2231, 0.94)
      .setStrokeStyle(1, index === 2 ? UI_FIELD.gold : UI_FIELD.cyan, 0.58);
    scene.add.text(x, 170, label, {
      fontFamily: UI_FONT,
      fontSize: '8px',
      fontStyle: UI_BOLD,
      color: UI_MUTED,
    }).setResolution(2).setOrigin(0.5);
    scene.add.text(x, 194, value, {
      fontFamily: UI_FONT,
      fontSize: '15px',
      fontStyle: UI_BOLD,
      color: index === 2 ? UI_FIELD.warm : UI_FIELD.cyanText,
    }).setResolution(2).setOrigin(0.5);
  });
  scene.add.rectangle(336, 260, 356, 76, 0x0d2231, 0.9)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.48);
  scene.add.text(336, 244, 'MATCH CONTRACT', {
    fontFamily: UI_FONT,
    fontSize: '9px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
  }).setResolution(2).setOrigin(0.5);
  scene.add.text(336, 270, 'Same leader  ·  mode  ·  card order  ·  Base/Preened states', {
    fontFamily: UI_FONT,
    fontSize: '9px',
    fontStyle: UI_BOLD,
    color: UI_SOFT,
    fixedWidth: 330,
    align: 'center',
  }).setResolution(2).setOrigin(0.5);

  scene.add.text(158, 314, 'PRIVATE MATCHUP NOTES', {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
  }).setResolution(2);
  scene.add.text(500, 314, `${field.deck.notes?.length ?? 0}/${SAVED_DECK_NOTES_LIMIT}`, {
    fontFamily: UI_FONT,
    fontSize: '8px',
    fontStyle: UI_BOLD,
    color: UI_MUTED,
  }).setResolution(2).setOrigin(1, 0);
  scene.add.rectangle(336, 420, 356, 184, 0x0b1420, 0.94)
    .setStrokeStyle(1, field.deck.notes ? UI_FIELD.gold : UI_FIELD.violet, 0.58);
  scene.add.text(172, 342, field.deck.notes || 'No notes yet.\n\nRecord matchup lessons, mulligan reminders, or the next change you want to test.', {
    fontFamily: UI_FONT,
    fontSize: '11px',
    color: field.deck.notes ? UI_SOFT : UI_MUTED,
    fixedWidth: 328,
    wordWrap: { width: 328 },
    maxLines: 8,
    lineSpacing: 4,
  }).setResolution(2).setName('profile-folio-field-record-notes');
  scene.add.text(336, 524, state.savedDeckStatus === 'notesSaved'
    ? 'PRIVATE NOTES SAVED'
    : 'Local save + backups only  ·  excluded from BSF codes', {
    fontFamily: UI_FONT,
    fontSize: '8px',
    fontStyle: UI_BOLD,
    color: state.savedDeckStatus === 'notesSaved' ? '#b9ffdb' : UI_FIELD.cyanText,
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-field-record-note-status');

  scene.add.rectangle(826, 354, 548, 468, 0x091622, 0.96)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.52);
  scene.add.text(566, 138, 'RECENT EXACT-MATCH FLIGHTS', {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
  }).setResolution(2);
  const fastest = field.record.fastestWinTurns === null ? 'NO WIN YET' : `FASTEST WIN ${field.record.fastestWinTurns} TURNS`;
  scene.add.text(1094, 140, `${fastest}  ·  BEST COHESION ${field.record.bestCohesionPercent ?? 0}%`, {
    fontFamily: UI_FONT,
    fontSize: '8px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
  }).setResolution(2).setOrigin(1, 0);
  field.record.recent.forEach((flight, index) => {
    const y = 190 + index * 70;
    const won = flight.result === 'win';
    scene.add.rectangle(826, y, 510, 60, won ? 0x123126 : 0x281b24, 0.94)
      .setStrokeStyle(1, won ? UI_FIELD.green : UI_FIELD.violet, 0.62)
      .setName('profile-folio-field-record-flight-row')
      .setData('runId', flight.id);
    scene.add.text(586, y - 18, won ? 'WIN' : 'LOSS', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: won ? '#b9ffdb' : '#ffb7c6',
    }).setResolution(2);
    const dateLabel = flight.completedAtMs > 0
      ? new Date(flight.completedAtMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : 'Earlier flight';
    scene.add.text(646, y - 18, `${dateLabel}  ·  ${flight.difficulty}`, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.warm,
      fixedWidth: 260,
    }).setResolution(2);
    scene.add.text(1080, y - 18, `${flight.turns} TURNS`, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.cyanText,
    }).setResolution(2).setOrigin(1, 0);
    const cohesionPercent = flight.maxCohesion > 0
      ? Math.round(flight.currentCohesion / flight.maxCohesion * 100)
      : 0;
    scene.add.text(586, y + 6, `Flight ${flight.seed}  ·  ${flight.currentCohesion}/${flight.maxCohesion} Cohesion (${cohesionPercent}%)`, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      color: UI_SOFT,
      fixedWidth: 450,
    }).setResolution(2);
  });
  if (field.record.recent.length === 0) {
    scene.add.text(826, 326, 'No completed flight matches this exact Folio yet.\n\nFinish a flight with the same leader, mode, card order,\nand Base/Preened states to start its record.', {
      fontFamily: UI_FONT,
      fontSize: '14px',
      color: UI_SOFT,
      align: 'center',
      fixedWidth: 460,
      wordWrap: { width: 460 },
      lineSpacing: 7,
    }).setResolution(2).setOrigin(0.5).setName('profile-folio-field-record-empty');
  }
  scene.add.text(826, 548, `${field.record.flights} exact flights retained from the latest 50 local records  ·  no effect on power`, {
    fontFamily: UI_FONT,
    fontSize: '9px',
    fontStyle: UI_BOLD,
    color: '#b9ffdb',
    fixedWidth: 500,
    align: 'center',
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-field-record-summary');

  const edit = dependencies.renderFieldButton(
    scene,
    () => {},
    824,
    626,
    250,
    MIN_SUPPORTED_TOUCH_TARGET,
    field.deck.notes ? 'Edit Private Notes' : 'Add Private Notes',
    !state.savedDeckNotesInput,
    () => beginSavedDeckNotes(scene, state, dependencies),
    UI_FIELD.gold,
    false,
  );
  edit.setName('profile-folio-field-record-edit-hit');
  const close = dependencies.renderFieldButton(
    scene,
    () => {},
    1060,
    626,
    150,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Back to Lab',
    !state.savedDeckNotesInput,
    () => closeSavedDeckFieldRecord(scene, state, dependencies),
    UI_FIELD.cyan,
    false,
  );
  close.setName('profile-folio-field-record-close-hit');
  if (state.savedDeckNotesInput) renderSavedDeckNotesPrompt(scene, field.deck);
}

function renderSavedDeckHistory(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  history: SavedDeckHistoryState,
  activeCount: number,
) {
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02050a, 0.9)
    .setInteractive()
    .setName('profile-folio-history-scrim');
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1040, 632, 0x07111c, 0.995)
    .setStrokeStyle(3, UI_FIELD.cyan, 0.92)
    .setName('profile-folio-history-frame');
  scene.add.text(154, 62, 'REVISION TRAIL', {
    fontFamily: 'Georgia, serif',
    fontSize: '29px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 4,
  }).setResolution(2).setName('profile-folio-history-title');
  scene.add.text(
    154,
    100,
    `${history.source.name}  ·  REV ${history.source.revision} CURRENT${history.source.archived ? '  ·  ARCHIVED' : ''}`,
    {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.cyanText,
      fixedWidth: 660,
    },
  ).setResolution(2).setName('profile-folio-history-source-name');
  const canRestore = activeCount < SAVED_DECK_LIMIT
    && Boolean(history.target)
    && history.comparison?.exactMatch === false;
  const capacityLabel = activeCount >= SAVED_DECK_LIMIT
    ? 'ARCHIVE AN ACTIVE FOLIO FIRST'
    : !history.target
      ? 'NO EARLIER REVISION'
      : history.comparison?.exactMatch
        ? 'NO DECK CHANGE TO RESTORE'
        : 'RESTORES AS A NEW REVISION';
  scene.add.rectangle(1000, 88, 252, 46, canRestore ? 0x143a30 : 0x3b241b, 0.96)
    .setStrokeStyle(2, canRestore ? UI_FIELD.green : UI_FIELD.gold, 0.92);
  scene.add.text(1000, 88, capacityLabel, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: canRestore ? '#b9ffdb' : '#ffd7a0',
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-history-capacity');

  scene.add.rectangle(320, 354, 340, 468, 0x0a1724, 0.96)
    .setStrokeStyle(1, UI_FIELD.violet, 0.58);
  scene.add.text(166, 138, 'LINEAGE REVISIONS', {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
  }).setResolution(2);
  scene.add.text(472, 140, `${history.targets.length} AVAILABLE`, {
    fontFamily: UI_FONT,
    fontSize: '8px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
  }).setResolution(2).setOrigin(1, 0);
  const visibleCount = 6;
  const visibleStart = Phaser.Math.Clamp(
    history.targetIndex - 2,
    0,
    Math.max(0, history.targets.length - visibleCount),
  );
  history.targets.slice(visibleStart, visibleStart + visibleCount).forEach((target, visibleIndex) => {
    const index = visibleStart + visibleIndex;
    const y = 190 + visibleIndex * 64;
    const selected = index === history.targetIndex;
    const comparison = compareSavedDeckRevisions(history.source, target);
    const hit = scene.add.rectangle(320, y, 308, 54, selected ? 0x17364a : 0x0d2231, 0.96)
      .setStrokeStyle(selected ? 3 : 1, selected ? UI_FIELD.green : UI_FIELD.violet, selected ? 0.96 : 0.42)
      .setInteractive({ useHandCursor: true })
      .setName('profile-folio-history-target-hit')
      .setData('deckId', target.id)
      .setData('index', index);
    hit.on('pointerdown', () => {
      state.savedDeckHistoryTargetIndex = index;
      state.savedDeckStatus = 'idle';
      dependencies.playUiSound('confirm');
      queueSavedDeckHistoryAssets(scene, state, dependencies);
      renderProfileScene(scene, state, dependencies);
    });
    scene.add.text(180, y - 18, `REV ${target.revision}${target.id === history.source.parentId ? '  ·  DIRECT PARENT' : ''}`, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: selected ? '#b9ffdb' : UI_FIELD.cyanText,
      fixedWidth: 240,
    }).setResolution(2);
    scene.add.text(180, y + 1, target.name, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.warm,
      fixedWidth: 190,
    }).setResolution(2);
    scene.add.text(460, y + 1, comparison.exactMatch
      ? 'SAME DECK'
      : `${comparison.cardChanges.length} CARD Δ${target.archived ? '  ·  ARCHIVE' : ''}`, {
      fontFamily: UI_FONT,
      fontSize: '8px',
      fontStyle: UI_BOLD,
      color: comparison.exactMatch ? UI_MUTED : UI_GOLD,
    }).setResolution(2).setOrigin(1, 0);
  });
  if (history.targets.length === 0) {
    scene.add.text(320, 330, 'This is the first preserved revision in its lineage.\nFork or tune it to begin a reversible trail.', {
      fontFamily: UI_FONT,
      fontSize: '14px',
      color: UI_SOFT,
      align: 'center',
      fixedWidth: 288,
      wordWrap: { width: 288 },
      lineSpacing: 8,
    }).setResolution(2).setOrigin(0.5).setName('profile-folio-history-empty');
  } else {
    scene.add.text(320, 554, `${history.targetIndex + 1} OF ${history.targets.length}  ·  UP / DOWN OR SHOULDERS`, {
      fontFamily: UI_FONT,
      fontSize: '8px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.cyanText,
    }).setResolution(2).setOrigin(0.5).setName('profile-folio-history-position');
  }

  scene.add.rectangle(830, 354, 620, 468, 0x091622, 0.96)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.52);
  scene.add.text(534, 138, 'CURRENT → SELECTED REVISION', {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
  }).setResolution(2);
  if (history.target && history.comparison) {
    const targetLeader = flockLeaders.find((leader) => leader.id === history.target?.leaderId)?.name
      ?? history.target.leaderId;
    scene.add.text(548, 168, `CURRENT  ·  REV ${history.source.revision}`, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: UI_MUTED,
    }).setResolution(2);
    scene.add.text(1118, 168, `RESTORE TARGET  ·  REV ${history.target.revision}${history.target.archived ? '  ·  ARCHIVED' : ''}`, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.cyanText,
    }).setResolution(2).setOrigin(1, 0);
    scene.add.text(548, 190, `${history.source.cards.length} cards  ·  ${history.source.runMode}  ·  ${flockLeaders.find((leader) => leader.id === history.source.leaderId)?.name ?? history.source.leaderId}`, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      color: UI_SOFT,
      fixedWidth: 270,
    }).setResolution(2);
    scene.add.text(1118, 190, `${history.target.cards.length} cards  ·  ${history.target.runMode}  ·  ${targetLeader}`, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      color: UI_SOFT,
      fixedWidth: 270,
      align: 'right',
    }).setResolution(2).setOrigin(1, 0);
    const metadataChanges = [
      history.comparison.leaderChanged
        ? `LEADER  ·  ${history.source.leaderId}  →  ${history.target.leaderId}`
        : '',
      history.comparison.runModeChanged
        ? `MODE  ·  ${history.source.runMode}  →  ${history.target.runMode}`
        : '',
    ].filter(Boolean);
    const visibleChanges = history.comparison.cardChanges.slice(0, Math.max(0, 5 - metadataChanges.length));
    const rows = [
      ...metadataChanges.map((label) => ({ kind: 'metadata' as const, label })),
      ...visibleChanges.map((change) => ({ kind: 'card' as const, change })),
    ];
    if (rows.length === 0) {
      scene.add.text(830, 346, 'These revisions have the same playable deck.\nNo new restore is needed.', {
        fontFamily: UI_FONT,
        fontSize: '16px',
        color: UI_SOFT,
        align: 'center',
        fixedWidth: 540,
        wordWrap: { width: 540 },
        lineSpacing: 8,
      }).setResolution(2).setOrigin(0.5).setName('profile-folio-history-exact');
    }
    rows.forEach((row, index) => {
      const y = 244 + index * 58;
      scene.add.rectangle(830, y, 584, 50, 0x0d2231, 0.92)
        .setStrokeStyle(1, row.kind === 'metadata' ? UI_FIELD.gold : UI_FIELD.violet, 0.5);
      if (row.kind === 'metadata') {
        scene.add.text(830, y, row.label, {
          fontFamily: UI_FONT,
          fontSize: '10px',
          fontStyle: UI_BOLD,
          color: UI_FIELD.warm,
          fixedWidth: 548,
          align: 'center',
        }).setResolution(2).setOrigin(0.5);
        return;
      }
      const change = row.change;
      const currentName = change.current
        ? alphaCardLibrary.get(change.current.id)?.displayName ?? change.current.id
        : 'Empty';
      const targetName = change.target
        ? alphaCardLibrary.get(change.target.id)?.displayName ?? change.target.id
        : 'Empty';
      const currentEntry = change.current ? dependencies.cardShowcaseEntry(change.current.id) : undefined;
      const targetEntry = change.target ? dependencies.cardShowcaseEntry(change.target.id) : undefined;
      if (currentEntry?.artKey && scene.textures.exists(currentEntry.artKey)) {
        scene.add.image(558, y, currentEntry.artKey)
          .setDisplaySize(30, 44)
          .setName('profile-folio-history-current-art')
          .setData('cardId', change.current?.id);
      }
      if (targetEntry?.artKey && scene.textures.exists(targetEntry.artKey)) {
        scene.add.image(852, y, targetEntry.artKey)
          .setDisplaySize(30, 44)
          .setName('profile-folio-history-target-art')
          .setData('cardId', change.target?.id);
      }
      scene.add.text(582, y - 13, `${currentName}${change.current?.upgraded ? '  ·  PREENED' : '  ·  BASE'}`, {
        fontFamily: UI_FONT,
        fontSize: '9px',
        fontStyle: UI_BOLD,
        color: UI_SOFT,
        fixedWidth: 218,
      }).setResolution(2);
      scene.add.text(828, y, '→', {
        fontFamily: UI_FONT,
        fontSize: '16px',
        fontStyle: UI_BOLD,
        color: UI_GOLD,
      }).setResolution(2).setOrigin(0.5);
      scene.add.text(876, y - 13, `${targetName}${change.target?.upgraded ? '  ·  PREENED' : '  ·  BASE'}`, {
        fontFamily: UI_FONT,
        fontSize: '9px',
        fontStyle: UI_BOLD,
        color: UI_FIELD.cyanText,
        fixedWidth: 218,
      }).setResolution(2);
      scene.add.text(582, y + 6, `CARD ${change.position}  ·  ${change.kind.toUpperCase()}`, {
        fontFamily: UI_FONT,
        fontSize: '8px',
        color: UI_MUTED,
      }).setResolution(2).setName('profile-folio-history-change');
    });
    const hiddenChanges = history.comparison.cardChanges.length - visibleChanges.length;
    const summary = history.comparison.exactMatch
      ? `${history.comparison.unchangedCards} cards unchanged  ·  source and target remain preserved`
      : `${history.comparison.cardChanges.length} card changes  ·  ${history.comparison.unchangedCards} unchanged${hiddenChanges > 0 ? `  ·  ${hiddenChanges} more in text review` : ''}`;
    scene.add.text(830, 548, summary, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: history.comparison.exactMatch ? UI_MUTED : '#b9ffdb',
      fixedWidth: 570,
      align: 'center',
    }).setResolution(2).setOrigin(0.5).setName('profile-folio-history-summary');
  } else {
    scene.add.text(830, 340, 'No prior revision is available to compare.\nThe current Folio remains unchanged.', {
      fontFamily: UI_FONT,
      fontSize: '16px',
      color: UI_SOFT,
      align: 'center',
      fixedWidth: 540,
      wordWrap: { width: 540 },
      lineSpacing: 8,
    }).setResolution(2).setOrigin(0.5);
  }

  const restore = dependencies.renderFieldButton(
    scene,
    () => {},
    828,
    626,
    260,
    MIN_SUPPORTED_TOUCH_TARGET,
    activeCount >= SAVED_DECK_LIMIT
      ? 'Active Folios Full'
      : history.comparison?.exactMatch
        ? 'Deck Already Matches'
        : 'Restore as New Revision',
    canRestore,
    () => restoreSelectedSavedDeckRevision(scene, state, dependencies),
    UI_FIELD.green,
    false,
  );
  restore.setName('profile-folio-history-restore-hit');
  const close = dependencies.renderFieldButton(
    scene,
    () => {},
    1060,
    626,
    150,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Back to Lab',
    true,
    () => closeSavedDeckHistory(scene, state, dependencies),
    UI_FIELD.cyan,
    false,
  );
  close.setName('profile-folio-history-close-hit');
}

function renderSavedDeckWorkshop(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  workshop: SavedDeckWorkshopState,
  activeCount: number,
) {
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02050a, 0.9)
    .setInteractive()
    .setName('profile-folio-workshop-scrim');
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1040, 632, 0x07111c, 0.995)
    .setStrokeStyle(3, UI_FIELD.green, 0.92)
    .setName('profile-folio-workshop-frame');
  scene.add.text(154, 62, 'TUNING BENCH', {
    fontFamily: 'Georgia, serif',
    fontSize: '29px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 4,
  }).setResolution(2).setName('profile-folio-workshop-title');
  scene.add.text(154, 100, `${workshop.deck.name}  ·  REV ${workshop.deck.revision} SOURCE`, {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
    fixedWidth: 650,
  }).setResolution(2).setName('profile-folio-workshop-deck-name');
  const canSave = activeCount < SAVED_DECK_LIMIT && workshop.suggestions.length > 0;
  const capacityLabel = activeCount >= SAVED_DECK_LIMIT
    ? 'ARCHIVE AN ACTIVE FOLIO FIRST'
    : 'SAVES AS A NEW REVISION';
  scene.add.rectangle(1000, 88, 252, 46, canSave ? 0x143a30 : 0x3b241b, 0.96)
    .setStrokeStyle(2, canSave ? UI_FIELD.green : UI_FIELD.gold, 0.92);
  scene.add.text(1000, 88, capacityLabel, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: canSave ? '#b9ffdb' : '#ffd7a0',
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-workshop-capacity');

  scene.add.rectangle(336, 354, 392, 468, 0x0a1724, 0.96)
    .setStrokeStyle(1, UI_FIELD.violet, 0.58);
  scene.add.text(158, 138, `CARD ${workshop.cardIndex + 1} OF ${workshop.deck.cards.length} TO REPLACE`, {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
  }).setResolution(2).setName('profile-folio-workshop-source-position');
  const sourceEntry = dependencies.cardShowcaseEntry(workshop.sourceCard.id);
  if (sourceEntry?.artKey && scene.textures.exists(sourceEntry.artKey)) {
    scene.textures.get(sourceEntry.artKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    scene.add.image(336, 310, sourceEntry.artKey)
      .setDisplaySize(176, 264)
      .setName('profile-folio-workshop-source-art')
      .setData('cardId', workshop.sourceCard.id);
  } else {
    scene.add.rectangle(336, 310, 176, 264, 0x111c28, 0.98)
      .setStrokeStyle(2, UI_FIELD.violet, 0.8);
    scene.add.text(336, 300, workshop.sourceName, {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.warm,
      align: 'center',
      fixedWidth: 150,
      wordWrap: { width: 150 },
    }).setResolution(2).setOrigin(0.5);
    if (!alphaCardLibrary.has(workshop.sourceCard.id)) {
      scene.add.text(336, 376, 'DEFINITION UNAVAILABLE\nSAFE TO REPLACE', {
        fontFamily: UI_FONT,
        fontSize: '9px',
        fontStyle: UI_BOLD,
        color: '#ffd7a0',
        align: 'center',
      }).setResolution(2).setOrigin(0.5).setName('profile-folio-workshop-source-unavailable');
    }
  }
  scene.add.text(336, 462, `${workshop.sourceName}${workshop.sourceCard.upgraded ? '  ·  PREENED' : '  ·  BASE'}`, {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
    align: 'center',
    fixedWidth: 330,
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-workshop-source-name');

  const previous = dependencies.renderFieldButton(
    scene,
    () => {},
    238,
    538,
    148,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Previous Card',
    workshop.deck.cards.length > 1,
    () => cycleSavedDeckWorkshopCard(scene, state, dependencies, -1),
    UI_FIELD.violet,
    false,
  );
  previous.setName('profile-folio-workshop-previous-hit');
  const next = dependencies.renderFieldButton(
    scene,
    () => {},
    434,
    538,
    148,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Next Card',
    workshop.deck.cards.length > 1,
    () => cycleSavedDeckWorkshopCard(scene, state, dependencies, 1),
    UI_FIELD.violet,
    false,
  );
  next.setName('profile-folio-workshop-next-hit');

  scene.add.rectangle(826, 354, 548, 468, 0x091622, 0.96)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.52);
  scene.add.text(566, 138, 'OWNED ROLE-SIMILAR REPLACEMENTS', {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
  }).setResolution(2);
  scene.add.text(1094, 140, 'UP / DOWN TO CHOOSE', {
    fontFamily: UI_FONT,
    fontSize: '8px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.cyanText,
  }).setResolution(2).setOrigin(1, 0);
  workshop.suggestions.forEach((candidate, index) => {
    const y = 190 + index * 68;
    const selected = index === state.savedDeckWorkshopSuggestionIndex;
    const hit = scene.add.rectangle(826, y, 510, 58, selected ? 0x17364a : 0x0d2231, 0.96)
      .setStrokeStyle(selected ? 3 : 1, selected ? UI_FIELD.green : UI_FIELD.violet, selected ? 0.96 : 0.42)
      .setInteractive({ useHandCursor: true })
      .setName('profile-folio-workshop-suggestion-hit')
      .setData('cardId', candidate.id)
      .setData('index', index);
    hit.on('pointerdown', () => {
      state.savedDeckWorkshopSuggestionIndex = index;
      dependencies.playUiSound('confirm');
      renderProfileScene(scene, state, dependencies);
    });
    const entry = dependencies.cardShowcaseEntry(candidate.id);
    if (entry?.artKey && scene.textures.exists(entry.artKey)) {
      scene.add.image(594, y, entry.artKey)
        .setDisplaySize(36, 52)
        .setName('profile-folio-workshop-suggestion-art')
        .setData('cardId', candidate.id);
    }
    scene.add.circle(630, y, 15, 0x08111b, 0.98).setStrokeStyle(2, UI_FIELD.gold, 0.9);
    scene.add.text(630, y, `${candidate.cost}`, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.warm,
    }).setResolution(2).setOrigin(0.5);
    scene.add.text(656, y - 19, candidate.name, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: selected ? '#b9ffdb' : UI_FIELD.warm,
      fixedWidth: 210,
    }).setResolution(2);
    scene.add.text(1080, y - 18, `${candidate.family.toUpperCase()}  ·  ${candidate.role.toUpperCase()}`, {
      fontFamily: UI_FONT,
      fontSize: '8px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.cyanText,
    }).setResolution(2).setOrigin(1, 0);
    scene.add.text(656, y + 3, candidate.reasons.join('  ·  '), {
      fontFamily: UI_FONT,
      fontSize: '9px',
      color: UI_SOFT,
      fixedWidth: 420,
    }).setResolution(2);
  });
  if (workshop.suggestions.length === 0) {
    scene.add.text(826, 326, 'No other permanently owned cards are valid for this slot.\nClaim more cards, then return to tune this Folio.', {
      fontFamily: UI_FONT,
      fontSize: '14px',
      color: UI_SOFT,
      align: 'center',
      fixedWidth: 460,
      wordWrap: { width: 460 },
      lineSpacing: 8,
    }).setResolution(2).setOrigin(0.5).setName('profile-folio-workshop-empty');
  }
  const selectedSuggestion = workshop.suggestions[state.savedDeckWorkshopSuggestionIndex];
  scene.add.text(826, 538, selectedSuggestion
    ? `${workshop.sourceName}  →  ${selectedSuggestion.name}  ·  source remains unchanged`
    : 'Source remains unchanged  ·  no revision can be created yet', {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: selectedSuggestion ? '#b9ffdb' : '#ffd7a0',
    align: 'center',
    fixedWidth: 500,
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-workshop-summary');

  const save = dependencies.renderFieldButton(
    scene,
    () => {},
    824,
    626,
    250,
    MIN_SUPPORTED_TOUCH_TARGET,
    activeCount >= SAVED_DECK_LIMIT ? 'Active Folios Full' : 'Save Tuned Revision',
    canSave,
    () => saveSavedDeckWorkshopRevision(scene, state, dependencies),
    UI_FIELD.green,
    false,
  );
  save.setName('profile-folio-workshop-save-hit');
  const close = dependencies.renderFieldButton(
    scene,
    () => {},
    1060,
    626,
    150,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Back to Lab',
    true,
    () => closeSavedDeckWorkshop(scene, state, dependencies),
    UI_FIELD.cyan,
    false,
  );
  close.setName('profile-folio-workshop-close-hit');
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
  activeCount: number,
  archivedCount: number,
) {
  const textInputOpen = Boolean(
    state.savedDeckRenameInput
    || state.savedDeckCodeInput
    || state.savedDeckTemplateOpen
    || state.savedDeckOrganizerOpen
    || state.savedDeckIdentityOpen
    || state.savedDeckDescriptionInput
    || state.savedDeckLabOpen
    || state.savedDeckFieldRecordOpen
    || state.savedDeckNotesInput
    || state.savedDeckHistoryOpen
    || state.savedDeckWorkshopOpen
  );
  const templateHit = dependencies.renderFieldButton(
    scene,
    () => {},
    x + 31,
    top + 253,
    58,
    MIN_SUPPORTED_TOUCH_TARGET,
    'New',
    !textInputOpen,
    () => openSavedDeckTemplate(scene, state, dependencies),
    UI_FIELD.green,
    false,
  );
  templateHit.setName('profile-folio-template-hit');
  const organizeHit = dependencies.renderFieldButton(
    scene,
    () => {},
    x + 101,
    top + 253,
    72,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Organize',
    allDecks.length > 0 && !textInputOpen,
    () => openSavedDeckOrganizer(scene, state, dependencies),
    UI_FIELD.gold,
    false,
  );
  organizeHit.setName('profile-folio-organize-hit');
  const libraryHit = dependencies.renderFieldButton(
    scene,
    () => {},
    x + 190,
    top + 253,
    94,
    MIN_SUPPORTED_TOUCH_TARGET,
    state.savedDeckArchiveView ? `Active ${activeCount}` : `Archive ${archivedCount}`,
    !textInputOpen,
    () => toggleSavedDeckArchiveView(scene, state, dependencies),
    UI_FIELD.violet,
    false,
  );
  libraryHit.setName('profile-folio-library-hit');
  const importHit = dependencies.renderFieldButton(
    scene,
    () => {},
    x + 271,
    top + 253,
    64,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Import',
    activeCount < SAVED_DECK_LIMIT && !textInputOpen,
    () => beginSavedDeckImport(scene, state, dependencies),
    UI_FIELD.cyan,
    false,
  );
  importHit.setName('profile-folio-import-hit');

  if (allDecks.length === 0) {
    scene.add.rectangle(x + 150, top + 376, 282, 174, 0x0b1420, 0.88)
      .setStrokeStyle(1, UI_FIELD.violet, 0.52)
      .setName('profile-folios-empty-frame');
    scene.add.text(
      x + 150,
      top + 376,
      state.savedDeckArchiveView
        ? `Archive is empty.\n\nArchive an active folio without deleting it.\nRestore when an active slot is open.\nV / controller Select returns to Active.`
        : `No active Folios yet.\n\nBuild one from an owned leader starter,\nsave a flight from Route Deck Review,\nor import a checksum-validated BSF${SAVED_DECK_CODE_VERSION} code.`,
      {
        fontFamily: UI_FONT,
        fontSize: '12px',
        color: UI_SOFT,
        align: 'center',
        lineSpacing: 5,
        wordWrap: { width: 244 },
      },
    ).setResolution(2).setOrigin(0.5).setName('profile-folios-empty');
    if (state.savedDeckStatus === 'restored' || state.savedDeckStatus === 'archived') {
      scene.add.text(x + 150, top + 486, state.savedDeckStatus === 'restored'
        ? 'FOLIO RESTORED TO ACTIVE'
        : 'FOLIO ARCHIVED WITHOUT DELETION', {
        fontFamily: UI_FONT,
        fontSize: '9px',
        fontStyle: UI_BOLD,
        color: UI_FIELD.cyanText,
      }).setResolution(2).setOrigin(0.5).setName('profile-folio-status');
    }
    return;
  }

  visibleDecks.forEach((deck, visibleIndex) => {
    const index = visibleStart + visibleIndex;
    const y = top + 314 + visibleIndex * 82;
    const selected = index === state.savedDeckIndex;
    const leader = flockLeaders.find((candidate) => candidate.id === deck.leaderId)?.name ?? deck.leaderId;
    const cardNames = deck.cards.slice(0, 3).map((saved) => (
      alphaCardSet.cards.find((card) => card.id === saved.id)?.displayName ?? saved.id
    ));
    const folderLabel = SAVED_DECK_FOLDERS.find((folder) => folder.id === (deck.folder ?? 'unfiled'))?.label
      ?? 'Open Shelf';
    const tagLabels = (deck.tags ?? []).map(
      (id) => SAVED_DECK_TAGS.find((tag) => tag.id === id)?.label ?? id,
    );
    const sleeve = SAVED_DECK_SLEEVES.find((candidate) => candidate.id === (deck.sleeve ?? 'field'))
      ?? SAVED_DECK_SLEEVES[0];
    const hit = scene.add.rectangle(x + 150, y, 300, 76, selected ? 0x183451 : 0x0d1420, 0.94)
      .setStrokeStyle(selected ? 3 : 1, selected ? UI_FIELD.cyan : deck.favorite ? UI_FIELD.gold : UI_FIELD.violet, selected ? 0.98 : 0.52)
      .setInteractive({ useHandCursor: true })
      .setName('profile-folio-row-hit')
      .setData('deckId', deck.id)
      .setData('index', index);
    hit.on('pointerdown', () => {
      state.focus = 'folios';
      selectSavedDeck(scene, state, dependencies, index);
    });
    scene.add.text(x + 20, y - 31, `${deck.favorite ? '★ ' : ''}${deck.name}`, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: deck.favorite ? UI_GOLD : UI_FIELD.warm,
      fixedWidth: 228,
    }).setResolution(2).setName('profile-folio-name').setData('deckId', deck.id);
    scene.add.rectangle(x + 274, y - 21, 24, 32, sleeve.primary, 1)
      .setStrokeStyle(2, sleeve.accent, 0.92)
      .setName('profile-folio-sleeve-preview')
      .setData('deckId', deck.id)
      .setData('sleeveId', sleeve.id);
    scene.add.line(x + 274, y - 21, -7, -10, 7, 10, sleeve.accent, 0.88).setLineWidth(2);
    scene.add.circle(x + 274, y - 21, 3, sleeve.ink, 0.96);
    scene.add.text(x + 20, y - 11, `${leader.toUpperCase()}  ·  ${deck.cards.length} CARDS  ·  ${deck.cards.filter((card) => card.upgraded).length} PREENED  ·  REV ${deck.revision}`, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.cyanText,
      fixedWidth: 260,
    }).setResolution(2);
    scene.add.text(
      x + 20,
      y + 10,
      deck.description
        ? `${folderLabel.toUpperCase()}  /  ${deck.description}`
        : deck.folder || tagLabels.length > 0
          ? `${folderLabel.toUpperCase()}${tagLabels.length > 0 ? `  ·  ${tagLabels.join(' / ')}` : ''}`
          : `${cardNames.join(', ')}${deck.cards.length > 3 ? ', …' : ''}`,
      {
        fontFamily: UI_FONT,
        fontSize: '9px',
        fontStyle: deck.description || deck.folder || tagLabels.length > 0 ? UI_BOLD : 'normal',
        color: deck.description || deck.folder || tagLabels.length > 0 ? '#b9ffdb' : UI_MUTED,
        fixedWidth: 260,
      },
    ).setResolution(2).setName('profile-folio-organization').setData('deckId', deck.id);
  });

  const selected = allDecks[state.savedDeckIndex];
  const status = state.savedDeckCodeInput
    ? `PASTE BSF${SAVED_DECK_CODE_VERSION} CODE  ·  ENTER IMPORT  ·  ESC CANCEL`
    : state.savedDeckRenameInput
      ? 'TYPE A NAME  ·  ENTER SAVE  ·  ESC CANCEL'
    : state.savedDeckStatus === 'templateCreated'
      ? 'STARTER FOLIO BUILT  /  OWNERSHIP + COLLECTION HISTORY UNCHANGED'
      : state.savedDeckStatus === 'templateUnavailable'
        ? 'STARTER FOLIO NOT BUILT  /  REQUIREMENTS SHOWN'
        : state.savedDeckStatus === 'organized'
      ? 'FOLDER + LABELS SAVED  ·  PRIVATE COLLECTION METADATA'
      : state.savedDeckStatus === 'personalized'
        ? 'COVER + CARD BACK SAVED  ·  PRIVATE COSMETIC IDENTITY'
        : state.savedDeckStatus === 'descriptionSaved'
          ? 'PRIVATE FOLIO DESCRIPTION SAVED'
      : state.savedDeckStatus === 'tagLimit'
        ? 'THREE-LABEL LIMIT  ·  REMOVE ONE BEFORE ADDING ANOTHER'
    : state.savedDeckStatus === 'favorited'
      ? 'FAVORITE SAVED'
      : state.savedDeckStatus === 'unfavorited'
        ? 'FAVORITE REMOVED'
        : state.savedDeckStatus === 'renamed'
          ? 'CUSTOM NAME SAVED'
          : state.savedDeckStatus === 'duplicated'
            ? 'FORK SAVED  ·  ORIGINAL REVISION KEPT'
            : state.savedDeckStatus === 'tuned'
              ? 'TUNED REVISION SAVED  ·  SOURCE FOLIO KEPT'
            : state.savedDeckStatus === 'revisionRestored'
              ? 'EARLIER DECK RESTORED AS NEW REVISION  ·  HISTORY KEPT'
            : state.savedDeckStatus === 'archived'
              ? 'ARCHIVED  ·  ORIGINAL IDENTITY + REVISION PRESERVED'
              : state.savedDeckStatus === 'restored'
                ? 'RESTORED TO ACTIVE  ·  ORIGINAL IDENTITY PRESERVED'
                : state.savedDeckStatus === 'archiveFull'
                  ? `ARCHIVE FULL  ·  ${SAVED_DECK_ARCHIVE_LIMIT} FOLIOS PRESERVED`
                  : state.savedDeckStatus === 'activeFull'
                    ? 'ACTIVE FOLIOS FULL  ·  ARCHIVE RECORD KEPT'
            : state.savedDeckStatus === 'full'
              ? 'FOLIOS FULL  ·  NO ORIGINAL WAS REPLACED'
              : state.savedDeckStatus === 'codeCopied'
                ? `BSF${SAVED_DECK_CODE_VERSION} CODE COPIED  ·  PRIVATE DATA EXCLUDED`
                : state.savedDeckStatus === 'copyFailed'
                  ? 'COPY FAILED  ·  FOLIO UNCHANGED'
                  : state.savedDeckStatus === 'imported'
                    ? 'SHARED FLIGHT IMPORTED AS A NEW LINE'
                    : state.savedDeckStatus === 'invalidCode'
                      ? 'CODE REJECTED  ·  CHECK VERSION + CHECKSUM'
          : state.savedDeckStatus === 'failed'
            ? 'SAVE FAILED  ·  ORIGINAL FOLIO KEPT'
            : 'IMMUTABLE REVISIONS  ·  FORK BEFORE EXPERIMENTING';
  scene.add.text(x + 150, top + 371, status, {
    fontFamily: UI_FONT,
    fontSize: '9px',
    fontStyle: UI_BOLD,
    color: [
      'failed',
      'copyFailed',
      'invalidCode',
      'full',
      'archiveFull',
      'activeFull',
      'tagLimit',
      'templateUnavailable',
    ].includes(state.savedDeckStatus) ? '#ffb09a' : UI_FIELD.cyanText,
    fixedWidth: 300,
    align: 'center',
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-status');

  const favorite = dependencies.renderFieldButton(
    scene,
    () => {},
    x + 48,
    top + 405,
    84,
    MIN_SUPPORTED_TOUCH_TARGET,
    selected?.favorite ? 'Unfavorite' : 'Favorite',
    Boolean(selected) && !textInputOpen,
    () => toggleSelectedSavedDeckFavorite(scene, state, dependencies),
    UI_FIELD.gold,
    false,
  );
  favorite.setName('profile-folio-favorite-hit');
  const rename = dependencies.renderFieldButton(
    scene,
    () => {},
    x + 150,
    top + 405,
    84,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Rename',
    Boolean(selected) && !textInputOpen,
    () => beginSavedDeckRename(scene, state, dependencies),
    UI_FIELD.violet,
    false,
  );
  rename.setName('profile-folio-rename-hit');
  const archive = dependencies.renderFieldButton(
    scene,
    () => {},
    x + 252,
    top + 405,
    84,
    MIN_SUPPORTED_TOUCH_TARGET,
    selected?.archived ? 'Restore' : 'Archive',
    Boolean(selected)
      && !textInputOpen
      && (selected?.archived ? activeCount < SAVED_DECK_LIMIT : archivedCount < SAVED_DECK_ARCHIVE_LIMIT),
    () => toggleSelectedSavedDeckArchived(scene, state, dependencies),
    selected?.archived ? UI_FIELD.green : UI_FIELD.gold,
    false,
  );
  archive.setName('profile-folio-archive-hit');
  const duplicate = dependencies.renderFieldButton(
    scene,
    () => {},
    x + 48,
    top + 455,
    84,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Fork Copy',
    Boolean(selected) && activeCount < SAVED_DECK_LIMIT && !textInputOpen,
    () => duplicateSelectedSavedDeck(scene, state, dependencies),
    UI_FIELD.cyan,
    false,
  );
  duplicate.setName('profile-folio-duplicate-hit');
  const copy = dependencies.renderFieldButton(
    scene,
    () => {},
    x + 150,
    top + 455,
    84,
    MIN_SUPPORTED_TOUCH_TARGET,
    `Copy BSF${SAVED_DECK_CODE_VERSION}`,
    Boolean(selected) && !textInputOpen,
    () => copySelectedSavedDeckCode(scene, state, dependencies),
    UI_FIELD.violet,
    false,
  );
  copy.setName('profile-folio-copy-code-hit');
  const lab = dependencies.renderFieldButton(
    scene,
    () => {},
    x + 252,
    top + 455,
    84,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Flight Lab',
    Boolean(selected) && !textInputOpen,
    () => openSavedDeckLab(scene, state, dependencies),
    UI_FIELD.violet,
    false,
  );
  lab.setName('profile-folio-lab-hit');
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

function renderSavedDeckTemplatePicker(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  options: ReturnType<typeof savedDeckTemplateOptions>,
) {
  const selectedIndex = Phaser.Math.Clamp(state.savedDeckTemplateIndex ?? 0, 0, options.length - 1);
  const selected = options[selectedIndex];
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020408, 0.9)
    .setInteractive()
    .setName('profile-folio-template-blocker');
  const panel = dependencies.renderFieldPanel(scene, () => {}, GAME_WIDTH / 2, 360, 960, 630, {
    accent: UI_FIELD.cyan,
    fill: UI_FIELD.ink,
  });
  dependencies.renderCloseControl(
    scene,
    () => {},
    panel.right - 42,
    panel.top + 38,
    () => closeSavedDeckTemplate(scene, state, dependencies),
  );
  scene.add.text(panel.left + 42, panel.top + 28, 'BUILD A STARTER FOLIO', {
    fontFamily: 'Georgia, serif',
    fontSize: '29px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 4,
  }).setResolution(2).setName('profile-folio-template-title');
  scene.add.text(
    panel.left + 44,
    panel.top + 72,
    'Turn a fully owned leader starter into a reversible Folio. This never grants cards or changes collection history.',
    {
      fontFamily: UI_FONT,
      fontSize: '12px',
      color: UI_SOFT,
      fixedWidth: 830,
      maxLines: 1,
    },
  ).setResolution(2).setName('profile-folio-template-subtitle');
  scene.add.text(
    panel.left + 44,
    panel.top + 98,
    `${controlBindingLabel('previous')} / ${controlBindingLabel('next')} / D-pad: Choose   ${controlBindingLabel('confirm')} / A: Build   ${controlBindingLabel('back')} / B: Cancel`,
    {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.cyanText,
    },
  ).setResolution(2).setName('profile-folio-template-input-hint');

  options.forEach((option, index) => {
    const y = panel.top + 148 + index * 78;
    const focused = index === selectedIndex;
    const accent = option.available ? UI_FIELD.green : option.unlocked ? UI_FIELD.gold : 0x667381;
    const hit = scene.add.rectangle(
      panel.cx,
      y,
      842,
      64,
      focused ? 0x173247 : 0x0b1420,
      0.97,
    )
      .setStrokeStyle(focused ? 3 : 1, focused ? UI_FIELD.cyan : accent, focused ? 0.98 : 0.55)
      .setInteractive({ useHandCursor: true })
      .setName('profile-folio-template-row')
      .setData('leaderId', option.leader.id)
      .setData('index', index)
      .setData('available', option.available)
      .setData('missing', option.missing);
    hit.on('pointerdown', () => {
      state.savedDeckTemplateIndex = index;
      state.savedDeckStatus = 'idle';
      dependencies.playUiSound('confirm');
      renderProfileScene(scene, state, dependencies);
    });
    scene.add.text(panel.left + 84, y - 22, option.leader.name, {
      fontFamily: UI_FONT,
      fontSize: '15px',
      fontStyle: UI_BOLD,
      color: option.unlocked ? UI_FIELD.warm : '#82909d',
      fixedWidth: 340,
    }).setResolution(2).setName('profile-folio-template-leader').setData('leaderId', option.leader.id);
    scene.add.text(panel.left + 84, y + 4, `${option.leader.bird}  /  ${option.leader.suit}`, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      color: option.unlocked ? UI_SOFT : '#697684',
      fixedWidth: 340,
    }).setResolution(2);
    scene.add.text(panel.cx + 130, y - 18, `${option.owned}/${option.leader.startingDeckIds.length} OWNED`, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: option.available ? '#b9ffdb' : '#ffd7a0',
      fixedWidth: 160,
      align: 'right',
    }).setResolution(2);
    scene.add.text(panel.right - 84, y + 5, option.reason.toUpperCase(), {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: option.available ? '#b9ffdb' : option.unlocked ? '#ffd7a0' : '#82909d',
      fixedWidth: 220,
      align: 'right',
      maxLines: 1,
    }).setResolution(2).setOrigin(1, 0);
  });

  const missingPreview = selected?.unlocked && selected.missingNames.length > 0
    ? `${selected.missingNames.slice(0, 3).join(', ')}${selected.missingNames.length > 3 ? `, +${selected.missingNames.length - 3} more` : ''}`
    : '';
  const message = state.savedDeckStatus === 'templateUnavailable'
    ? `${selected?.reason ?? 'Template unavailable'}${missingPreview ? `: ${missingPreview}` : ''}. No Folio or ownership data changed.`
    : selected?.available
      ? 'Creates a new Base-card Full Flight Folio. You can tune, rename, archive, or launch it afterward.'
      : missingPreview
        ? `${selected.reason}: ${missingPreview}.`
        : selected?.reason ?? 'Choose a leader template.';
  scene.add.text(panel.cx, panel.bottom - 82, message, {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: selected?.available ? UI_FIELD.cyanText : '#ffd7a0',
    fixedWidth: 660,
    align: 'center',
    wordWrap: { width: 660 },
    maxLines: 2,
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-template-detail');
  const build = dependencies.renderFieldButton(
    scene,
    () => {},
    panel.cx - 110,
    panel.bottom - 38,
    190,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Build Folio',
    Boolean(selected?.available),
    () => createSavedDeckFromTemplate(scene, state, dependencies),
    UI_FIELD.green,
    false,
  ).setName('profile-folio-template-build-hit');
  build
    .setData('leaderId', selected?.leader.id ?? null)
    .setData('available', selected?.available ?? false);
  dependencies.renderFieldButton(
    scene,
    () => {},
    panel.cx + 110,
    panel.bottom - 38,
    170,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Cancel',
    true,
    () => closeSavedDeckTemplate(scene, state, dependencies),
    UI_FIELD.gold,
    false,
  ).setName('profile-folio-template-cancel-hit');
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
