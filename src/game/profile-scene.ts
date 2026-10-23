import Phaser from 'phaser';
import { bindFolioEditor, disposeFolioEditor } from './folio-editor';
import { consumeSaveRecoveryGamepad } from './save-recovery-dialog';
import { writeJournaledJson } from './safe-storage';
import { startOwnedCopy } from './owned-copy';
function runCompletedAtMs(summary: ReturnType<typeof runtime.loadRunHistory>[number]) {
  const timestamp = /^run-(\d+)-/.exec(summary.id)?.[1];
  return timestamp ? finiteInt(Number(timestamp), 0, 0)
    + (/^run-\d+-flight-/.test(summary.id) ? summary.durationMs : 0) : 0;
}

function profileFlightHistory(): FlightHistoryEntry[] {
  return runtime.loadRunHistory().slice(-50).reverse().map((summary) => {
    const path = new Set(summary.path);
    if (summary.finalNodeId) path.add(summary.finalNodeId);
    return {
      id: summary.id,
      seed: summary.seed,
      result: summary.result,
      leaderId: summary.leaderId ?? defaultLeaderId,
      leader: runtime.getLeader(summary.leaderId).name,
      difficulty: difficultyLabel(summary.difficulty ?? 0),
      runMode: summary.runMode,
      completedAtMs: runCompletedAtMs(summary),
      durationMs: summary.durationMs,
      currentCohesion: summary.currentCohesion,
      maxCohesion: summary.maxCohesion,
      turns: summary.turnsTaken,
      deckSize: summary.deck.length,
      deck: summary.deck.map((card) => ({ id: card.id, upgraded: card.upgraded === true })),
      stops: path.size,
      waymarks: summary.routeMarks.length,
      supplies: summary.suppliesUsed.length,
    };
  });
}

async function loadProfileFlightReview(id: string): Promise<FlightHistoryReview | undefined> {
  const summary = runtime.loadRunHistory().find((entry) => entry.id === id);
  if (!summary) return undefined;
  const module = await runtime.loadBossDossierModule();
  const date = runCompletedAtMs(summary);
  const dateLabel = date > 0 ? new Date(date).toLocaleDateString() : 'Earlier flight';
  return {
    id: summary.id,
    seed: summary.seed,
    runMode: summary.runMode,
    subtitle: `${summary.result === 'win' ? 'Completed' : 'Scattered'} ${dateLabel} · ${runtime.getLeader(summary.leaderId).name} · ${difficultyLabel(summary.difficulty ?? 0)} · Flight ${summary.seed}`,
    details: runtime.buildOutcomeFlightDetailsFor(summary, module),
  };
}

function latestPlaytestRunForRating(): LatestPlaytestRun | undefined {
  const latest = runtime.loadRunHistory().at(-1);
  if (!latest || (latest.result !== 'win' && latest.result !== 'loss')) return undefined;
  return {
    id: latest.id,
    result: latest.result,
    feedback: runtime.sanitizedPlaytestFeedback(latest.experienceFeedback),
  };
}

function saveLatestPlaytestFeedback(feedback: PlaytestExperienceFeedback): boolean {
  const history = runtime.loadRunHistory();
  const latest = history.at(-1);
  if (!latest) return false;
  const ratings: PlaytestExperienceFeedback = {
    fun: runtime.playtestRating(feedback.fun),
    fairness: runtime.playtestRating(feedback.fairness),
    clarity: runtime.playtestRating(feedback.clarity),
    replay: runtime.playtestRating(feedback.replay),
    updatedAt: new Date().toISOString(),
  };
  const updated: ReturnType<typeof runtime.loadRunHistory>[number] = { ...latest, experienceFeedback: ratings };
  const next = [...history.slice(0, -1), updated].slice(-50);
  if (!writeJournaledJson(runtime.RUN_HISTORY_KEY, next)) return false;
  if (window.__birdSquadLastRun?.id === updated.id) window.__birdSquadLastRun = updated;
  return true;
}
import { renderProfileDashboard } from './profile-dashboard';
import { quietButton } from './quiet-ui';
import { fitTextExcerpt } from './text-excerpt';
import { beginPracticeSession, endPracticeSession } from './practice-session';
import * as runtime from '../main';
import { MIN_SUPPORTED_TOUCH_TARGET, UI_FONT, UI_BOLD, UI_GOLD, UI_MUTED, UI_SOFT, UI_FIELD, UI_TYPE } from './theme';
import { alphaCardLibrary, alphaCardSet } from './runtime-data';
import { difficultyLabel } from './difficulty';
import { defaultLeaderId, flockLeaders } from './leaders';
import { finiteInt } from './deterministic-draw';
import { achievements, isLeaderUnlocked, leaderMastery, leaderUnlockHints, loadAccount, saveAccount, type PlayerAccount } from './meta';
import { bindControlActions, controlBindingLabel, controlActionForCode } from './input-bindings';
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
const UI_ICON_PREVIEW_SCALE = 2.2;
const FLIGHT_LOG_PAGE_SIZE = 7;
const BADGE_PAGE_SIZE = 3;
const SAVED_DECK_PAGE_SIZE = 1;

const profileUiIconIds = [
  'record-medallion',
] as const;

type ProfileBadgeView = 'leaders' | 'achievements' | 'contracts' | 'showcase' | 'folios';
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
  | 'leaders'
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
  /** Stable action names, keyed by reader, survive redraws and nested editors. */
  folioActions?: Record<string, string>;
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
  saveFileCancel?: () => void;
  saveDataStatus: 'idle' | 'downloaded' | 'invalid' | 'restoreReady' | 'restoreFailed' | 'restored';
  saveDataMessage: string;
  pendingRestore?: SaveRestorePreview;
  flightLogOpen: boolean;
  flightLogIndex: number;
  flightReviewLoading: boolean;
  flightReviewRequestedId?: string;
  flightReviewCancel?: () => void;
  flightReview?: FlightHistoryReview;
  flightReviewAction: 0 | 1;
  flightCopyStatus: 'idle' | 'copying' | 'copied' | 'failed';
  copyOperation?: ReturnType<typeof startOwnedCopy>;
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
    | 'copying'
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
  savedDeckLabToolsOpen?: boolean;
  savedDeckLabStudyOpen?: boolean;
  savedDeckLabSample: number;
  savedDeckLabHandPage: number;
  savedDeckCollectionSignalsOpen: boolean;
  savedDeckSignalsSection?: number;
  savedDeckCollectionSignalsDeckId?: string;
  savedDeckFieldRecordOpen: boolean;
  savedDeckFieldRecordDeckId?: string;
  savedDeckNotesInput?: HTMLTextAreaElement;
  savedDeckHistoryOpen: boolean;
  savedDeckHistoryDeckId?: string;
  savedDeckHistoryTargetIndex: number;
  savedDeckHistoryChangePage?: number;
  savedDeckWorkshopOpen: boolean;
  savedDeckWorkshopDeckId?: string;
  savedDeckWorkshopCardIndex: number;
  savedDeckWorkshopSuggestionIndex: number;
}

export interface ProfileSceneDependencies {
  advanceGameTime: (game: Phaser.Game, ms: number) => void;
  syncSceneAnimationPace: (scene: Phaser.Scene) => void;
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

function initialProfileViewState(): ProfileViewState {
  return {
    badgeView: 'achievements',
    badgePage: 0,
    entryFadePlayed: false,
    revealBursts: 0,
    playtestExportStatus: 'idle',
    playtestFeedbackStatus: 'idle',
    playtestFeedback: {},
    saveDataOpen: false,
    saveDataStatus: 'idle',
    saveDataMessage: '',
    focus: 'achievements',
    flightLogOpen: false,
    flightLogIndex: 0,
    flightReviewLoading: false,
    flightReviewAction: 0,
    flightCopyStatus: 'idle',
    flightLogMessage: '',
    savedDeckIndex: 0,
    savedDeckArchiveView: false,
    savedDeckStatus: 'idle',
    savedDeckOrganizerOpen: false,
    savedDeckOrganizerSection: 'folder',
    savedDeckOrganizerIndex: 0,
    savedDeckIdentityOpen: false,
    savedDeckIdentitySection: 'cover',
    savedDeckIdentityIndex: 0,
    savedDeckLabOpen: false,
    savedDeckLabSample: 0,
    savedDeckLabHandPage: 0,
    savedDeckCollectionSignalsOpen: false,
    savedDeckFieldRecordOpen: false,
    savedDeckHistoryOpen: false,
    savedDeckHistoryTargetIndex: 0,
    savedDeckWorkshopOpen: false,
    savedDeckWorkshopCardIndex: 0,
    savedDeckWorkshopSuggestionIndex: 0,
  };
}

export function createProfileSceneClass(dependencies: ProfileSceneDependencies): new () => Phaser.Scene {
  return class ProfileScene extends Phaser.Scene {
    private readonly profileViewState = initialProfileViewState();
    private openSaveDataOnCreate = false;

    constructor() {
      super('ProfileScene');
    }

    get badgeView() {
      return this.profileViewState.badgeView;
    }

    set badgeView(value: ProfileViewState['badgeView']) {
      this.profileViewState.badgeView = value;
      this.profileViewState.badgePage = 0;
    }

    init(data: { openSaveData?: boolean } = {}) {
      this.openSaveDataOnCreate = playtestExportEnabled() && data.openSaveData === true;
    }

    get profileRecordRevealBursts() {
      return this.profileViewState.revealBursts;
    }

    create() {
      dependencies.syncSceneAnimationPace(this);
      const openSaveData = this.openSaveDataOnCreate;
      this.openSaveDataOnCreate = false;
      this.profileViewState.savedDeckRenameInput?.remove();
      this.profileViewState.savedDeckCodeInput?.remove();
      this.profileViewState.savedDeckDescriptionInput?.remove();
      this.profileViewState.savedDeckNotesInput?.remove();
      Object.keys(this.profileViewState).forEach((key) => {
        delete (this.profileViewState as unknown as Record<string, unknown>)[key];
      });
      Object.assign(this.profileViewState, initialProfileViewState(), {
        saveDataOpen: openSaveData,
        focus: openSaveData ? 'playtestFun' : 'achievements',
      });
      startProfileScene(this, this.profileViewState, dependencies);
    }

    renderPremiumProfileScene() {
      renderProfileScene(this, this.profileViewState, dependencies);
    }
  };
}

export function createRuntimeProfileSceneClass(): new () => Phaser.Scene {
  const dependencies: ProfileSceneDependencies = {
    advanceGameTime: runtime.advanceGameTime,
    syncSceneAnimationPace: runtime.syncSceneAnimationPace,
    hasActiveRun: runtime.hasActiveRun,
    run: runtime.createInitialRunState,
    audio: runtime.birdAudio,
    districtContracts: runtime.DISTRICT_CONTRACT_DEFINITIONS,
    exportRunHistory: () => JSON.stringify(runtime.loadRunHistory()),
    flightHistory: profileFlightHistory,
    loadFlightReview: loadProfileFlightReview,
    latestPlaytestRun: latestPlaytestRunForRating,
    saveLatestPlaytestFeedback,
    saveData: {
      currentActiveRun: runtime.loadActiveRun,
      currentRunHistory: runtime.loadRunHistory,
      currentPreferences: () => {
        const audio = runtime.birdAudio.snapshot();
        return {
          controls: runtime.controlBindingsSnapshot(),
          graphicsQuality: runtime.graphicsQualityState().preference,
          visualContrast: runtime.visualContrastState().preference,
          colorCues: runtime.colorCuePreference(),
          screenShake: runtime.screenShakePreference(),
          flashEffects: runtime.flashEffectsPreference(),
          motion: runtime.motionPreference(),
          combatPace: runtime.combatPacePreference(),
          animationPace: runtime.animationPacePreference(),
          textPace: runtime.textPacePreference(),
          screenReader: runtime.screenReaderPreference(),
          musicVolume: audio.musicVolume,
          sfxVolume: audio.sfxVolume,
          voiceVolume: audio.voiceVolume,
          ambienceVolume: audio.ambienceVolume,
          audioMuted: runtime.birdAudio.isMuted(),
          maxTier: runtime.getMaxUnlockedTier(),
        };
      },
      sanitizeActiveRun: runtime.sanitizeActiveRun,
      sanitizeRunHistory: runtime.sanitizeRunHistory,
    },
    killTweensForScene: runtime.killTweensForScene,
    playUiSound: runtime.playUiSound,
    prefersReducedMotion: runtime.prefersReducedMotion,
    activateAudioToggleControl: runtime.activateRenderedAudioToggleControl,
    queueUiIconAssets: (scene, ids, warning, onComplete) => {
      runtime.queueUiIconAssets(scene, ids as runtime.UiIconId[], warning, onComplete);
    },
    cardShowcaseEntry: (id) => {
      const card = runtime.cardLibrary[id];
      if (!card) return undefined;
      return {
        id,
        name: runtime.displayName(card),
        family: runtime.cardLabel(card),
        rarity: card.runtime.rarity.toUpperCase(),
        artKey: runtime.cardCompactArtAsset(card)?.key,
      };
    },
    queueCardShowcaseAssets: (scene, ids, onComplete) => {
      const assets = runtime.uniqueImageAssets(ids.flatMap((id) => {
        const card = runtime.cardLibrary[id];
        const asset = card ? runtime.cardCompactArtAsset(card) : undefined;
        return asset ? [asset] : [];
      }));
      if (!assets.length) {
        onComplete?.();
        return;
      }
      runtime.queueRuntimeImageAssets(scene, assets, 'Profile showcase art', onComplete);
    },
    renderAudioToggleControl: runtime.renderAudioToggleControl,
    renderCloseControl: runtime.renderCloseControl,
    // Profile-only legacy adapter stays behind the Profile download boundary.
    renderFieldButton: (owner, add, x, y, width, _height, label, enabled, onClick,
      accent = UI_FIELD.gold, sound = 'confirm') => {
      const hit = quietButton(owner, { x, y, width, label, enabled, name: 'system-field-button-hit',
        kind: accent === UI_FIELD.danger ? 'destructive' : 'secondary',
        onActivate: () => { if (sound) runtime.playUiSound(sound); onClick(); } });
      add(hit); add(hit.getData('labelObject'));
      return hit.setData('label', label);
    },
    renderFieldPanel: runtime.renderFieldPanel,
  };
  return createProfileSceneClass(dependencies);
}

let runtimeProfileSceneRegistered = false;
export function registerRuntimeProfileScene(game: Phaser.Game) {
  if (runtimeProfileSceneRegistered) return;
  game.scene.add('ProfileScene', createRuntimeProfileSceneClass(), false);
  runtimeProfileSceneRegistered = true;
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
  if (!state.saveDataOpen) return ['leaders', 'achievements', 'contracts', 'showcase', 'folios', 'flightLog', 'return', 'saveData'];
  if (state.pendingRestore) return ['restoreConfirm', 'restoreCancel'];
  const order: ProfileFocus[] = ['saveDownload', 'saveRestore'];
  if (playtestExportEnabled()) {
    if (state.playtestRunId) order.push('playtestFun', 'playtestFairness', 'playtestClarity', 'playtestReplay');
    order.push('playtestExport');
  }
  return order;
}

function profileBadgePageCount(state: ProfileViewState) {
  if (state.badgeView === 'showcase' || state.badgeView === 'leaders') return 1;
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
  (state.folioActions ??= {})['profile-folio'] = 'profile-folio-template-hit';
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
  (state.folioActions ??= {})['profile-folio-template'] = 'profile-folio-template-build-hit';
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
  (state.folioActions ??= {})['profile-folio'] = 'profile-folio-organize-hit';
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
  (state.folioActions ??= {})['profile-folio-organizer'] = state.savedDeckOrganizerSection === 'folder'
    ? `profile-folio-organizer-folder-hit:${SAVED_DECK_FOLDERS[state.savedDeckOrganizerIndex].id}`
    : `profile-folio-organizer-tag-hit:${SAVED_DECK_TAGS[state.savedDeckOrganizerIndex].id}`;
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
  (state.folioActions ??= {})['profile-folio-organizer'] = state.savedDeckOrganizerSection === 'folder'
    ? `profile-folio-organizer-folder-hit:${SAVED_DECK_FOLDERS[state.savedDeckOrganizerIndex].id}`
    : `profile-folio-organizer-tag-hit:${SAVED_DECK_TAGS[state.savedDeckOrganizerIndex].id}`;
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
  (state.folioActions ??= {})['profile-folio-organizer'] = 'profile-folio-organizer-identity-hit';
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
  disposeFolioEditor(state.savedDeckDescriptionInput);
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
  (state.folioActions ??= {})['profile-folio-identity'] = state.savedDeckIdentitySection === 'cover'
    ? 'profile-folio-identity-cover-hit'
    : `profile-folio-identity-sleeve-hit:${SAVED_DECK_SLEEVES[state.savedDeckIdentityIndex].id}`;
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
  (state.folioActions ??= {})['profile-folio-identity'] = state.savedDeckIdentitySection === 'cover'
    ? 'profile-folio-identity-cover-hit'
    : `profile-folio-identity-sleeve-hit:${SAVED_DECK_SLEEVES[state.savedDeckIdentityIndex].id}`;
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
  (state.folioActions ??= {})['profile-folio-identity'] = 'profile-folio-identity-description-hit';
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);

  bindFolioEditor(scene, input, {
    ownsInput: () => state.savedDeckDescriptionInput === input,
    redraw: () => renderProfileScene(scene, state, dependencies),
    commit: () => {
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
        return 'Could not save the description.';
      }
    },
    close: committed => {
      if (!committed) { state.savedDeckStatus = 'idle'; dependencies.playUiSound('close'); }
      closeSavedDeckDescription(state);
    },
  });
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
  (state.folioActions ??= {})['profile-folio'] = 'profile-folio-lab-hit';
  state.savedDeckLabHandPage = 0;
  state.savedDeckLabToolsOpen = false;
  state.savedDeckLabStudyOpen = false;
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
  state.savedDeckLabHandPage = 0;
  state.savedDeckLabToolsOpen = false;
  state.savedDeckLabStudyOpen = false;
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function cycleSavedDeckLabHandPage(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies, direction: -1 | 1) {
  const deck = selectedSavedDeck(state);
  if (!state.savedDeckLabOpen || !deck) return;
  const count = analyzeSavedDeck(deck, alphaCardLibrary, state.savedDeckLabSample).sample.cards.length;
  const next = Phaser.Math.Clamp(state.savedDeckLabHandPage + direction, 0, Math.max(0, Math.ceil(count / 5) - 1));
  if (next === state.savedDeckLabHandPage && !state.savedDeckLabToolsOpen && !state.savedDeckLabStudyOpen) return;
  state.savedDeckLabHandPage = next;
  state.savedDeckLabToolsOpen = false;
  state.savedDeckLabStudyOpen = false;
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
  practice = false,
): SavedDeckLaunchState {
  const owned = new Set(Object.entries(account.cardCollection)
    .filter(([, record]) => record.timesClaimed > 0)
    .map(([id]) => id));
  const missingOwnedIds = [...new Set(deck.cards.map((card) => card.id))]
    .filter((id) => !owned.has(id));
  if (!practice && dependencies.hasActiveRun()) {
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
  practice = false,
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
    practice,
  );
  if (!launch.available) {
    dependencies.playUiSound('locked');
    renderProfileScene(scene, state, dependencies);
    return;
  }
  dependencies.playUiSound('confirm');
  if (practice && !beginPracticeSession(deck.cards)) return;
  try {
    scene.scene.start('RouteScene', {
      runState: dependencies.run(deck.leaderId, 0, deck.runMode, undefined, deck.cards),
    });
  } catch (error) {
    if (practice) endPracticeSession();
    throw error;
  }
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
  rememberLabOpener(state, 'collection-signals');
  state.savedDeckLabOpen = false;
  state.savedDeckCollectionSignalsOpen = true;
  state.savedDeckSignalsSection = 0;
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
  disposeFolioEditor(state.savedDeckNotesInput);
  state.savedDeckNotesInput = undefined;
  document.getElementById('folio-notes-error')?.remove();
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
  rememberLabOpener(state, 'field-record');
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
    top: '50%',
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
  (state.folioActions ??= {})['profile-folio-field-record'] = 'profile-folio-field-record-edit-hit';
  state.savedDeckNotesInput = input;
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);

  bindFolioEditor(scene, input, {
    ownsInput: () => state.savedDeckNotesInput === input,
    redraw: () => renderProfileScene(scene, state, dependencies),
    commit: () => {
      const account = loadAccount();
      account.decks = updateSavedDeckNotes(sanitizeSavedDecks(account.decks), field.deck.id, input.value);
      if (!saveAccount(account)) {
        state.savedDeckStatus = 'failed';
        dependencies.playUiSound('locked');
        return 'Could not save the notes.';
      }
      state.savedDeckStatus = 'notesSaved';
      dependencies.playUiSound('confirm');
    },
    close: committed => {
      if (!committed) { state.savedDeckStatus = 'idle'; dependencies.playUiSound('close'); }
      closeSavedDeckNotes(state);
    },
  });
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
  rememberLabOpener(state, 'history');
  state.savedDeckLabOpen = false;
  state.savedDeckHistoryOpen = true;
  state.savedDeckHistoryDeckId = selected.id;
  state.savedDeckHistoryTargetIndex = 0;
  state.savedDeckHistoryChangePage = 0;
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
  state.savedDeckHistoryChangePage = 0;
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
  rememberLabOpener(state, 'tune');
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
  if (state.copyOperation) return;
  const selected = selectedSavedDeck(state);
  if (!selected) {
    dependencies.playUiSound('locked');
    return;
  }
  const code = savedDeckShareCode(selected);
  state.savedDeckStatus = 'copying';
  state.copyOperation = startOwnedCopy(scene, {
    // Moving keyboard focus outside the shelf does not close the visible Folio.
    isCurrent: () => folioActionScope({...state, focus: 'folios'}) === 'profile-folio'
      && selectedSavedDeck(state)?.id === selected.id && state.savedDeckStatus === 'copying',
    write: async () => {
      if (!navigator.clipboard) return false;
      await navigator.clipboard.writeText(code); return true;
    },
    complete: copied => {
      state.copyOperation = undefined;
      state.savedDeckStatus = copied ? 'codeCopied' : 'copyFailed';
      dependencies.playUiSound(copied ? 'confirm' : 'locked');
      renderProfileScene(scene, state, dependencies);
    },
    canceled: () => {
      state.copyOperation = undefined;
      if (state.savedDeckStatus === 'copying') state.savedDeckStatus = 'idle';
    },
  });
  renderProfileScene(scene, state, dependencies);
}

function closeSavedDeckRename(state: ProfileViewState) {
  disposeFolioEditor(state.savedDeckRenameInput);
  state.savedDeckRenameInput = undefined;
}

function closeSavedDeckImport(state: ProfileViewState) {
  disposeFolioEditor(state.savedDeckCodeInput);
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
  if (state.savedDeckOrganizerOpen) (state.folioActions ??= {})['profile-folio-organizer'] = 'profile-folio-organizer-rename-hit';
  else (state.folioActions ??= {})['profile-folio'] = 'profile-folio-rename-hit';
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);

  bindFolioEditor(scene, input, {
    ownsInput: () => state.savedDeckRenameInput === input,
    redraw: () => renderProfileScene(scene, state, dependencies),
    commit: () => {
      const account = loadAccount();
      const decks = sanitizeSavedDecks(account.decks);
      account.decks = renameSavedDeck(decks, selected.id, input.value);
      if (saveAccount(account)) {
        state.savedDeckStatus = 'renamed';
        dependencies.playUiSound('confirm');
      } else {
        state.savedDeckStatus = 'failed';
        dependencies.playUiSound('locked');
        return 'Could not save the name.';
      }
    },
    close: committed => {
      if (!committed) { state.savedDeckStatus = 'idle'; dependencies.playUiSound('close'); }
      closeSavedDeckRename(state);
    },
  });
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
  (state.folioActions ??= {})['profile-folio'] = 'profile-folio-import-hit';
  state.savedDeckStatus = 'idle';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);

  bindFolioEditor(scene, input, {
    ownsInput: () => state.savedDeckCodeInput === input,
    redraw: () => renderProfileScene(scene, state, dependencies),
    commit: () => {
      const result = importSavedDeckCode(input.value);
      const account = loadAccount();
      const current = sanitizeSavedDecks(account.decks);
      if (!result.ok) {
        state.savedDeckStatus = 'invalidCode';
        dependencies.playUiSound('locked');
        return 'Invalid code. Check the version and checksum.';
      } else if (activeSavedDecks(current).length >= SAVED_DECK_LIMIT) {
        state.savedDeckStatus = 'full';
        dependencies.playUiSound('locked');
        return 'Active Folios are full. Cancel and archive a Folio to make room.';
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
          return 'Could not save the imported Folio.';
        }
      }
    },
    close: committed => {
      if (!committed) { state.savedDeckStatus = 'idle'; dependencies.playUiSound('close'); }
      closeSavedDeckImport(state);
    },
  });
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
  if (state.saveDataOpen) {
    const hit = folioActionControls(scene, state).find(hit => hit.getData('profileFocus') === state.focus);
    if (hit) (state.folioActions ??= {})['profile-save-data'] = hit.name;
  }
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function folioActionScope(state: ProfileViewState): string | undefined {
  if (state.saveDataOpen) return 'profile-save-data';
  if (state.flightLogOpen) return state.flightReview ? undefined : 'profile-flight-log';
  if (state.savedDeckNotesInput || state.savedDeckRenameInput || state.savedDeckDescriptionInput || state.savedDeckCodeInput) return;
  if (state.savedDeckTemplateOpen) return 'profile-folio-template';
  if (state.savedDeckIdentityOpen) return 'profile-folio-identity';
  if (state.savedDeckOrganizerOpen) return 'profile-folio-organizer';
  if (state.savedDeckFieldRecordOpen) return 'profile-folio-field-record';
  if (state.savedDeckCollectionSignalsOpen) return 'profile-collection-signals';
  if (state.savedDeckHistoryOpen) return 'profile-folio-history';
  if (state.savedDeckWorkshopOpen) return 'profile-folio-workshop';
  if (state.savedDeckLabOpen) return 'profile-flight-lab';
  if (state.badgeView === 'folios' && state.focus === 'folios' && !state.saveDataOpen && !state.flightLogOpen && !state.flightReview) return 'profile-folio';
}

function rememberLabOpener(state: ProfileViewState, action: string) {
  // Shortcut entry must expose the same opener on return as pointer entry.
  state.savedDeckLabToolsOpen = true;
  state.savedDeckLabStudyOpen = false;
  (state.folioActions ??= {})['profile-flight-lab'] = `profile-flight-lab-${action}-hit`;
}

function folioActionControls(scene: Phaser.Scene, state: ProfileViewState) {
  const scope = folioActionScope(state);
  const objects = scope === 'profile-save-data' ? scene.children.list.slice(
    scene.children.list.findIndex(object => object.name === 'profile-save-data-blocker') + 1) : scene.children.list;
  return scope ? objects.filter((object): object is Phaser.GameObjects.Rectangle =>
    object instanceof Phaser.GameObjects.Rectangle && (object.name.startsWith(`${scope}-`)
      || scope === 'profile-flight-log' && object.name === 'profile-history-review'
      || scope === 'profile-save-data' && /^(profile-save-|profile-playtest-)/.test(object.name))
    && object.getData('controlKind') !== undefined && object.active && object.visible) : [];
}

function folioActionId(hit: Phaser.GameObjects.Rectangle) {
  const key = ['section', 'folderId', 'tagId', 'sleeveId', ...(hit.name.endsWith('-row') ? ['leaderId'] : [])]
    .find(key => hit.getData(key) != null);
  return key ? `${hit.name}:${hit.getData(key)}` : hit.name;
}

function folioChoiceControl(hit: Phaser.GameObjects.Rectangle, label: string, enabled = true) {
  hit.setData('controlKind', 'secondary').setData('fullLabel', label).setData('enabled', enabled);
  const paint = () => hit.setStrokeStyle(hit.getData('focused') ? 3 : 1,
    hit.getData('focused') ? UI_FIELD.gold : hit.getData('selected') ? UI_FIELD.green : UI_FIELD.cyan,
    hit.getData('focused') || hit.getData('hovered') ? 1 : 0.5);
  hit.on('changedata', paint);
  hit.on('pointerover', () => hit.setData('hovered', true));
  hit.on('pointerout', () => hit.setData('hovered', false));
  paint();
  return hit;
}

function cycleFolioAction(scene: Phaser.Scene, state: ProfileViewState, direction: -1 | 1) {
  const scope = folioActionScope(state);
  const controls = folioActionControls(scene, state);
  if (!scope || !controls.length) return false;
  const memory = state.folioActions ??= {};
  const index = controls.findIndex(hit => folioActionId(hit) === memory[scope]);
  // The Folio shelf is not a modal: Tab must still reach the surrounding Flock navigation.
  if (scope === 'profile-folio' && index >= 0 && (index + direction < 0 || index + direction >= controls.length)) {
    delete memory[scope];
    return false;
  }
  const next = index < 0 ? direction < 0 ? controls.length - 1 : 0 : (index + direction + controls.length) % controls.length;
  memory[scope] = folioActionId(controls[next]);
  controls.forEach(hit => hit.setData('focused', folioActionId(hit) === memory[scope]));
  return true;
}

function activateFolioAction(scene: Phaser.Scene, state: ProfileViewState) {
  const scope = folioActionScope(state);
  const name = scope && state.folioActions?.[scope];
  const hit = name && folioActionControls(scene, state).find(control => folioActionId(control) === name);
  if (!hit) return false;
  // Disabled actions remain discoverable but cannot execute.
  if (hit.input?.enabled && hit.getData('enabled') !== false) hit.emit('pointerdown');
  return true;
}

function wireFolioActionFocus(scene: Phaser.Scene, state: ProfileViewState) {
  const scope = folioActionScope(state);
  if (!scope) return;
  const memory = state.folioActions ??= {};
  const controls = folioActionControls(scene, state);
  if (memory[scope] && !controls.some(hit => folioActionId(hit) === memory[scope])) delete memory[scope];
  if (scope === 'profile-save-data' && !memory[scope]) memory[scope] = state.pendingRestore
    ? 'profile-save-restore-cancel-hit'
    : controls.find(hit => hit.getData('profileFocus') === state.focus)?.name ?? 'profile-save-download-hit';
  for (const object of scene.children.list) {
    if (object instanceof Phaser.GameObjects.Rectangle && object.getData('controlKind') !== undefined
      && !controls.includes(object)) object.setData('focused', false);
  }
  for (const hit of controls) {
    hit.setData('focused', memory[scope] === folioActionId(hit));
    const listeners = hit.listeners('pointerdown');
    hit.removeAllListeners('pointerdown');
    hit.on('pointerdown', (...args: unknown[]) => {
      if (!hit.active || !hit.input?.enabled || folioActionScope(state) !== scope) return;
      memory[scope] = folioActionId(hit);
      if (hit.getData('profileFocus')) state.focus = hit.getData('profileFocus');
      controls.forEach(control => control.setData('focused', control === hit));
      listeners.forEach(listener => listener.apply(hit, args));
    });
  }
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
  (state.folioActions ??= {})['profile-flight-log'] = 'profile-history-review';
  state.focus = 'flightLog';
  dependencies.playUiSound('confirm');
  renderProfileScene(scene, state, dependencies);
}

function closeFlightLog(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  state.flightReviewCancel?.();
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
    state.flightReviewCancel?.();
    state.flightLogIndex = (state.flightLogIndex + direction + history.length) % history.length;
    (state.folioActions ??= {})['profile-flight-log'] = `profile-flight-log-row-${state.flightLogIndex}`;
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
  state.flightReviewCancel?.();
  state.flightLogIndex = Math.min(nextPage * FLIGHT_LOG_PAGE_SIZE + row, history.length - 1);
  (state.folioActions ??= {})['profile-flight-log'] = `profile-flight-log-row-${state.flightLogIndex}`;
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
  // Each attempt owns its lifetime, even when the same record is reopened.
  // Wall-clock timeout still works while the scene is paused by recovery UI.
  const cancel = () => {
    window.clearTimeout(timer);
    scene.events.off('shutdown', cancel);
    if (state.flightReviewCancel !== cancel) return;
    state.flightReviewCancel = undefined;
    state.flightReviewLoading = false;
    state.flightReviewRequestedId = undefined;
  };
  const finish = (review?: FlightHistoryReview, timedOut = false) => {
    if (state.flightReviewCancel !== cancel) return;
    cancel();
    if (!scene.scene.isActive() || !state.flightLogOpen) return;
    if (review) {
      state.flightReview = review;
      state.flightReviewAction = 0;
      state.flightLogMessage = '';
    } else {
      state.flightLogMessage = timedOut ? 'Review timed out. Retry or go back.' : 'Review unavailable. Retry or go back.';
    }
    renderProfileScene(scene, state, dependencies);
  };
  const timer = window.setTimeout(() => finish(undefined, true), 8000);
  state.flightReviewCancel = cancel;
  scene.events.once('shutdown', cancel);
  void Promise.resolve().then(() => dependencies.loadFlightReview(selected.id)).then(review => finish(review), () => finish());
}

function copyReviewedFlight(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  const review = state.flightReview;
  if (!review || state.copyOperation) return;
  state.flightCopyStatus = 'copying';
  state.copyOperation = startOwnedCopy(scene, {
    isCurrent: () => state.flightLogOpen && state.flightReview === review && state.flightCopyStatus === 'copying',
    write: () => copySharedRouteLink(review.seed, review.runMode),
    complete: copied => {
      state.copyOperation = undefined;
      state.flightCopyStatus = copied ? 'copied' : 'failed';
      dependencies.playUiSound(copied ? 'confirm' : 'locked');
      renderProfileScene(scene, state, dependencies);
    },
    canceled: () => {
      state.copyOperation = undefined;
      if (state.flightCopyStatus === 'copying') state.flightCopyStatus = 'idle';
    },
  });
  renderProfileScene(scene, state, dependencies);
}

function openSaveData(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  if (playtestExportEnabled()) syncLatestPlaytestRun(state, dependencies);
  state.saveDataOpen = true;
  state.pendingRestore = undefined;
  state.saveDataStatus = 'idle';
  state.saveDataMessage = '';
  state.focus = 'saveDownload';
  (state.folioActions ??= {})['profile-save-data'] = 'profile-save-download-hit';
  renderProfileScene(scene, state, dependencies);
}

function closeSaveData(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  state.saveFileCancel?.();
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
  (state.folioActions ??= {})['profile-save-data'] = 'profile-save-download-hit';
  renderProfileScene(scene, state, dependencies);
}

function selectSaveToRestore(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies) {
  if (state.saveFileCancel || !state.saveDataOpen) return;
  const controller = new AbortController();
  const cancel = () => {
    controller.abort();
    scene.events.off('shutdown', cancel);
    if (state.saveFileCancel === cancel) state.saveFileCancel = undefined;
  };
  state.saveFileCancel = cancel;
  state.focus = 'saveRestore';
  scene.events.once('shutdown', cancel);
  // Request synchronously while the browser still has user activation.
  const request = requestSaveBackupFile(controller.signal);
  renderProfileScene(scene, state, dependencies);
  void request.then((raw) => {
    if (state.saveFileCancel !== cancel) return;
    cancel();
    if (!state.saveDataOpen || !scene.scene.isActive()) return;
    if (raw === undefined) { renderProfileScene(scene, state, dependencies); return; }
    if (typeof raw !== 'string') {
      state.saveDataStatus = 'restoreFailed';
      state.saveDataMessage = raw.error;
      state.pendingRestore = undefined;
      state.focus = 'saveRestore';
      (state.folioActions ??= {})['profile-save-data'] = 'profile-save-restore-file-hit';
      renderProfileScene(scene, state, dependencies);
      return;
    }
    const result = parseSaveBackup(raw, dependencies.saveData);
    if (!result.ok) {
      state.saveDataStatus = 'invalid';
      state.saveDataMessage = result.error;
      state.pendingRestore = undefined;
      state.focus = 'saveRestore';
      (state.folioActions ??= {})['profile-save-data'] = 'profile-save-restore-file-hit';
    } else {
      state.saveDataStatus = 'restoreReady';
      state.saveDataMessage = 'Review this backup before restoring it.';
      state.pendingRestore = result.preview;
      state.focus = 'restoreCancel';
      (state.folioActions ??= {})['profile-save-data'] = 'profile-save-restore-cancel-hit';
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
  (state.folioActions ??= {})['profile-save-data'] = 'profile-save-restore-file-hit';
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
  if (state.focus === 'leaders' || state.focus === 'achievements' || state.focus === 'contracts' || state.focus === 'showcase' || state.focus === 'folios') {
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
      if (state.pendingRestore) { cancelSaveRestore(scene, state, dependencies); return; }
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
    back: event => { if (!event?.repeat) returnToMenu(); },
    previous: () => state.savedDeckTemplateOpen
      ? cycleSavedDeckTemplate(scene, state, dependencies, -1)
      : state.savedDeckIdentityOpen
      ? cycleSavedDeckIdentityChoice(scene, state, dependencies, -1)
      : state.savedDeckOrganizerOpen
      ? cycleSavedDeckOrganizerChoice(scene, state, dependencies, -1)
      : state.savedDeckCollectionSignalsOpen
      ? cycleSavedDeckSignalsSection(scene, state, dependencies, -1)
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
      ? cycleSavedDeckSignalsSection(scene, state, dependencies, 1)
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
    confirm: event => {
      if (event?.repeat) return;
      if (activateFolioAction(scene, state)) return;
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
    if (event.repeat) return;
    if (cycleFolioAction(scene, state, event.shiftKey ? -1 : 1)) return;
    if (state.savedDeckTemplateOpen) cycleSavedDeckTemplate(scene, state, dependencies, event.shiftKey ? -1 : 1);
    else if (state.savedDeckIdentityOpen) switchSavedDeckIdentitySection(scene, state, dependencies);
    else if (state.savedDeckOrganizerOpen) switchSavedDeckOrganizerSection(scene, state, dependencies);
    else if (state.savedDeckCollectionSignalsOpen) cycleSavedDeckSignalsSection(scene, state, dependencies, event.shiftKey ? -1 : 1);
    else if (state.savedDeckFieldRecordOpen) dependencies.playUiSound('locked');
    else if (state.savedDeckHistoryOpen) cycleSavedDeckHistoryTarget(scene, state, dependencies, event.shiftKey ? -1 : 1);
    else if (state.savedDeckWorkshopOpen) cycleSavedDeckWorkshopSuggestion(scene, state, dependencies, event.shiftKey ? -1 : 1);
    else if (state.savedDeckLabOpen) cycleSavedDeckLabView(scene, state, dependencies, event.shiftKey ? -1 : 1);
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
    else if (state.savedDeckCollectionSignalsOpen) cycleSavedDeckSignalsSection(scene, state, dependencies, -1);
    else if (state.savedDeckFieldRecordOpen) dependencies.playUiSound('locked');
    else if (state.savedDeckHistoryOpen) cycleSavedDeckHistoryChange(scene, state, dependencies, -1);
    else if (state.savedDeckWorkshopOpen) cycleSavedDeckWorkshopCard(scene, state, dependencies, -1);
    else if (state.savedDeckLabOpen) cycleSavedDeckLabHandPage(scene, state, dependencies, -1);
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
    else if (state.savedDeckCollectionSignalsOpen) cycleSavedDeckSignalsSection(scene, state, dependencies, 1);
    else if (state.savedDeckFieldRecordOpen) dependencies.playUiSound('locked');
    else if (state.savedDeckHistoryOpen) cycleSavedDeckHistoryChange(scene, state, dependencies, 1);
    else if (state.savedDeckWorkshopOpen) cycleSavedDeckWorkshopCard(scene, state, dependencies, 1);
    else if (state.savedDeckLabOpen) cycleSavedDeckLabHandPage(scene, state, dependencies, 1);
    else if (state.flightLogOpen) pageFlightHistory(scene, state, dependencies, 1);
    else cycleBadgePage(scene, state, dependencies, 1);
  };
  const onGamepadDown = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
    if (consumeSaveRecoveryGamepad(button.index)) return;
    if (state.savedDeckNotesInput || state.savedDeckRenameInput || state.savedDeckDescriptionInput || state.savedDeckCodeInput) {
      // The editor owns Confirm/Back and navigation while its draft is open.
      const input = state.savedDeckNotesInput ?? state.savedDeckRenameInput ?? state.savedDeckDescriptionInput ?? state.savedDeckCodeInput;
      const focused = document.getElementById('folio-editor-actions')?.contains(document.activeElement) ? document.activeElement : input;
      if ([0, 1, 12, 13, 14, 15].includes(button.index)) focused?.dispatchEvent(new KeyboardEvent('keydown', {
        key: button.index === 0 ? 'Enter' : button.index === 1 ? 'Escape' : 'Tab',
        shiftKey: button.index === 12 || button.index === 14, bubbles: true,
      }));
      return;
    }
    if (folioActionScope(state)) {
      if ((button.index === 14 || button.index === 15) && cycleFolioAction(scene, state, button.index === 14 ? -1 : 1)) return;
      if (button.index === 0 && activateFolioAction(scene, state)) return;
    }
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
      } else if ([12, 14, 4].includes(button.index)) cycleSavedDeckSignalsSection(scene, state, dependencies, -1);
      else if ([13, 15, 5].includes(button.index)) cycleSavedDeckSignalsSection(scene, state, dependencies, 1);
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
      } else if (button.index === 6 || button.index === 7) cycleSavedDeckHistoryChange(scene, state, dependencies, button.index === 6 ? -1 : 1);
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
      if (button.index === 12) {
        cycleSavedDeckLabHandPage(scene, state, dependencies, -1);
      } else if (button.index === 13) {
        cycleSavedDeckLabHandPage(scene, state, dependencies, 1);
      } else if (button.index === 14 || button.index === 4) {
        cycleSavedDeckLabSample(scene, state, dependencies, -1);
      } else if (button.index === 15 || button.index === 5 || button.index === 0) {
        cycleSavedDeckLabSample(scene, state, dependencies, 1);
      } else if (button.index === 9) {
        launchSelectedSavedDeck(scene, state, dependencies);
      } else if (button.index === 8) {
        launchSelectedSavedDeck(scene, state, dependencies, true);
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
      } else if (button.index === 6 || button.index === 7) cycleSavedDeckLabView(scene, state, dependencies, button.index === 6 ? -1 : 1);
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
  const onSavedDeckPractice = (event: KeyboardEvent) => {
    if (!state.savedDeckLabOpen || event.repeat) return;
    event.preventDefault();
    event.stopPropagation();
    launchSelectedSavedDeck(scene, state, dependencies, true);
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
  const shortcutBindings: Array<{ event: string; listener: (event: KeyboardEvent) => void }> = [];
  const bindFolioShortcut = (event: string, action: (event: KeyboardEvent) => void) => {
    const listener = (key: KeyboardEvent) => {
      if (key.repeat || ['back', 'previous', 'next', 'confirm', 'mute', 'fullscreen'].includes(controlActionForCode(key.code) ?? '')) return;
      action(key);
    };
    shortcutBindings.push({ event, listener });
    scene.input.keyboard?.on(event, listener);
  };
  bindFolioShortcut('keydown-K', onSavedDeckTemplate);
  bindFolioShortcut('keydown-C', onSavedDeckFavorite);
  bindFolioShortcut('keydown-R', onSavedDeckRename);
  bindFolioShortcut('keydown-D', onSavedDeckDuplicate);
  bindFolioShortcut('keydown-E', onSavedDeckCopy);
  bindFolioShortcut('keydown-I', onSavedDeckImport);
  bindFolioShortcut('keydown-L', onSavedDeckLab);
  bindFolioShortcut('keydown-O', onSavedDeckOrganizer);
  bindFolioShortcut('keydown-P', onSavedDeckIdentity);
  bindFolioShortcut('keydown-V', onSavedDeckArchiveView);
  bindFolioShortcut('keydown-A', onSavedDeckArchive);
  bindFolioShortcut('keydown-SPACE', onSavedDeckLabDeal);
  bindFolioShortcut('keydown-S', onSavedDeckLaunch);
  bindFolioShortcut('keydown-U', onSavedDeckPractice);
  bindFolioShortcut('keydown-G', onSavedDeckCollectionSignals);
  bindFolioShortcut('keydown-T', onSavedDeckWorkshop);
  bindFolioShortcut('keydown-R', onSavedDeckHistory);
  bindFolioShortcut('keydown-N', onSavedDeckFieldRecord);
  bindFolioShortcut('keydown-E', onSavedDeckNotes);
  bindFolioShortcut('keydown-E', onSavedDeckDescription);
  bindFolioShortcut('keydown-UP', onSavedDeckWorkshopSuggestionUp);
  bindFolioShortcut('keydown-DOWN', onSavedDeckWorkshopSuggestionDown);
  scene.input.gamepad?.on('down', onGamepadDown);
  scene.events.once('shutdown', () => {
    closeSavedDeckRename(state);
    closeSavedDeckImport(state);
    closeSavedDeckNotes(state);
    closeSavedDeckDescription(state);
    scene.input.keyboard?.off('keydown-TAB', onTab);
    for (const { event, listener } of shortcutBindings) scene.input.keyboard?.off(event, listener);
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
    scene.input.keyboard?.off('keydown-U', onSavedDeckPractice);
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
  if (state.copyOperation && !state.copyOperation.isCurrent()) state.copyOperation.cancel();
  dependencies.killTweensForScene(scene);
  // DisplayList.removeAll(true) skips removal callbacks; it does not destroy
  // objects. Retire the actual owners so readers release their input listeners.
  for (const child of [...scene.children.list]) child.destroy();
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
  if (savedDeckLab) state.savedDeckLabHandPage = Phaser.Math.Clamp(state.savedDeckLabHandPage, 0, Math.max(0, Math.ceil(savedDeckLab.sample.cards.length / 5) - 1));
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
    folioFocus: {
      scope: folioActionScope(state) ?? null,
      action: state.folioActions?.[folioActionScope(state) ?? ''] ?? null,
      label: folioActionControls(scene, state).find(hit => hit.getData('focused'))?.getData('fullLabel') ?? null,
    },
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
          section: 'controller LB or RB / pointer',
          focusAction: 'Tab / Shift+Tab / controller left or right',
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
          section: 'controller LB or RB',
          focusAction: 'Tab / Shift+Tab / controller left or right',
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
        section: state.savedDeckLabToolsOpen ? 'tools' : state.savedDeckLabStudyOpen ? 'study' : 'hand',
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
          page: state.savedDeckLabHandPage + 1,
          pages: Math.max(1, Math.ceil(savedDeckLab.sample.cards.length / 5)),
          visibleCardIds: savedDeckLab.sample.cards.slice(state.savedDeckLabHandPage * 5, state.savedDeckLabHandPage * 5 + 5).map((card) => card.id),
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
        practice: savedDeckLaunchState(savedDecks[state.savedDeckIndex], savedDeckLab, account, dependencies, true),
        inputs: {
          previous: `${controlBindingLabel('previous')} / D-pad Left / LB`,
          views: 'LT / RT / pointer; Tab then Confirm selects a view button',
          actions: 'Tab / Shift+Tab / D-pad Left / Right; Confirm / A activates',
          handPages: 'Page Up / Page Down / D-pad Up / D-pad Down / pointer',
          dealAgain: `${controlBindingLabel('next')} / ${controlBindingLabel('confirm')} / Space / A`,
          collectionSignals: 'G / controller R3 / pointer',
          fieldRecord: 'N / controller L3 / pointer',
          revisionTrail: 'R / controller Y / pointer',
          tune: 'T / controller X / pointer',
          launch: 'S / controller Start / pointer',
          practice: 'U / controller Select / pointer; nothing saved; Menu or reload ends practice',
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
        section: collectionSignalSections(savedDeckCollectionSignals)[state.savedDeckSignalsSection ?? 0]?.id ?? 'unused',
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
          section: `${controlBindingLabel('previous')} / ${controlBindingLabel('next')} / LB / RB / pointer`,
          actions: 'Tab / Shift+Tab / D-pad Left / Right; Confirm / A activates',
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
        changePage: savedDeckHistoryRows(savedDeckHistory).length ? (state.savedDeckHistoryChangePage ?? 0) + 1 : 0,
        changeCount: savedDeckHistoryRows(savedDeckHistory).length,
        currentChange: savedDeckHistoryRows(savedDeckHistory)[state.savedDeckHistoryChangePage ?? 0] ?? null,
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
          changes: 'Page Up / Page Down / LT / RT / pointer',
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

  renderProfileDashboard(scene, {
    tab: state.badgeView, focus: state.focus,
    stats: [
      { label: 'Flights', value: `${account.runs}` },
      { label: 'Victories', value: `${account.wins}` },
      { label: 'Win rate', value: `${winRate}%` },
      { label: 'Ascension', value: account.bestWinTier >= 0 ? account.bestWinTier === 0 ? 'Standard' : `Tier ${account.bestWinTier}` : 'Not yet cleared' },
      { label: 'Fastest victory', value: account.fastestWinTurns === null ? 'No record yet' : `${account.fastestWinTurns} beats` },
    ],
    progress: [
      { label: 'Leaders', value: leaderCount, total: flockLeaders.length },
      { label: 'Achievements', value: earned.length, total: allAchievementBadges.length },
      { label: 'Cards discovered', value: discovered, total: cardTotal },
    ],
    leaders: flockLeaders.map(leader => {
      const unlocked = isLeaderUnlocked(account, leader.id);
      const mastery = leaderMastery(account, leader.id);
      const personal = leaderPersonalRecord(account, leader.id);
      return { id: leader.id, name: leader.name, unlocked,
        status: unlocked ? `${mastery.title} ${mastery.current}/${mastery.target}` : 'Locked',
        detail: unlocked
          ? personal.bestFullWinTier >= 0
            ? `Best: Tier ${personal.bestFullWinTier} · Full ${personal.fastestFullWinTurns ?? '—'} beats · Quick ${personal.fastestQuickWinTurns ?? '—'} beats`
            : `${leader.suit} · No victory recorded yet`
          : `${leader.suit} · ${leaderUnlockHints[leader.id] ?? 'Locked'}`,
      };
    }),
    badges: visibleBadges,
    counts: { leaders: leaderCount, achievements: earned.length, contracts: account.contractBadges.length,
      showcase: showcaseEntries.length, folios: savedDecks.length },
    page: state.badgePage, pageCount: badgePageCount, historyCount: flightHistory.length,
    onTab: tab => {
      state.focus = tab; state.badgeView = tab; state.badgePage = 0;
      dependencies.playUiSound('confirm'); renderProfileScene(scene, state, dependencies);
    },
    onPage: delta => cycleBadgePage(scene, state, dependencies, delta),
    onHistory: () => openFlightLog(scene, state, dependencies),
    onBack: () => scene.scene.start('MenuScene'),
    onSave: () => openSaveData(scene, state, dependencies),
  });
  if (state.badgeView === 'showcase') renderCardShowcase(scene, 416, 42, showcaseEntries);
  if (state.badgeView === 'folios') renderSavedFlightFolios(scene, state, dependencies, 416, 42,
    savedDecks, visibleSavedDecks, savedDeckVisibleStart, activeDecks.length, archivedDecks.length);
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
  wireFolioActionFocus(scene, state);
}

function folioReaderText(scene: Phaser.Scene, x: number, y: number, value: string,
  width: number, size: number = UI_TYPE.primary, color = UI_FIELD.text) {
  return scene.add.text(x, y, value, { fontFamily: UI_FONT, fontSize: size, color,
    resolution: UI_TYPE.resolution, wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 3 });
}

function folioReaderShell(scene: Phaser.Scene, kind: string, title: string, deck: SavedDeckRecord, hint?: string) {
  scene.add.rectangle(640, 360, 1280, 720, 0x02050a, 0.94).setInteractive().setName(`profile-folio-${kind}-scrim`);
  scene.add.rectangle(640, 360, 1160, 656, UI_FIELD.panel, 1)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.5).setName(`profile-folio-${kind}-frame`);
  folioReaderText(scene, 92, 58, title, 1096, 32, UI_FIELD.warm).setName(`profile-folio-${kind}-title`);
  const name = folioReaderText(scene, 92, 102, `${deck.name} · Revision ${deck.revision}`, 1096);
  name.setName(`profile-folio-${kind}-deck-name`);
  fitTextExcerpt(name, name.text, 1);
  folioReaderText(scene, 92, 136, 'Private · Included in backups, excluded from share codes · No gameplay power',
    1096, UI_TYPE.secondary, UI_SOFT).setName(`profile-folio-${kind}-private`);
  folioReaderText(scene, 92, 661,
    hint ?? `Tab / D-pad left/right: focus · ${controlBindingLabel('previous')} / ${controlBindingLabel('next')}: browse · ${controlBindingLabel('confirm')} / A: activate · ${controlBindingLabel('back')} / B: back`,
    1096, UI_TYPE.secondary, UI_SOFT).setName('profile-folio-reader-hint');
}

function folioEditorCurtain(scene: Phaser.Scene, title: string) {
  scene.add.rectangle(640, 360, 1280, 720, 0x02050a, 0.94).setInteractive().setName('profile-folio-editor-scrim');
  scene.add.rectangle(640, 360, 920, document.getElementById('folio-editor-error') ? 450 : 330, UI_FIELD.panel, 1).setStrokeStyle(1, UI_FIELD.cyan, 0.6);
  folioReaderText(scene, 640, 252, title, 824, UI_TYPE.title, UI_FIELD.warm).setOrigin(0.5, 0);
}

function renderSavedDeckOrganizer(
  scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies, deck: SavedDeckRecord,
) {
  folioReaderShell(scene, 'organizer', 'Folio Organizer', deck);
  const folderActive = state.savedDeckOrganizerSection === 'folder';
  const enabled = !state.savedDeckRenameInput;
  folioReaderText(scene, 92, 170, 'Collection folder', 400, UI_TYPE.primary,
    folderActive ? UI_FIELD.warm : UI_SOFT);
  folioReaderText(scene, 526, 170, `Strategy labels · ${(deck.tags ?? []).length}/${SAVED_DECK_TAG_LIMIT}`, 640,
    UI_TYPE.primary, !folderActive ? UI_FIELD.warm : UI_SOFT);
  const choice = (x: number, y: number, width: number, label: string, description: string,
    assigned: boolean, focused: boolean, name: string, activate: () => void) => {
    const hit = scene.add.rectangle(x, y, width, 82, assigned ? 0x143a30 : 0x0b151f, 1)
      .setStrokeStyle(focused ? 3 : 1, focused ? UI_FIELD.gold : assigned ? UI_FIELD.green : UI_FIELD.cyan, focused ? 1 : 0.5)
      .setName(name).setData('selected', assigned).setData('focused', focused);
    if (enabled) hit.setInteractive({ useHandCursor: true }).on('pointerdown', activate);
    folioReaderText(scene, x - width / 2 + 14, y - 35, `${assigned ? 'Set · ' : ''}${label}`, width - 28,
      UI_TYPE.primary, assigned ? '#b9ffdb' : UI_FIELD.text).setName(name.replace('-hit', '-label'));
    folioReaderText(scene, x - width / 2 + 14, y - 7, description, width - 28, UI_TYPE.secondary, UI_SOFT);
    return folioChoiceControl(hit, label, enabled);
  };
  SAVED_DECK_FOLDERS.forEach((folder, index) => {
    choice(292, 236 + index * 90, 400, folder.label, folder.description, folder.id === (deck.folder ?? 'unfiled'),
      folderActive && state.savedDeckOrganizerIndex === index, 'profile-folio-organizer-folder-hit', () => {
        state.savedDeckOrganizerSection = 'folder'; state.savedDeckOrganizerIndex = index;
        applySavedDeckOrganizerChoice(scene, state, dependencies);
      }).setData('folderId', folder.id).setData('index', index);
  });
  SAVED_DECK_TAGS.forEach((tag, index) => {
    choice(678 + (index % 2) * 322, 236 + Math.floor(index / 2) * 90, 304, tag.label, tag.description,
      deck.tags?.includes(tag.id) ?? false, !folderActive && state.savedDeckOrganizerIndex === index,
      'profile-folio-organizer-tag-hit', () => {
        state.savedDeckOrganizerSection = 'tags'; state.savedDeckOrganizerIndex = index;
        applySavedDeckOrganizerChoice(scene, state, dependencies);
      }).setData('tagId', tag.id).setData('index', index);
  });
  const status = state.savedDeckStatus === 'failed' ? 'Could not save. Your existing Folio is unchanged; try again.'
    : state.savedDeckStatus === 'tagLimit' ? 'Three-label limit: remove a label before adding another.'
    : state.savedDeckStatus === 'organized' ? 'Organization saved.'
    : state.savedDeckStatus === 'renamed' ? 'Folio renamed.' : 'Choose a folder or toggle up to three strategy labels.';
  folioReaderText(scene, 92, 564, status, 1096, UI_TYPE.secondary,
    ['tagLimit', 'failed'].includes(state.savedDeckStatus) ? '#ffb8ad' : UI_SOFT).setName('profile-folio-organizer-status');
  quietButton(scene, { x: 250, y: 622, width: 300, label: 'Folio Identity', name: 'profile-folio-organizer-identity-hit',
    enabled, onActivate: () => openSavedDeckIdentity(scene, state, dependencies) });
  quietButton(scene, { x: 610, y: 622, width: 300, label: 'Rename Folio', name: 'profile-folio-organizer-rename-hit',
    enabled, onActivate: () => beginSavedDeckRename(scene, state, dependencies) });
  quietButton(scene, { x: 1020, y: 622, width: 300, label: 'Back to Folios', name: 'profile-folio-organizer-close-hit',
    enabled, onActivate: () => closeSavedDeckOrganizer(scene, state, dependencies) });
  if (!enabled) folioEditorCurtain(scene, 'Rename Folio');
}

function renderSavedDeckIdentity(
  scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies, deck: SavedDeckRecord,
) {
  folioReaderShell(scene, 'identity', 'Folio Identity', deck);
  const enabled = !state.savedDeckDescriptionInput;
  const choices = savedDeckCoverChoices(deck), coverActive = state.savedDeckIdentitySection === 'cover';
  const selectedId = coverActive ? choices[state.savedDeckIdentityIndex] ?? choices[0] : deck.coverCardId ?? choices[0];
  const assignedId = deck.coverCardId ?? choices[0];
  const selected = selectedId ? dependencies.cardShowcaseEntry(selectedId) : undefined;
  folioReaderText(scene, 92, 170, `Cover card · ${Math.max(1, choices.indexOf(selectedId) + 1)}/${choices.length}`,
    490, UI_TYPE.primary, coverActive ? UI_FIELD.warm : UI_SOFT);
  folioReaderText(scene, 618, 170, 'Card-back sleeve', 560, UI_TYPE.primary, !coverActive ? UI_FIELD.warm : UI_SOFT);
  const slot = scene.add.rectangle(220, 340, 188, 282, 0x0c1824, 1)
    .setStrokeStyle(coverActive ? 3 : 1, coverActive ? UI_FIELD.gold : UI_FIELD.cyan, 0.8)
    .setName('profile-folio-identity-cover-hit').setData('cardId', selectedId ?? '');
  if (enabled) slot.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
    state.savedDeckIdentitySection = 'cover'; state.savedDeckIdentityIndex = Math.max(0, choices.indexOf(selectedId));
    applySavedDeckIdentityChoice(scene, state, dependencies);
  });
  folioChoiceControl(slot, 'Set selected cover card', enabled);
  if (selected?.artKey && scene.textures.exists(selected.artKey)) {
    const art = scene.add.image(220, 340, selected.artKey).setName('profile-folio-identity-cover-art').setData('cardId', selectedId);
    art.setScale(Math.min(180 / art.width, 274 / art.height));
    slot.setData('artState', 'ready');
  } else {
    slot.setData('artState', scene.load.isLoading() ? 'loading' : 'unavailable');
    folioReaderText(scene, 220, 340, scene.load.isLoading() ? 'Loading art' : 'Art unavailable\nReopen to retry',
      160, UI_TYPE.secondary, UI_SOFT).setOrigin(0.5).setName('profile-folio-identity-cover-loading');
  }
  const name = selected?.name ?? alphaCardSet.cards.find(card => card.id === selectedId)?.displayName ?? 'No cover card';
  const label = folioReaderText(scene, 338, 210, `${selectedId === assignedId ? 'Set · ' : ''}${name}`, 244,
    UI_TYPE.primary, selectedId === assignedId ? '#b9ffdb' : UI_FIELD.warm).setName('profile-folio-identity-cover-name');
  fitTextExcerpt(label, label.text, 3);
  folioReaderText(scene, 338, 306, 'Private description', 244, UI_TYPE.secondary, UI_SOFT);
  const description = folioReaderText(scene, 338, 340,
    deck.description || 'Add a description with the button below.', 244, UI_TYPE.secondary, UI_SOFT)
    .setName('profile-folio-identity-description');
  fitTextExcerpt(description, description.text, 6);
  for (const direction of [-1, 1] as const) quietButton(scene, {
    x: direction < 0 ? 205 : 455, y: 527, width: 220, label: direction < 0 ? 'Previous Cover' : 'Next Cover',
    name: `profile-folio-identity-cover-${direction < 0 ? 'previous' : 'next'}-hit`, enabled: enabled && choices.length > 1,
    onActivate: () => {
      if (!coverActive) {
        state.savedDeckIdentitySection = 'cover';
        state.savedDeckIdentityIndex = Math.max(0, choices.indexOf(assignedId));
      }
      cycleSavedDeckIdentityChoice(scene, state, dependencies, direction);
    },
  });
  SAVED_DECK_SLEEVES.forEach((sleeve, index) => {
    const x = 750 + (index % 2) * 280, y = 282 + Math.floor(index / 2) * 196;
    const assigned = sleeve.id === (deck.sleeve ?? 'field');
    const focused = !coverActive && state.savedDeckIdentityIndex === index;
    const hit = scene.add.rectangle(x, y, 264, 178, sleeve.primary, 1)
      .setStrokeStyle(focused ? 3 : 1, focused ? UI_FIELD.gold : assigned ? UI_FIELD.green : UI_FIELD.cyan, 0.8)
      .setName('profile-folio-identity-sleeve-hit').setData('sleeveId', sleeve.id).setData('index', index)
      .setData('selected', assigned).setData('focused', focused);
    if (enabled) hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      state.savedDeckIdentitySection = 'sleeve'; state.savedDeckIdentityIndex = index;
      applySavedDeckIdentityChoice(scene, state, dependencies);
    });
    folioChoiceControl(hit, `Set ${sleeve.label} card back`, enabled);
    scene.add.rectangle(x, y - 56, 36, 46, sleeve.primary, 1).setStrokeStyle(2, sleeve.accent, 1);
    scene.add.rectangle(x, y - 56, 12, 12, sleeve.ink, 0.92).setAngle(45)
      .setName('profile-folio-identity-sleeve-mark');
    scene.add.rectangle(x, y - 71, 16, 1, sleeve.accent, 0.8);
    scene.add.rectangle(x, y - 41, 16, 1, sleeve.accent, 0.8);
    folioReaderText(scene, x, y - 21, `${assigned ? 'Set · ' : ''}${sleeve.label}`, 240,
      UI_TYPE.primary, assigned ? '#b9ffdb' : UI_FIELD.text).setOrigin(0.5, 0)
      .setName('profile-folio-identity-sleeve-label').setData('sleeveId', sleeve.id);
    folioReaderText(scene, x - 118, y + 9, sleeve.description, 236, UI_TYPE.secondary, UI_SOFT)
      .setName('profile-folio-identity-sleeve-description').setData('sleeveId', sleeve.id);
  });
  const status = state.savedDeckStatus === 'failed' ? 'Could not save. Your existing Folio is unchanged; try again.'
    : state.savedDeckStatus === 'descriptionSaved' ? 'Description saved.'
    : state.savedDeckStatus === 'personalized' ? 'Folio identity saved.' : 'Browse then apply a cover, or tap a cover or sleeve to set it.';
  folioReaderText(scene, 92, 572, status, 1096, UI_TYPE.secondary,
    state.savedDeckStatus === 'failed' ? '#ffb8ad' : UI_SOFT).setName('profile-folio-identity-status');
  quietButton(scene, { x: 250, y: 622, width: 300, label: 'Edit Description', name: 'profile-folio-identity-description-hit',
    enabled, onActivate: () => beginSavedDeckDescription(scene, state, dependencies) });
  quietButton(scene, { x: 610, y: 622, width: 300, label: coverActive ? 'Set Cover Card' : 'Set Card Back',
    name: 'profile-folio-identity-apply-hit', kind: 'primary', enabled, onActivate: () => applySavedDeckIdentityChoice(scene, state, dependencies) });
  quietButton(scene, { x: 1020, y: 622, width: 300, label: 'Back to Organizer', name: 'profile-folio-identity-close-hit',
    enabled, onActivate: () => closeSavedDeckIdentity(scene, state, dependencies) });
  if (!enabled) folioEditorCurtain(scene, 'Edit private description');
}

function renderSavedDeckCodePrompt(scene: Phaser.Scene) {
  scene.add.rectangle(640, 360, 1280, 720, 0x02050a, 0.94).setInteractive().setName('profile-folio-import-scrim');
  scene.add.rectangle(640, 360, 920, document.getElementById('folio-editor-error') ? 450 : 360, UI_FIELD.panel, 1)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.6).setName('profile-folio-import-prompt-frame');
  folioReaderText(scene, 640, 232, `Import BSF${SAVED_DECK_CODE_VERSION} flight code`, 824, 32, UI_FIELD.warm)
    .setOrigin(0.5, 0).setName('profile-folio-import-prompt-title');
  if (!document.getElementById('folio-editor-error')) folioReaderText(scene, 640, 496,
    'Version and checksum are verified before any save changes.',
    824, UI_TYPE.secondary, UI_SOFT).setOrigin(0.5, 0).setAlign('center')
    .setName('profile-folio-import-prompt-help');
}

function cycleSavedDeckLabView(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies, direction: -1 | 1) {
  const current = state.savedDeckLabToolsOpen ? 2 : state.savedDeckLabStudyOpen ? 1 : 0;
  const next = (current + direction + 3) % 3;
  state.savedDeckLabToolsOpen = next === 2; state.savedDeckLabStudyOpen = next === 1;
  dependencies.playUiSound('confirm'); renderProfileScene(scene, state, dependencies);
}

function renderSavedDeckLab(
  scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies,
  deck: SavedDeckRecord, analysis: SavedDeckLabAnalysis, launch: SavedDeckLaunchState,
) {
  const section = state.savedDeckLabToolsOpen ? 2 : state.savedDeckLabStudyOpen ? 1 : 0;
  const practice = savedDeckLaunchState(deck, analysis, loadAccount(), dependencies, true);
  folioToolShell(scene, 'profile-flight-lab', 'Flight Lab', `${deck.name} · Revision ${deck.revision}`,
    launch.detail, `Tab / D-pad: actions · ${controlBindingLabel('confirm')} / A: select · LB/RB: hand · LT/RT: view · ${controlBindingLabel('back')}: back`);
  (scene.children.getByName('profile-flight-lab-context') as Phaser.GameObjects.Text)
    .setName('profile-flight-lab-legality').setText(`${analysis.legalForStandardFlight ? 'Standard ready' : 'Review needed'} · ${launch.detail}`);
  ['Sample hand', 'Deck study', 'Tools'].forEach((label, index) => quietButton(scene, {
    x: 194 + index * 224, y: 196, width: 204, label, name: index === 2 ? 'profile-flight-lab-tools-hit' : `profile-flight-lab-view-${index}-hit`,
    selected: section === index, focused: section === index, onActivate: () => {
      state.savedDeckLabStudyOpen = index === 1; state.savedDeckLabToolsOpen = index === 2;
      dependencies.playUiSound('confirm'); renderProfileScene(scene, state, dependencies);
    },
  }));
  quietButton(scene, { x: 866, y: 196, width: 204, label: launch.label, name: 'profile-flight-lab-launch-hit',
    enabled: launch.available, kind: launch.available ? 'primary' : 'secondary', onActivate: () => launchSelectedSavedDeck(scene, state, dependencies) })
    .setData('available', launch.available).setData('block', launch.block ?? null).setData('missingOwnedIds', launch.missingOwnedIds);
  quietButton(scene, { x: 1090, y: 196, width: 196, label: 'Practice · U', name: 'profile-flight-lab-practice-hit',
    enabled: practice.available, onActivate: () => launchSelectedSavedDeck(scene, state, dependencies, true) }).setData('available', practice.available);
  if (section === 0) {
    const pages = Math.max(1, Math.ceil(analysis.sample.cards.length / 5));
    state.savedDeckLabHandPage = Phaser.Math.Clamp(state.savedDeckLabHandPage, 0, pages - 1);
    const offset = state.savedDeckLabHandPage * 5;
    folioReaderText(scene, 92, 244, analysis.sample.index === 0 ? 'First fight opening' : `Shuffled hand ${analysis.sample.number}`,
      540, UI_TYPE.primary, UI_FIELD.warm).setName('profile-flight-lab-sample-title');
    folioReaderText(scene, 700, 244, `${analysis.rules.wingbeats} Wingbeats · ${analysis.rules.handSize} cards drawn`,
      488, UI_TYPE.primary, UI_SOFT);
    analysis.sample.cards.slice(offset, offset + 5).forEach((card, index) => {
      const x = 200 + index * 220;
      scene.add.rectangle(x, 401, 204, 242, 0x0b1420, 1).setStrokeStyle(1, card.playable ? UI_FIELD.cyan : UI_FIELD.violet, 0.6)
        .setName('profile-flight-lab-card-frame').setData('cardId', card.id);
      folioToolPortrait(scene, dependencies, card.id, x, 354, 100, 144, 'profile-flight-lab-card-art');
      const name = folioReaderText(scene, x - 90, 438, card.name, 180, UI_TYPE.primary);
      fitTextExcerpt(name, card.name, 2);
      folioReaderText(scene, x - 90, 496, `${card.cost} WB · ${card.upgraded ? 'Preened' : 'Base'}`,
        180, UI_TYPE.secondary, card.playable ? '#b9ffdb' : '#ffd7a0').setName('profile-flight-lab-card-role');
    });
    if (!analysis.sample.cards.length) folioReaderText(scene, 92, 306,
      'No currently playable card definitions are available. Use the Tuning Bench to replace unavailable cards.',
      1096, UI_TYPE.primary, UI_SOFT);
    folioReaderText(scene, 380, 546,
      `${analysis.sample.playableCount} individually affordable · Up to ${analysis.sample.affordableTogether} together\nCard page ${state.savedDeckLabHandPage + 1}/${pages} · Before card-play effects`,
      520, UI_TYPE.secondary, UI_SOFT).setName('profile-flight-lab-sample-summary');
    for (const [direction, x, label] of [[-1, 216, 'Prev Cards'], [1, 1064, 'Next Cards']] as const) quietButton(scene, {
      x, y: 556, width: 248, label, name: `profile-flight-lab-hand-${direction < 0 ? 'previous' : 'next'}-hit`,
      enabled: direction < 0 ? state.savedDeckLabHandPage > 0 : state.savedDeckLabHandPage < pages - 1,
      onActivate: () => cycleSavedDeckLabHandPage(scene, state, dependencies, direction),
    });
  } else if (section === 1) {
    folioReaderText(scene, 92, 244, analysis.legalForStandardFlight ? 'Standard ready' : 'Review needed', 500, UI_TYPE.primary, UI_FIELD.warm)
      .setName('profile-flight-lab-study-legality');
    const metrics = [`Saved: ${analysis.savedCopies}`, `Playable: ${analysis.playableCards}`,
      `Preened: ${analysis.preenedCards}`, `Average cost: ${analysis.averageCost.toFixed(2)}`];
    metrics.forEach((label, index) => folioReaderText(scene, 92 + (index % 2) * 260, 282 + Math.floor(index / 2) * 36, label, 250));
    folioReaderText(scene, 92, 366, 'Cost curve · Wingbeats : cards', 500, UI_TYPE.primary, UI_FIELD.warm);
    folioReaderText(scene, 92, 402, analysis.costCurve.map(entry => `${entry.label}: ${entry.count}`).join('     '), 500);
    folioReaderText(scene, 92, 454, `Opening study · ${analysis.consistency.sampleCount} samples, not win odds`, 500, UI_TYPE.primary, UI_FIELD.warm);
    folioReaderText(scene, 92, 491,
      `${analysis.consistency.averagePlayable} average affordable · ${analysis.consistency.atLeastTwoPlayablePercent}% have at least two\n${analysis.consistency.pressureAvailable ? `${analysis.consistency.pressurePercent}% include pressure` : 'No pressure card in deck'} · ${analysis.consistency.uniqueHands} distinct hands`,
      500, UI_TYPE.secondary, UI_SOFT);
    folioReaderText(scene, 92, 544, `Draw: ${analysis.rules.baseHandSize} base + ${analysis.rules.flockDraw} Flock + ${analysis.rules.keystoneDraw} keystone\nWaymarks and route bonuses are excluded.`,
      500, UI_TYPE.secondary, UI_SOFT);
    const groups: Array<[string, Array<{ label: string; count: number }>]> = [['Roles', analysis.roles], ['Families', analysis.families], ['Resource hooks', analysis.resourceHooks]];
    groups.forEach(([label, entries], index) => {
      const y = 244 + index * 100;
      folioReaderText(scene, 636, y, label, 552, UI_TYPE.primary, UI_FIELD.warm);
      const text = folioReaderText(scene, 636, y + 32, entries.map(entry => `${entry.label} ${entry.count}`).join(' · ') || 'None', 552, UI_TYPE.secondary, UI_SOFT);
      fitTextExcerpt(text, text.text, 2);
    });
    const issues = folioReaderText(scene, 636, 544, analysis.issues.join(' ') || 'Every saved card is recognized by the current singleton rules.',
      552, UI_TYPE.secondary, analysis.issues.length ? '#ffd7a0' : UI_SOFT).setName('profile-flight-lab-issues');
    fitTextExcerpt(issues, issues.text, 2);
  } else {
    scene.add.rectangle(640, 408, 1096, 340, UI_FIELD.panel, 1).setName('profile-flight-lab-tools-panel');
    const actions = [
      ['Collection Signals · G', 'collection-signals', 'Read how owned cards appear across your saved Folios.', () => openSavedDeckCollectionSignals(scene, state, dependencies)],
      ['Field Record · N', 'field-record', 'Review exact-match flights and private matchup notes.', () => openSavedDeckFieldRecord(scene, state, dependencies)],
      ['Revision Trail · R', 'history', 'Compare every change and restore a preserved revision.', () => openSavedDeckHistory(scene, state, dependencies)],
      ['Tune Copy · T', 'tune', 'Use owned replacements without changing the source.', () => openSavedDeckWorkshop(scene, state, dependencies)],
    ] as const;
    actions.forEach(([label, name, description, action], index) => {
      const x = 350 + (index % 2) * 580, y = 282 + Math.floor(index / 2) * 142;
      quietButton(scene, { x, y, width: 516, label, name: `profile-flight-lab-${name}-hit`, onActivate: action });
      folioReaderText(scene, x - 258, y + 40, description, 516, UI_TYPE.secondary, UI_SOFT);
    });
    folioReaderText(scene, 92, 548, 'Practice runs real battles without saving. Menu or reload ends practice; your active flight stays safe.',
      1096, UI_TYPE.secondary, UI_SOFT);
  }
  for (const [x, label, name, enabled, action] of [
    [270, 'Previous Hand', 'previous', state.savedDeckLabSample > 0, () => cycleSavedDeckLabSample(scene, state, dependencies, -1)],
    [640, 'Deal Again', 'deal', true, () => cycleSavedDeckLabSample(scene, state, dependencies, 1)],
    [1010, 'Close Lab', 'close', true, () => closeSavedDeckLab(scene, state, dependencies)],
  ] as const) quietButton(scene, { x, y: 622, width: 356, label, name: `profile-flight-lab-${name}-hit`, enabled,
    kind: name === 'deal' ? 'primary' : 'secondary', onActivate: action });
}

function folioToolShell(scene: Phaser.Scene, prefix: string, title: string, subtitle: string, context: string, hint: string) {
  scene.add.rectangle(640, 360, 1280, 720, 0x02050a, 0.94).setInteractive().setName(`${prefix}-scrim`);
  scene.add.rectangle(640, 360, 1160, 656, UI_FIELD.panel, 1).setStrokeStyle(1, UI_FIELD.cyan, 0.5).setName(`${prefix}-frame`);
  folioReaderText(scene, 92, 58, title, 1096, 32, UI_FIELD.warm).setName(`${prefix}-title`);
  const name = folioReaderText(scene, 92, 102, subtitle, 1096).setName(`${prefix}-deck-name`);
  fitTextExcerpt(name, subtitle, 1);
  folioReaderText(scene, 92, 136, context, 1096, UI_TYPE.secondary, UI_SOFT).setName(`${prefix}-context`);
  folioReaderText(scene, 92, 661, hint, 1096, UI_TYPE.secondary, UI_SOFT).setName(`${prefix}-hint`);
}

function folioToolPortrait(scene: Phaser.Scene, dependencies: ProfileSceneDependencies, id: string,
  x: number, y: number, width: number, height: number, name: string) {
  const entry = dependencies.cardShowcaseEntry(id);
  const ready = Boolean(entry?.artKey && scene.textures.exists(entry.artKey));
  scene.add.rectangle(x, y, width, height, 0x0c1824, 1).setStrokeStyle(1, UI_FIELD.violet, 0.6)
    .setName(`${name}-slot`).setData('cardId', id).setData('artState', ready ? 'ready' : scene.load.isLoading() ? 'loading' : 'unavailable');
  if (ready && entry?.artKey) {
    const art = scene.add.image(x, y, entry.artKey).setName(name).setData('cardId', id);
    art.setScale(Math.min(width / art.width, height / art.height));
  } else if (width >= 100) {
    folioReaderText(scene, x, y, scene.load.isLoading() ? 'Loading\nart' : 'Art\nmissing',
      width - 20, UI_TYPE.secondary, UI_SOFT).setOrigin(0.5).setAlign('center').setName(`${name}-status`);
  }
}

function collectionSignalSections(signals: SavedDeckCollectionSignals) {
  const date = (value: number) => value > 0 ? new Date(value).toISOString().slice(0, 10) : 'Date unknown';
  type Row = { title: string; detail: string; ids: string[]; current?: boolean };
  return [
    { id: 'unused', title: 'Unused owned', description: 'Owned cards that appear in no saved Folio · Up to five shown',
      rows: signals.unused.map(card => ({ title: card.name, detail: `${date(card.firstAcquiredAt)} · Never filed`, ids: [card.id] })) as Row[],
      empty: signals.ownedCount === 0 ? 'No permanent cards collected yet.' : 'Every owned card appears in a saved Folio.' },
    { id: 'frequent', title: 'Many Folios', description: 'Most frequently filed owned cards · Up to five shown',
      rows: signals.frequentlyFiled.map(card => ({ title: card.name,
        detail: `${card.folioCount} Folio${card.folioCount === 1 ? '' : 's'} · ${card.activeFolioCount} active${card.inSelectedFolio ? ' · In this Folio' : ''}`,
        ids: [card.id], current: card.inSelectedFolio })) as Row[],
      empty: 'No owned cards appear in a saved Folio yet.' },
    { id: 'recent', title: 'New arrivals', description: 'First acquired, newest first · Up to five shown',
      rows: signals.recentlyAcquired.map(card => ({ title: card.name,
        detail: `${date(card.firstAcquiredAt)} · ${card.folioCount === 0 ? 'Unused' : `${card.folioCount} Folio${card.folioCount === 1 ? '' : 's'}`}${card.inSelectedFolio ? ' · In this Folio' : ''}`,
        ids: [card.id], current: card.inSelectedFolio })) as Row[],
      empty: 'No permanent acquisition records yet.' },
    { id: 'paired', title: 'Common pairs', description: 'Owned pairs sharing a Folio and touching this deck · Up to five shown',
      rows: signals.commonlyPaired.map(pair => ({ title: `${pair.first.name} + ${pair.second.name}`,
        detail: `${pair.folioCount} Folio${pair.folioCount === 1 ? '' : 's'} · ${pair.activeFolioCount} active${pair.bothInSelectedFolio ? ' · Both in this Folio' : ''}`,
        ids: [pair.first.id, pair.second.id], current: pair.bothInSelectedFolio })) as Row[],
      empty: 'No owned card pair around this Folio yet.' },
  ];
}

function cycleSavedDeckSignalsSection(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies, direction: -1 | 1) {
  state.savedDeckSignalsSection = ((state.savedDeckSignalsSection ?? 0) + direction + 4) % 4;
  dependencies.playUiSound('confirm'); renderProfileScene(scene, state, dependencies);
}

function savedDeckHistoryRows(history: SavedDeckHistoryState) {
  type Card = SavedDeckRecord['cards'][number];
  const rows: Array<{ label: string; current: string; target: string; currentCard?: Card; targetCard?: Card }> = [];
  const target = history.target, comparison = history.comparison;
  if (!target || !comparison) return rows;
  const leader = (id: string) => flockLeaders.find(entry => entry.id === id)?.name ?? id;
  if (comparison.leaderChanged) rows.push({ label: 'Leader change', current: leader(history.source.leaderId), target: leader(target.leaderId) });
  if (comparison.runModeChanged) rows.push({ label: 'Flight mode change', current: history.source.runMode, target: target.runMode });
  comparison.cardChanges.forEach(change => rows.push({ label: `Card ${change.position} · ${change.kind}`,
    current: change.current ? alphaCardLibrary.get(change.current.id)?.displayName ?? change.current.id : 'Empty slot',
    target: change.target ? alphaCardLibrary.get(change.target.id)?.displayName ?? change.target.id : 'Empty slot',
    currentCard: change.current ?? undefined, targetCard: change.target ?? undefined }));
  return rows;
}

function cycleSavedDeckHistoryChange(scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies, direction: -1 | 1) {
  const history = savedDeckHistoryState(state), count = history ? savedDeckHistoryRows(history).length : 0;
  if (count <= 1) { dependencies.playUiSound('locked'); return; }
  state.savedDeckHistoryChangePage = ((state.savedDeckHistoryChangePage ?? 0) + direction + count) % count;
  dependencies.playUiSound('confirm'); renderProfileScene(scene, state, dependencies);
}

function renderSavedDeckCollectionSignals(
  scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies,
  signals: SavedDeckCollectionSignals,
) {
  const categories = collectionSignalSections(signals);
  const selected = Phaser.Math.Clamp(state.savedDeckSignalsSection ?? 0, 0, categories.length - 1);
  const section = categories[selected];
  folioToolShell(scene, 'profile-collection-signals', 'Collection Signals', signals.deckName,
    `Owned cards: ${signals.ownedCount} · Folios: ${signals.folioCount} · Archived: ${signals.archivedFolioCount} · Unused: ${signals.unusedCount}`,
    `Tab / D-pad Left / Right: actions · ${controlBindingLabel('confirm')} / A: select · LB / RB: section · ${controlBindingLabel('back')} / B: back`);
  categories.forEach((category, index) => quietButton(scene, { x: 223 + index * 278, y: 196, width: 262,
    label: category.title, selected: index === selected, focused: index === selected,
    name: 'profile-collection-signals-section-hit', onActivate: () => {
      state.savedDeckSignalsSection = index; dependencies.playUiSound('confirm'); renderProfileScene(scene, state, dependencies);
    },
  }).setData('section', category.id).setData('index', index));
  folioReaderText(scene, 92, 244, section.description, 1096, UI_TYPE.primary, UI_FIELD.warm);
  scene.add.rectangle(640, 435, 1096, 300, UI_FIELD.panel, 1).setName(`profile-collection-signals-${section.id}-panel`);
  section.rows.forEach((row, index) => {
    const y = 306 + index * 62;
    scene.add.rectangle(640, y, 1096, 58, row.current ? 0x173247 : 0x0b1420, 1)
      .setStrokeStyle(row.current ? 2 : 1, row.current ? UI_FIELD.cyan : UI_FIELD.violet, 0.55)
      .setName(`profile-collection-signals-${section.id}-row`).setData('cardIds', row.ids).setData('currentFolio', row.current === true);
    const title = folioReaderText(scene, 108, y - 24, row.title, 1064, UI_TYPE.primary, UI_FIELD.text);
    fitTextExcerpt(title, row.title, 1);
    folioReaderText(scene, 108, y + 5, row.detail, 1064, UI_TYPE.secondary, UI_SOFT);
  });
  if (!section.rows.length) folioReaderText(scene, 108, 302, section.empty, 1048, UI_TYPE.primary, UI_SOFT)
    .setName(`profile-collection-signals-${section.id}-empty`);
  folioReaderText(scene, 92, 597, 'Counts distinct Folios, including Archive; repeated copies count once.', 790, UI_TYPE.secondary, UI_SOFT)
    .setName('profile-collection-signals-method');
  folioReaderText(scene, 92, 625, 'Read-only context · No recommendations, edits or gameplay power', 790, UI_TYPE.secondary, UI_SOFT)
    .setName('profile-collection-signals-safety');
  quietButton(scene, { x: 1058, y: 622, width: 260, label: 'Back to Lab', name: 'profile-collection-signals-close-hit',
    onActivate: () => closeSavedDeckCollectionSignals(scene, state, dependencies) });
}

function renderSavedDeckNotesPrompt(scene: Phaser.Scene, deck: SavedDeckRecord, failed = false) {
  scene.add.rectangle(640, 360, 1280, 720, 0x02050a, 0.94).setInteractive().setName('profile-folio-notes-scrim');
  scene.add.rectangle(640, 360, 920, failed ? 556 : 470, UI_FIELD.panel, 1)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.6).setName('profile-folio-notes-prompt-frame');
  folioReaderText(scene, 640, 176, 'Edit private matchup notes', 824, 32, UI_FIELD.warm)
    .setOrigin(0.5, 0).setName('profile-folio-notes-prompt-title');
  const name = folioReaderText(scene, 640, 225, `${deck.name} · Revision ${deck.revision}`, 824,
    UI_TYPE.primary, UI_SOFT).setOrigin(0.5, 0).setName('profile-folio-notes-deck-name');
  fitTextExcerpt(name, name.text, 1);
  if (!failed) folioReaderText(scene, 640, 548,
    `${SAVED_DECK_NOTES_LIMIT} characters · Shift+Enter: new line\nPrivate; excluded from share codes · No gameplay power`,
    824, UI_TYPE.secondary, UI_SOFT).setOrigin(0.5, 0).setAlign('center')
    .setName('profile-folio-notes-prompt-help');
}

function renderSavedDeckFieldRecord(
  scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies,
  field: SavedDeckFieldRecordState,
) {
  const enabled = !state.savedDeckNotesInput;
  folioReaderShell(scene, 'field-record', 'Folio Field Record',
    { ...field.deck, name: `${field.deck.name}${field.deck.archived ? ' · Archived' : ''}` },
    `Same leader, mode, card order and Base/Preened states · E / X: notes · ${controlBindingLabel('back')} / B: back`);
  const privateLabel = scene.children.getByName('profile-folio-field-record-private') as Phaser.GameObjects.Text;
  privateLabel.setText('Exact matches from your latest 50 local records · Private · No gameplay power');
  const metrics: Array<[string, string]> = [
    ['Flights', String(field.record.flights)], ['Wins', String(field.record.wins)],
    ['Win rate', field.record.flights ? `${field.record.winRate}%` : '—'],
    ['Avg turns', field.record.averageTurns === null ? '—' : String(field.record.averageTurns)],
    ['Fastest win', field.record.fastestWinTurns === null ? '—' : `${field.record.fastestWinTurns} turns`],
    ['Best Cohesion', field.record.bestCohesionPercent === null ? '—' : `${field.record.bestCohesionPercent}%`],
  ];
  metrics.forEach(([label, value], index) => {
    const text = folioReaderText(scene, 92 + (index % 2) * 266, 186 + Math.floor(index / 2) * 36,
      `${label}: ${value}`, 250, UI_TYPE.primary).setName('profile-folio-field-record-metric');
    fitTextExcerpt(text, text.text, 1);
  });
  folioReaderText(scene, 92, 307, 'Private matchup notes', 500, UI_TYPE.primary, UI_FIELD.warm);
  const notes = folioReaderText(scene, 92, 348,
    field.deck.notes || 'No notes yet. Record matchup lessons, opening-hand reminders or the next change to test.',
    500, UI_TYPE.secondary, UI_SOFT).setName('profile-folio-field-record-notes');
  fitTextExcerpt(notes, notes.text, 7);
  folioReaderText(scene, 92, 548, state.savedDeckStatus === 'failed'
    ? 'Could not save. Your existing notes are unchanged.'
    : state.savedDeckStatus === 'notesSaved' ? 'Private notes saved.'
      : `${field.deck.notes?.length ?? 0}/${SAVED_DECK_NOTES_LIMIT} characters · Edit to read the full note`,
    500, UI_TYPE.secondary, state.savedDeckStatus === 'failed' ? '#ffb8ad' : UI_SOFT)
    .setName('profile-folio-field-record-note-status');
  folioReaderText(scene, 636, 186, 'Recent exact-match flights', 552, UI_TYPE.primary, UI_FIELD.warm);
  field.record.recent.forEach((flight, index) => {
    const y = 252 + index * 70, won = flight.result === 'win';
    scene.add.rectangle(912, y, 552, 64, won ? 0x123126 : 0x201b28, 1)
      .setStrokeStyle(1, won ? UI_FIELD.green : UI_FIELD.violet, 0.55)
      .setName('profile-folio-field-record-flight-row').setData('runId', flight.id);
    const date = flight.completedAtMs > 0
      ? new Date(flight.completedAtMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Earlier flight';
    const title = folioReaderText(scene, 650, y - 25,
      `${won ? 'Win' : 'Loss'} · ${date} · ${flight.turns} turns · ${flight.difficulty}`,
      524, UI_TYPE.primary, won ? '#b9ffdb' : UI_FIELD.text).setName('profile-folio-field-record-flight-title');
    fitTextExcerpt(title, title.text, 1);
    const detail = folioReaderText(scene, 650, y + 5,
      `${flight.currentCohesion}/${flight.maxCohesion} Cohesion · Flight ${flight.seed}`,
      524, UI_TYPE.secondary, UI_SOFT).setName('profile-folio-field-record-flight-detail');
    fitTextExcerpt(detail, detail.text, 1);
  });
  if (!field.record.recent.length) folioReaderText(scene, 636, 252,
    'No completed flight matches this Folio yet.\n\nFinish a flight with the same leader, mode, card order and Base/Preened states to start its record.',
    552, UI_TYPE.primary, UI_SOFT).setName('profile-folio-field-record-empty');
  quietButton(scene, { x: 300, y: 622, width: 390, label: field.deck.notes ? 'Edit Private Notes' : 'Add Private Notes',
    name: 'profile-folio-field-record-edit-hit', enabled, onActivate: () => beginSavedDeckNotes(scene, state, dependencies) });
  quietButton(scene, { x: 980, y: 622, width: 390, label: 'Back to Lab', name: 'profile-folio-field-record-close-hit',
    enabled, onActivate: () => closeSavedDeckFieldRecord(scene, state, dependencies) });
  if (state.savedDeckNotesInput) renderSavedDeckNotesPrompt(scene, field.deck, state.savedDeckStatus === 'failed');
}

function renderSavedDeckHistory(
  scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies,
  history: SavedDeckHistoryState, activeCount: number,
) {
  const canRestore = activeCount < SAVED_DECK_LIMIT && Boolean(history.target) && history.comparison?.exactMatch === false;
  const status = state.savedDeckStatus === 'failed' ? 'Could not save. Every existing revision is unchanged.'
    : activeCount >= SAVED_DECK_LIMIT ? 'Archive an active Folio to make room for a restored revision.'
      : !history.target ? 'No earlier revision. Fork or tune this Folio to begin a reversible trail.'
        : history.comparison?.exactMatch ? 'The playable deck already matches. No restore is needed.'
          : 'Restores as a new revision. Both the current and selected Folio stay preserved.';
  folioToolShell(scene, 'profile-folio-history', 'Revision Trail',
    `${history.source.name} · Revision ${history.source.revision}${history.source.archived ? ' · Archived' : ''}`, status,
    `Up / Down / LB / RB: revision · Page Up / Down / LT / RT: change · ${controlBindingLabel('confirm')} / A: restore · ${controlBindingLabel('back')} / B: back`);
  folioReaderText(scene, 92, 176, `Lineage · ${history.targets.length} revision${history.targets.length === 1 ? '' : 's'}`, 420, UI_TYPE.primary, UI_FIELD.warm);
  const start = Phaser.Math.Clamp(history.targetIndex - 2, 0, Math.max(0, history.targets.length - 5));
  history.targets.slice(start, start + 5).forEach((target, offset) => {
    const index = start + offset, y = 239 + offset * 76, selected = index === history.targetIndex;
    const hit = scene.add.rectangle(302, y, 420, 68, selected ? 0x173247 : 0x0b1420, 1)
      .setStrokeStyle(selected ? 3 : 1, selected ? UI_FIELD.gold : UI_FIELD.cyan, 0.8)
      .setInteractive({ useHandCursor: true }).setName('profile-folio-history-target-hit')
      .setData('deckId', target.id).setData('index', index);
    hit.on('pointerdown', () => {
      state.savedDeckHistoryTargetIndex = index; state.savedDeckHistoryChangePage = 0; state.savedDeckStatus = 'idle';
      dependencies.playUiSound('confirm'); queueSavedDeckHistoryAssets(scene, state, dependencies); renderProfileScene(scene, state, dependencies);
    });
    const name = folioReaderText(scene, 108, y - 26, target.name, 388, UI_TYPE.primary);
    fitTextExcerpt(name, name.text, 1);
    folioReaderText(scene, 108, y + 7, `Rev ${target.revision}${target.id === history.source.parentId ? ' · Parent' : ''}${target.archived ? ' · Archived' : ''}`,
      388, UI_TYPE.secondary, selected ? UI_FIELD.warm : UI_SOFT);
  });
  if (!history.targets.length) folioReaderText(scene, 92, 232,
    'No earlier revision in this lineage. Your current Folio remains unchanged.', 420, UI_TYPE.primary, UI_SOFT).setName('profile-folio-history-empty');
  const rows = savedDeckHistoryRows(history);
  const page = Phaser.Math.Clamp(state.savedDeckHistoryChangePage ?? 0, 0, Math.max(0, rows.length - 1));
  state.savedDeckHistoryChangePage = page;
  folioReaderText(scene, 552, 176, history.target ? `Current Rev ${history.source.revision} → Selected Rev ${history.target.revision}` : 'Revision comparison',
    636, UI_TYPE.primary, UI_FIELD.warm);
  folioReaderText(scene, 552, 211, history.comparison
    ? `Changed cards: ${history.comparison.cardChanges.length} · Unchanged: ${history.comparison.unchangedCards}`
    : 'Choose a preserved revision to compare.', 636, UI_TYPE.secondary, UI_SOFT).setName('profile-folio-history-summary');
  for (const [direction, x] of [[-1, 632], [1, 1108]] as const) quietButton(scene, { x, y: 276, width: 160,
    label: direction < 0 ? 'Prev Change' : 'Next Change', name: `profile-folio-history-change-${direction < 0 ? 'previous' : 'next'}-hit`,
    enabled: rows.length > 1, onActivate: () => cycleSavedDeckHistoryChange(scene, state, dependencies, direction) });
  folioReaderText(scene, 870, 267, `Change ${rows.length ? page + 1 : 0} / ${rows.length}`, 280, UI_TYPE.secondary, UI_SOFT).setOrigin(0.5, 0);
  const row = rows[page];
  if (row) {
    folioReaderText(scene, 552, 318, row.label, 636, UI_TYPE.primary, UI_FIELD.warm).setName('profile-folio-history-change');
    for (const [side, x] of [['current', 694], ['target', 1046]] as const) {
      const card = side === 'current' ? row.currentCard : row.targetCard;
      if (card) folioToolPortrait(scene, dependencies, card.id, x, 433, 100, 150, `profile-folio-history-${side}-art`);
      const name = folioReaderText(scene, x - 142, card ? 516 : 382, row[side], 284, UI_TYPE.primary);
      fitTextExcerpt(name, row[side], 2);
      folioReaderText(scene, x - 142, 572, card ? card.upgraded ? 'Preened' : 'Base' : side === 'current' ? 'Current' : 'Restore target',
        284, UI_TYPE.secondary, UI_SOFT);
    }
  } else folioReaderText(scene, 552, 355, history.target
    ? 'These revisions have the same playable deck. No new restore is needed.'
    : 'No prior revision is available to compare. The current Folio remains unchanged.',
    636, UI_TYPE.primary, UI_SOFT).setName('profile-folio-history-exact');
  for (const [direction, x] of [[-1, 192], [1, 412]] as const) quietButton(scene, { x, y: 622, width: 200,
    label: direction < 0 ? 'Prev Revision' : 'Next Revision', name: `profile-folio-history-${direction < 0 ? 'previous' : 'next'}-hit`,
    enabled: history.targets.length > 1, onActivate: () => cycleSavedDeckHistoryTarget(scene, state, dependencies, direction) });
  quietButton(scene, { x: 762, y: 622, width: 420, label: 'Restore as New Revision', name: 'profile-folio-history-restore-hit',
    enabled: canRestore, kind: canRestore ? 'primary' : 'secondary', onActivate: () => restoreSelectedSavedDeckRevision(scene, state, dependencies) });
  quietButton(scene, { x: 1092, y: 622, width: 192, label: 'Back to Lab', name: 'profile-folio-history-close-hit',
    onActivate: () => closeSavedDeckHistory(scene, state, dependencies) });
}

function renderSavedDeckWorkshop(
  scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies,
  workshop: SavedDeckWorkshopState, activeCount: number,
) {
  const canSave = activeCount < SAVED_DECK_LIMIT && workshop.suggestions.length > 0;
  folioToolShell(scene, 'profile-folio-workshop', 'Tuning Bench', `${workshop.deck.name} · Revision ${workshop.deck.revision} source`,
    state.savedDeckStatus === 'failed' ? 'Could not save. Your source Folio and collection are unchanged.'
      : activeCount >= SAVED_DECK_LIMIT ? 'Archive an active Folio first. Saving never overwrites an existing revision.'
        : 'Choose an owned replacement. Save creates a new revision and preserves the source.',
    `${controlBindingLabel('previous')} / ${controlBindingLabel('next')} / LB / RB: card · Up / Down: replacement · ${controlBindingLabel('confirm')} / A: save · ${controlBindingLabel('back')} / B: back`);
  folioReaderText(scene, 92, 180, `Replace card ${workshop.cardIndex + 1} of ${workshop.deck.cards.length}`, 420, UI_TYPE.primary, UI_FIELD.warm)
    .setName('profile-folio-workshop-source-position');
  folioToolPortrait(scene, dependencies, workshop.sourceCard.id, 302, 359, 164, 246, 'profile-folio-workshop-source-art');
  const source = folioReaderText(scene, 92, 498, workshop.sourceName, 420, UI_TYPE.primary);
  fitTextExcerpt(source, source.text, 2);
  folioReaderText(scene, 92, 555, alphaCardLibrary.has(workshop.sourceCard.id)
    ? workshop.sourceCard.upgraded ? 'Preened source · Replacement starts at Base' : 'Base source · Replacement starts at Base'
    : 'Definition unavailable · Safe to replace', 420, UI_TYPE.secondary, UI_SOFT).setName('profile-folio-workshop-source-name');
  folioReaderText(scene, 552, 180, 'Owned, role-similar replacements', 636, UI_TYPE.primary, UI_FIELD.warm);
  workshop.suggestions.forEach((candidate, index) => {
    const y = 246 + index * 66, selected = index === state.savedDeckWorkshopSuggestionIndex;
    const hit = scene.add.rectangle(870, y, 636, 58, selected ? 0x173247 : 0x0b1420, 1)
      .setStrokeStyle(selected ? 3 : 1, selected ? UI_FIELD.gold : UI_FIELD.cyan, 0.7)
      .setInteractive({ useHandCursor: true }).setName('profile-folio-workshop-suggestion-hit').setData('cardId', candidate.id).setData('index', index);
    hit.on('pointerdown', () => {
      state.savedDeckWorkshopSuggestionIndex = index; state.savedDeckStatus = 'idle';
      dependencies.playUiSound('confirm'); renderProfileScene(scene, state, dependencies);
    });
    folioToolPortrait(scene, dependencies, candidate.id, 580, y, 32, 48, 'profile-folio-workshop-suggestion-art');
    const title = folioReaderText(scene, 612, y - 25, `${candidate.name} · ${candidate.cost} WB`, 560, UI_TYPE.primary);
    fitTextExcerpt(title, title.text, 1);
    const reason = folioReaderText(scene, 612, y + 5, `${candidate.family} · ${candidate.role}`, 560, UI_TYPE.secondary, UI_SOFT);
    fitTextExcerpt(reason, reason.text, 1);
  });
  if (!workshop.suggestions.length) folioReaderText(scene, 552, 248,
    'No other permanently owned cards are valid for this slot. Claim more cards, then return to tune this Folio.',
    636, UI_TYPE.primary, UI_SOFT).setName('profile-folio-workshop-empty');
  const selected = workshop.suggestions[state.savedDeckWorkshopSuggestionIndex];
  const summary = folioReaderText(scene, 552, 544, selected ? selected.reasons.join(' · ') : 'No replacement available · Source unchanged',
    636, UI_TYPE.secondary, UI_SOFT).setName('profile-folio-workshop-summary');
  fitTextExcerpt(summary, summary.text, 2);
  for (const [direction, x] of [[-1, 192], [1, 412]] as const) quietButton(scene, { x, y: 622, width: 200,
    label: direction < 0 ? 'Previous Card' : 'Next Card', name: `profile-folio-workshop-${direction < 0 ? 'previous' : 'next'}-hit`,
    enabled: workshop.deck.cards.length > 1, onActivate: () => cycleSavedDeckWorkshopCard(scene, state, dependencies, direction) });
  quietButton(scene, { x: 762, y: 622, width: 420, label: 'Save Tuned Revision', name: 'profile-folio-workshop-save-hit',
    enabled: canSave, kind: canSave ? 'primary' : 'secondary', onActivate: () => saveSavedDeckWorkshopRevision(scene, state, dependencies) });
  quietButton(scene, { x: 1092, y: 622, width: 192, label: 'Back to Lab', name: 'profile-folio-workshop-close-hit',
    onActivate: () => closeSavedDeckWorkshop(scene, state, dependencies) });
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
  const fieldButton: ProfileSceneDependencies['renderFieldButton'] = (owner, _add, cx, cy, width, _height, label, enabled, onActivate) =>
    quietButton(owner, { x: cx, y: cy, width, label, enabled, onActivate, name: 'profile-folio-command' });
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
  const templateHit = fieldButton(
    scene,
    () => {},
    x + 86,
    top + 259,
    170,
    MIN_SUPPORTED_TOUCH_TARGET,
    'New',
    !textInputOpen,
    () => openSavedDeckTemplate(scene, state, dependencies),
    UI_FIELD.green,
    false,
  );
  templateHit.setName('profile-folio-template-hit');
  const organizeHit = fieldButton(
    scene,
    () => {},
    x + 279,
    top + 259,
    170,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Organize',
    allDecks.length > 0 && !textInputOpen,
    () => openSavedDeckOrganizer(scene, state, dependencies),
    UI_FIELD.gold,
    false,
  );
  organizeHit.setName('profile-folio-organize-hit');
  const libraryHit = fieldButton(
    scene,
    () => {},
    x + 472,
    top + 259,
    170,
    MIN_SUPPORTED_TOUCH_TARGET,
    state.savedDeckArchiveView ? `Active ${activeCount}` : `Archive ${archivedCount}`,
    !textInputOpen,
    () => toggleSavedDeckArchiveView(scene, state, dependencies),
    UI_FIELD.violet,
    false,
  );
  libraryHit.setName('profile-folio-library-hit');
  const importHit = fieldButton(
    scene,
    () => {},
    x + 665,
    top + 259,
    170,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Import',
    activeCount < SAVED_DECK_LIMIT && !textInputOpen,
    () => beginSavedDeckImport(scene, state, dependencies),
    UI_FIELD.cyan,
    false,
  );
  importHit.setName('profile-folio-import-hit');

  if (allDecks.length === 0) {
    scene.add.rectangle(x + 375, top + 376, 750, 174, 0x0b1420, 0.88)
      .setStrokeStyle(1, UI_FIELD.violet, 0.52)
      .setName('profile-folios-empty-frame');
    scene.add.text(
      x + 375,
      top + 376,
      state.savedDeckArchiveView
        ? `Archive is empty.\n\nArchive an active folio without deleting it.\nRestore when an active slot is open.\nV / controller Select returns to Active.`
        : `No active Folios yet.\n\nBuild one from an owned leader starter,\nsave a flight from Route Deck Review,\nor import a checksum-validated BSF${SAVED_DECK_CODE_VERSION} code.`,
      {
        fontFamily: UI_FONT,
        fontSize: '20px',
        color: UI_SOFT,
        align: 'center',
        lineSpacing: 5,
        wordWrap: { width: 680 },
      },
    ).setResolution(2).setOrigin(0.5).setName('profile-folios-empty');
    if (state.savedDeckStatus === 'restored' || state.savedDeckStatus === 'archived') {
      scene.add.text(x + 375, top + 486, state.savedDeckStatus === 'restored'
        ? 'FOLIO RESTORED TO ACTIVE'
        : 'FOLIO ARCHIVED WITHOUT DELETION', {
        fontFamily: UI_FONT,
        fontSize: '18px',
        fontStyle: UI_BOLD,
        color: UI_FIELD.cyanText,
      }).setResolution(2).setOrigin(0.5).setName('profile-folio-status');
    }
    return;
  }

  visibleDecks.forEach((deck, visibleIndex) => {
    const index = visibleStart + visibleIndex;
    const y = top + 334 + visibleIndex * 82;
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
    const hit = scene.add.rectangle(x + 375, y, 750, 80, selected ? 0x183451 : 0x0d1420, 0.94)
      .setStrokeStyle(selected ? 3 : 1, selected ? UI_FIELD.cyan : deck.favorite ? UI_FIELD.gold : UI_FIELD.violet, selected ? 0.98 : 0.52)
      .setInteractive({ useHandCursor: true })
      .setName('profile-folio-row-hit')
      .setData('deckId', deck.id)
      .setData('index', index);
    hit.on('pointerdown', () => {
      state.focus = 'folios';
      selectSavedDeck(scene, state, dependencies, index);
    });
    scene.add.text(x + 20, y - 39, `${deck.favorite ? '★ ' : ''}${deck.name}`, {
      fontFamily: UI_FONT,
      fontSize: '22px',
      fontStyle: UI_BOLD,
      color: deck.favorite ? UI_GOLD : UI_FIELD.warm,
      fixedWidth: 655,
    }).setResolution(2).setName('profile-folio-name').setData('deckId', deck.id);
    scene.add.rectangle(x + 720, y - 21, 24, 32, sleeve.primary, 1)
      .setStrokeStyle(2, sleeve.accent, 0.92)
      .setName('profile-folio-sleeve-preview')
      .setData('deckId', deck.id)
      .setData('sleeveId', sleeve.id);
    scene.add.line(x + 720, y - 21, -7, -10, 7, 10, sleeve.accent, 0.88).setLineWidth(2);
    scene.add.circle(x + 720, y - 21, 3, sleeve.ink, 0.96);
    scene.add.text(x + 20, y - 9, `${leader.toUpperCase()}  ·  ${deck.cards.length} CARDS  ·  ${deck.cards.filter((card) => card.upgraded).length} PREENED  ·  REV ${deck.revision}`, {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.cyanText,
      fixedWidth: 680,
    }).setResolution(2);
    scene.add.text(
      x + 20,
      y + 17,
      deck.description
        ? `${folderLabel.toUpperCase()}  /  ${deck.description}`
        : deck.folder || tagLabels.length > 0
          ? `${folderLabel.toUpperCase()}${tagLabels.length > 0 ? `  ·  ${tagLabels.join(' / ')}` : ''}`
          : `${cardNames.join(', ')}${deck.cards.length > 3 ? ', …' : ''}`,
      {
        fontFamily: UI_FONT,
        fontSize: '18px',
        fontStyle: deck.description || deck.folder || tagLabels.length > 0 ? UI_BOLD : 'normal',
        color: deck.description || deck.folder || tagLabels.length > 0 ? '#b9ffdb' : UI_MUTED,
        fixedWidth: 680, wordWrap: { width: 680 }, maxLines: 1,
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
              : state.savedDeckStatus === 'copying'
                ? 'COPYING CODE…  ·  YOUR FOLIO IS UNCHANGED'
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
  scene.add.text(x + 375, top + 620, status, {
    fontFamily: UI_FONT,
    fontSize: '18px',
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
    fixedWidth: 740,
    align: 'center',
  }).setResolution(2).setOrigin(0.5).setName('profile-folio-status');

  const favorite = fieldButton(
    scene,
    () => {},
    x + 125,
    top + 450,
    230,
    MIN_SUPPORTED_TOUCH_TARGET,
    selected?.favorite ? 'Unfavorite' : 'Favorite',
    Boolean(selected) && !textInputOpen,
    () => toggleSelectedSavedDeckFavorite(scene, state, dependencies),
    UI_FIELD.gold,
    false,
  );
  favorite.setName('profile-folio-favorite-hit');
  const rename = fieldButton(
    scene,
    () => {},
    x + 375,
    top + 450,
    230,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Rename',
    Boolean(selected) && !textInputOpen,
    () => beginSavedDeckRename(scene, state, dependencies),
    UI_FIELD.violet,
    false,
  );
  rename.setName('profile-folio-rename-hit');
  const archive = fieldButton(
    scene,
    () => {},
    x + 625,
    top + 450,
    230,
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
  const duplicate = fieldButton(
    scene,
    () => {},
    x + 125,
    top + 518,
    230,
    MIN_SUPPORTED_TOUCH_TARGET,
    'Fork Copy',
    Boolean(selected) && activeCount < SAVED_DECK_LIMIT && !textInputOpen,
    () => duplicateSelectedSavedDeck(scene, state, dependencies),
    UI_FIELD.cyan,
    false,
  );
  duplicate.setName('profile-folio-duplicate-hit');
  const copy = fieldButton(
    scene,
    () => {},
    x + 375,
    top + 518,
    230,
    MIN_SUPPORTED_TOUCH_TARGET,
    `Copy BSF${SAVED_DECK_CODE_VERSION}`,
    Boolean(selected) && !textInputOpen,
    () => copySelectedSavedDeckCode(scene, state, dependencies),
    UI_FIELD.violet,
    false,
  );
  copy.setName('profile-folio-copy-code-hit');
  if (state.savedDeckStatus === 'copying') copy.setData({statusLabel: 'Copying…', status: 'loading'});
  else if (state.savedDeckStatus === 'copyFailed') copy.setData({statusLabel: 'Copy failed · Retry', status: 'error'});
  const lab = fieldButton(
    scene,
    () => {},
    x + 625,
    top + 518,
    230,
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
  scene.add.text(x + 375, top + 253, 'YOUR PRESENTED FLOCK', {
    fontFamily: UI_FONT,
    fontSize: '20px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
  }).setResolution(2).setOrigin(0.5).setName('profile-showcase-title');
  if (entries.length === 0) {
    scene.add.rectangle(x + 375, top + 365, 750, 174, 0x0b1420, 0.88)
      .setStrokeStyle(1, UI_FIELD.violet, 0.52)
      .setName('profile-showcase-empty-frame');
    scene.add.text(
      x + 375,
      top + 365,
      'No cards presented yet.\n\nOpen a discovered card in the Codex,\nthen choose ADD TO SHOWCASE or press G / R3.',
      {
        fontFamily: UI_FONT,
        fontSize: '22px',
        color: UI_SOFT,
        align: 'center',
        lineSpacing: 6,
        wordWrap: { width: 1400 },
      },
    ).setResolution(2).setOrigin(0.5).setName('profile-showcase-empty');
  } else {
    entries.forEach((entry, index) => {
      const cx = x + 125 + index * 250;
      const cy = top + 389;
      scene.add.rectangle(cx, cy, 149, 222, 0x09111c, 0.96)
        .setStrokeStyle(2, UI_FIELD.violet, 0.76)
        .setName('profile-showcase-card-frame')
        .setData('cardId', entry.id);
      if (entry.artKey && scene.textures.exists(entry.artKey)) {
        scene.textures.get(entry.artKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
        scene.add.image(cx, cy, entry.artKey)
          .setDisplaySize(147, 220)
          .setName('profile-showcase-card-art')
          .setData('cardId', entry.id);
      } else {
        scene.add.text(cx, cy, entry.name, {
          fontFamily: UI_FONT,
          fontSize: '20px',
          fontStyle: UI_BOLD,
          color: UI_FIELD.warm,
          align: 'center',
          wordWrap: { width: 140 },
        }).setResolution(2).setOrigin(0.5);
      }
      scene.add.text(cx, top + 507, entry.name, {
        fontFamily: UI_FONT,
        fontSize: '22px',
        fontStyle: UI_BOLD,
        color: UI_FIELD.warm,
        align: 'center',
        fixedWidth: 234,
        wordWrap: { width: 234 },
        maxLines: 2,
      }).setResolution(2).setOrigin(0.5, 0).setName('profile-showcase-card-name').setData('cardId', entry.id);
      scene.add.text(cx, top + 568, `${entry.family} / ${entry.rarity}`, {
        fontFamily: UI_FONT,
        fontSize: '18px',
        fontStyle: UI_BOLD,
        color: UI_FIELD.cyanText,
        fixedWidth: 234,
        align: 'center',
        wordWrap: { width: 234 },
      }).setResolution(2).setOrigin(0.5, 0).setName('profile-showcase-card-meta').setData('cardId', entry.id);
    });
  }
  scene.add.text(x + 375, top + 617, `${entries.length}/${CARD_SHOWCASE_LIMIT} presented / identity only / no power`, {
    fontFamily: UI_FONT,
    fontSize: '20px',
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
  const page = Math.floor(state.flightLogIndex / FLIGHT_LOG_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(history.length / FLIGHT_LOG_PAGE_SIZE));
  const pageStart = page * FLIGHT_LOG_PAGE_SIZE;
  const pageEntries = history.slice(pageStart, pageStart + FLIGHT_LOG_PAGE_SIZE);
  const quantity = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
  scene.add.rectangle(640, 360, 1280, 720, 0x020408, 0.94)
    .setInteractive().setName('profile-flight-log-blocker');
  scene.add.rectangle(640, 360, 1160, 656, UI_FIELD.panel, 1)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.5).setName('profile-flight-log-panel');
  const text = (x: number, y: number, value: string, width: number, size = 21, color = UI_FIELD.text) =>
    scene.add.text(x, y, value, { fontFamily: UI_FONT, fontSize: size, color, resolution: 2,
      wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 3 });
  text(92, 58, 'Flight Log', 700, 32, UI_FIELD.warm).setName('profile-flight-log-title');
  quietButton(scene, { x: 1100, y: 82, width: 168, label: 'Back', name: 'profile-flight-log-close',
    onActivate: () => closeFlightLog(scene, state, dependencies) });
  text(92, 104, 'Your last 50 flights stay on this device and are included in backups.', 1096, 19, UI_SOFT);
  text(92, 134, `Tab: actions · ${controlBindingLabel('previous')} / ${controlBindingLabel('next')}: flight · PgUp / PgDn: page · ${controlBindingLabel('confirm')}: activate · ${controlBindingLabel('back')}: back`,
    1096, 19, UI_SOFT).setName('profile-flight-log-input-hint');
  scene.add.rectangle(307, 391, 430, 462, 0x07101a, 1).setName('profile-flight-log-list-panel');
  pageEntries.forEach((entry, index) => {
    const globalIndex = pageStart + index, y = 193 + index * 66;
    const selected = globalIndex === state.flightLogIndex;
    const row = scene.add.rectangle(307, y, 430, 58, selected ? 0x203b48 : 0x10212c, 1)
      .setStrokeStyle(selected ? 2 : 1, selected ? UI_FIELD.cyan : 0x344b5b)
      .setInteractive({ useHandCursor: true }).setName(`profile-flight-log-row-${globalIndex}`).setData('runId', entry.id)
      .setData('selected', selected)
      .on('pointerdown', () => {
        if (state.flightReviewLoading && state.flightLogIndex === globalIndex) return;
        state.flightReviewCancel?.();
        state.flightLogIndex = globalIndex;
        openSelectedFlight(scene, state, dependencies);
      });
    folioChoiceControl(row, `Review flight ${entry.seed}`);
    text(108, y - 24, `${entry.result === 'win' ? 'Win' : 'Loss'} · ${entry.difficulty} · ${entry.runMode === 'quick' ? 'Quick' : 'Full'}`, 398, 21,
      entry.result === 'win' ? '#a9f4b7' : '#ffb8ad').setName('profile-history-result');
    text(108, y + 3, `${entry.leader} · ${quantity(entry.deckSize, 'card')} · ${quantity(entry.stops, 'stop')}`, 398, 19, UI_SOFT)
      .setName('profile-history-row-detail');
  });
  const newer = quietButton(scene, { x: 158, y: 655, width: 132, label: 'Newer', name: 'profile-flight-log-page-newer',
    enabled: page > 0, onActivate: () => pageFlightHistory(scene, state, dependencies, -1) });
  const older = quietButton(scene, { x: 456, y: 655, width: 132, label: 'Older', name: 'profile-flight-log-page-older',
    enabled: page < pageCount - 1, onActivate: () => pageFlightHistory(scene, state, dependencies, 1) });
  newer.setData('page', Math.max(1, page)); older.setData('page', Math.min(pageCount, page + 2));
  [newer, older].forEach(hit => hit.getData('labelObject').setName('profile-history-page-action'));
  text(307, 655, `${page + 1} / ${pageCount}`, 130, 19, UI_SOFT).setOrigin(0.5).setName('profile-history-page-count');
  const selected = history[state.flightLogIndex];
  scene.add.rectangle(867, 434, 634, 500, 0x07101a, 1)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.3).setName('profile-flight-log-preview');
  if (!selected) {
    text(867, 410, 'No completed flights yet.', 560, 21, UI_SOFT).setOrigin(0.5);
  } else {
    const seconds = Math.max(0, Math.round(selected.durationMs / 1000));
    const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    text(578, 204, selected.result === 'win' ? 'Completed flight' : 'Scattered flight', 578, 26,
      selected.result === 'win' ? '#a9f4b7' : '#ffb8ad').setName('profile-history-result-title');
    const seed = text(578, 246, `Flight ${selected.seed}`, 578, 21, UI_FIELD.warm).setName('profile-history-seed');
    fitTextExcerpt(seed, `Flight ${selected.seed}`, 1);
    text(578, 280, `${selected.leader} · ${selected.difficulty} · ${selected.runMode === 'quick' ? 'Quick' : 'Full'}`, 578, 19, UI_SOFT);
    const rows = [
      ['Recorded', formatFlightDate(selected.completedAtMs)], ['Duration', duration],
      ['Cohesion', `${selected.currentCohesion}/${selected.maxCohesion}`], ['Beats', String(selected.turns)],
      ['Final deck', quantity(selected.deckSize, 'card')], ['Route', quantity(selected.stops, 'stop')],
      ['Waymarks', String(selected.waymarks)], ['Supplies used', String(selected.supplies)],
    ];
    rows.forEach(([label, value], i) => {
      text(578, 324 + i * 32, label, 230, 19, UI_SOFT).setName('profile-history-stat-label');
      text(1156, 324 + i * 32, value, 330).setOrigin(1, 0).setName('profile-history-stat-value');
    });
    const failed = !state.flightReviewLoading && Boolean(state.flightLogMessage);
    text(578, 588, state.flightLogMessage || 'Review the full deck, route and decisions.', 578, 19,
      failed ? '#ffb8ad' : UI_SOFT).setName('profile-history-message');
    const review = quietButton(scene, { x: 867, y: 650, width: 578, label: 'Review flight', kind: 'primary', name: 'profile-history-review',
      onActivate: () => openSelectedFlight(scene, state, dependencies) });
    review.setData('statusLabel', state.flightReviewLoading ? 'Opening review…' : 'Retry review')
      .setData('status', state.flightReviewLoading ? 'loading' : failed ? 'error' : 'idle');
  }

  if (state.flightReview) {
    const root = scene.add.container(0, 0).setName('profile-flight-review-root');
    renderOutcomeFlightDetails(scene, root, state.flightReview.details, {
      title: 'Recorded Flight',
      identity: state.flightReview,
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
  scene: Phaser.Scene, state: ProfileViewState, dependencies: ProfileSceneDependencies,
  options: ReturnType<typeof savedDeckTemplateOptions>,
) {
  const selectedIndex = Phaser.Math.Clamp(state.savedDeckTemplateIndex ?? 0, 0, options.length - 1);
  const selected = options[selectedIndex];
  scene.add.rectangle(640, 360, 1280, 720, 0x02050a, 0.94).setInteractive().setName('profile-folio-template-blocker');
  scene.add.rectangle(640, 360, 1160, 656, UI_FIELD.panel, 1)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.5).setName('profile-folio-template-frame');
  folioReaderText(scene, 92, 58, 'Build a starter Folio', 1096, 32, UI_FIELD.warm).setName('profile-folio-template-title');
  folioReaderText(scene, 92, 110, 'Use cards you already own. Building a Folio never grants cards or changes collection history.',
    1096, UI_TYPE.secondary, UI_SOFT).setName('profile-folio-template-subtitle');
  folioReaderText(scene, 92, 157, 'Choose a leader', 624, UI_TYPE.primary, UI_FIELD.warm);
  folioReaderText(scene, 760, 157, 'Before you build', 428, UI_TYPE.primary, UI_FIELD.warm);
  options.forEach((option, index) => {
    const y = 222 + index * 78, focused = index === selectedIndex;
    const hit = scene.add.rectangle(404, y, 624, 70, focused ? 0x173247 : 0x0b1420, 1)
      .setStrokeStyle(focused ? 3 : 1, focused ? UI_FIELD.gold : UI_FIELD.cyan, focused ? 1 : 0.5)
      .setInteractive({ useHandCursor: true }).setName('profile-folio-template-row')
      .setData('leaderId', option.leader.id).setData('index', index)
      .setData('available', option.available).setData('missing', option.missing).setData('focused', focused);
    hit.on('pointerdown', () => {
      state.savedDeckTemplateIndex = index; state.savedDeckStatus = 'idle';
      dependencies.playUiSound('confirm'); renderProfileScene(scene, state, dependencies);
    });
    folioChoiceControl(hit, `Review ${option.leader.name} starter`);
    folioReaderText(scene, 110, y - 26, option.leader.name, 370, UI_TYPE.primary,
      focused ? UI_FIELD.warm : UI_FIELD.text).setName('profile-folio-template-leader').setData('leaderId', option.leader.id);
    folioReaderText(scene, 110, y + 3, `${option.leader.bird} · ${option.leader.suit}`, 580, UI_TYPE.secondary, UI_SOFT);
    folioReaderText(scene, 696, y - 26, option.available ? 'Ready' : !option.unlocked ? 'Locked' : 'Unavailable',
      180, UI_TYPE.secondary, option.available ? '#b9ffdb' : '#ffd7a0').setOrigin(1, 0);
  });
  const title = folioReaderText(scene, 760, 202, selected?.leader.name ?? 'No starter available', 428,
    UI_TYPE.title, UI_FIELD.warm).setName('profile-folio-template-selected');
  fitTextExcerpt(title, title.text, 2);
  folioReaderText(scene, 760, 278,
    selected ? `${selected.owned}/${selected.leader.startingDeckIds.length} starter cards owned` : 'No starter cards',
    428, UI_TYPE.primary).setName('profile-folio-template-owned');
  folioReaderText(scene, 760, 316, selected?.reason ?? 'Choose a leader template.', 428,
    UI_TYPE.primary, selected?.available ? '#b9ffdb' : '#ffd7a0').setName('profile-folio-template-reason');
  const missingNames = [...new Set(selected?.missingNames ?? [])];
  const detail = state.savedDeckStatus === 'failed'
    ? 'Could not save. No Folio was created and your collection is unchanged. Try again.'
    : selected?.available
      ? 'Creates a new Full Flight Folio using Base cards. Tune, rename, archive or launch it afterward.'
      : selected?.reason === 'Active Folios full'
        ? 'Archive an existing Folio to make room. Your archived Folios remain available in the library.'
        : selected && !selected.unlocked
          ? 'Unlock this leader before building their starter. The Flock Record shows the unlock requirement.'
          : missingNames.length
            ? `Still to claim: ${missingNames.join(', ')}. Repeated starter copies use the same ownership unlock.`
            : 'Choose a leader to review its requirements.';
  const body = folioReaderText(scene, 760, 358, detail, 428, UI_TYPE.secondary,
    state.savedDeckStatus === 'failed' ? '#ffb8ad' : UI_SOFT).setName('profile-folio-template-detail');
  fitTextExcerpt(body, detail, 8);
  quietButton(scene, { x: 300, y: 622, width: 390, label: 'Build Folio', name: 'profile-folio-template-build-hit',
    kind: selected?.available ? 'primary' : 'secondary', enabled: Boolean(selected?.available),
    onActivate: () => createSavedDeckFromTemplate(scene, state, dependencies) })
    .setData('leaderId', selected?.leader.id ?? null).setData('available', selected?.available ?? false);
  quietButton(scene, { x: 980, y: 622, width: 390, label: 'Back to Folios', name: 'profile-folio-template-cancel-hit',
    onActivate: () => closeSavedDeckTemplate(scene, state, dependencies) });
  folioReaderText(scene, 92, 661,
    `Tab / D-pad left/right: focus · Up/down: browse · ${controlBindingLabel('confirm')} / A: activate · ${controlBindingLabel('back')} / B: back`,
    1096, UI_TYPE.secondary, UI_SOFT).setName('profile-folio-template-input-hint');
}

function renderSaveDataOverlay(
  scene: Phaser.Scene,
  state: ProfileViewState,
  dependencies: ProfileSceneDependencies,
  playtestMode: boolean,
  playtestRunCount: number,
) {
  scene.add.rectangle(640, 360, 1280, 720, 0x020408, 0.94)
    .setInteractive().setName('profile-save-data-blocker');
  scene.add.rectangle(640, 360, 1040, 640, UI_FIELD.panel, 1)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.5).setName('profile-save-data-panel');
  const text = (x: number, y: number, value: string, width = 920, size = 21, color = UI_FIELD.text) =>
    scene.add.text(x, y, value, { fontFamily: UI_FONT, fontSize: size, color, resolution: 2,
      wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 4 }).setName('profile-save-copy');
  const action = (x: number, y: number, width: number, label: string, name: string, focus: ProfileFocus,
    onActivate: () => void, enabled = true) => quietButton(scene, {
      x, y, width, label, name, focused: state.focus === focus, enabled,
      kind: focus === 'restoreConfirm' ? 'destructive' : focus === 'restoreCancel' || focus === 'saveDownload' ? 'primary' : 'secondary',
      onActivate: () => {
        if (!playtestFocusKey[focus]) dependencies.playUiSound(focus === 'restoreCancel' ? 'close' : 'confirm');
        onActivate();
      },
    }).setData('profileFocus', focus);
  text(156, 68, 'Save Data', 760, 32, UI_FIELD.warm).setName('profile-save-data-title');
  quietButton(scene, { x: 1060, y: 94, width: 140, label: 'Back', name: 'profile-save-close',
    onActivate: () => {
      dependencies.playUiSound('close');
      if (state.pendingRestore) cancelSaveRestore(scene, state, dependencies);
      else closeSaveData(scene, state, dependencies);
    } });
  const split = playtestMode && !state.pendingRestore;
  text(156, 122, 'Keep a local copy of your flock record, active flight, tutorial progress, controls and settings.',
    split ? 440 : 928, 19, UI_SOFT);
  text(156, 640, `${controlBindingLabel('previous')} / ${controlBindingLabel('next')}: navigate · ${controlBindingLabel('confirm')}: select · ${controlBindingLabel('back')}: close`,
    928, 19, UI_SOFT).setName('profile-save-input-hint');
  if (state.pendingRestore) {
    const pending = state.pendingRestore;
    text(156, 206, 'Backup ready to restore', 928, 26, UI_FIELD.cyanText);
    text(156, 256, [
      `${pending.runs} runs · ${pending.wins} wins · ${pending.leaders} leaders unlocked`,
      pending.activeRun ? 'Includes an active flight checkpoint' : 'No active flight checkpoint',
      `Created ${formatBackupDate(pending.exportedAt)}`,
    ].join('\n'), 928).setName('profile-save-restore-summary');
    text(156, 390, 'Restoring replaces Bird Squad save data and settings on this device. Other site data is left alone.',
      928, 21, '#ffcf9e').setName('profile-save-restore-warning');
    action(470, 556, 300, 'Confirm Restore', 'profile-save-restore-confirm-hit', 'restoreConfirm',
      () => confirmSaveRestore(scene, state, dependencies));
    action(810, 556, 260, 'Cancel', 'profile-save-restore-cancel-hit', 'restoreCancel',
      () => cancelSaveRestore(scene, state, dependencies));
    return;
  }
  action(split ? 370 : 420, 260, split ? 428 : 380, 'Download Backup',
    'profile-save-download-hit', 'saveDownload', () => downloadFullSave(scene, state, dependencies));
  const restore = action(split ? 370 : 860, split ? 336 : 260, split ? 428 : 380, 'Restore Backup',
    'profile-save-restore-file-hit', 'saveRestore', () => selectSaveToRestore(scene, state, dependencies));
  if (state.saveFileCancel) restore.setData('statusLabel', 'Reading backup…').setData('status', 'loading');
  else if (state.focus === 'saveRestore' && ['invalid', 'restoreFailed'].includes(state.saveDataStatus))
    restore.setData({statusLabel: 'Retry Restore Backup', status: 'error'});
  const statusColor = state.saveDataStatus === 'invalid' || state.saveDataStatus === 'restoreFailed'
    ? '#ffb8ad' : state.saveDataStatus === 'restored' ? '#a9f4b7' : UI_FIELD.cyanText;
  text(split ? 156 : 196, split ? 398 : 334,
    state.saveDataMessage || 'Backups stay on your device. Nothing is uploaded.',
    split ? 428 : 888, 21, statusColor).setName('profile-save-data-status');
  if (playtestMode) {
    scene.add.rectangle(624, 370, 1, 442, 0x496471, 0.6);
    text(660, 154, 'Latest run ratings', 464, 21, UI_FIELD.warm).setName('profile-playtest-rating-header');
    const latest = state.playtestRunId
      ? `${state.playtestRunResult === 'win' ? 'Win' : 'Loss'} · Run ${state.playtestRunId.split('-').at(-1) ?? state.playtestRunId}`
      : 'Complete a run to enable ratings.';
    const latestLabel = text(660, 190, latest, 464, 19, UI_SOFT).setName('profile-playtest-latest-run');
    fitTextExcerpt(latestLabel, latest, 2);
    const ratings: Array<{ key: PlaytestRatingKey; label: string; focus: ProfileFocus }> = [
      { key: 'fun', label: 'Fun', focus: 'playtestFun' }, { key: 'fairness', label: 'Fair', focus: 'playtestFairness' },
      { key: 'clarity', label: 'Clear', focus: 'playtestClarity' }, { key: 'replay', label: 'Replay', focus: 'playtestReplay' },
    ];
    ratings.forEach(({ key, label, focus }, index) => {
      const y = 268 + index * 66, enabled = Boolean(state.playtestRunId), selected = state.playtestFeedback[key];
      scene.add.rectangle(894, y, 472, 58, 0x10212c, 0.35)
        .setName(`profile-playtest-feedback-${key}-track`).setData('ratingKey', key);
      action(726, y, 140, label, `profile-playtest-feedback-${key}-row`, focus,
        () => setPlaytestRating(scene, state, dependencies, key, ((selected ?? 0) % 5) + 1), enabled);
      for (let rating = 1; rating <= 5; rating++) {
        quietButton(scene, { x: 833 + (rating - 1) * 66, y, width: 58, label: String(rating),
          name: `profile-playtest-feedback-${key}-${rating}`, enabled, selected: selected === rating,
          onActivate: () => setPlaytestRating(scene, state, dependencies, key, rating) })
          .setData('profileFocus', focus).setData('fullLabel', `${label}: ${rating} of 5`);
      }
    });
    action(894, 548, 464, `Export ${playtestRunCount} Run${playtestRunCount === 1 ? '' : 's'}`,
      'profile-playtest-export-hit', 'playtestExport', () => exportPlaytestHistory(scene, state, dependencies), playtestRunCount > 0);
    text(660, 590, playtestStatusText(state, playtestRunCount), 464, 19,
      state.playtestExportStatus === 'failed' || state.playtestFeedbackStatus === 'failed' ? '#ffb8ad' : UI_SOFT)
      .setName('profile-playtest-export-status');
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
    return row;
  }
  return scene.add.rectangle(cx, cy, width, height, active ? 0x111a25 : 0x0d141d, 0.9)
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
