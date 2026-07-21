import Phaser from 'phaser';
import { alphaCardSet } from './runtime-data';
import { difficultyLabel } from './difficulty';
import { flockLeaders } from './leaders';
import { achievements, isLeaderUnlocked, leaderMastery, loadAccount, type PlayerAccount } from './meta';
import { bindControlActions, controlBindingLabel } from './input-bindings';
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

type ProfileBadgeView = 'achievements' | 'contracts';
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
export type ProfileFocus =
  | 'achievements'
  | 'contracts'
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
  focus: ProfileFocus;
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
  latestPlaytestRun: () => LatestPlaytestRun | undefined;
  saveLatestPlaytestFeedback: (feedback: PlaytestExperienceFeedback) => boolean;
  saveData: SaveBackupRuntimeDependencies;
  killTweensForScene: (scene: Phaser.Scene) => void;
  playUiSound: (kind?: 'confirm' | 'close' | 'locked') => void;
  prefersReducedMotion: () => boolean;
  queueUiIconAssets: (
    scene: Phaser.Scene,
    ids: readonly string[],
    warning: string,
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
  if (!state.saveDataOpen) return ['achievements', 'contracts', 'return', 'saveData'];
  if (state.pendingRestore) return ['restoreConfirm', 'restoreCancel'];
  const order: ProfileFocus[] = ['saveDownload', 'saveRestore'];
  if (playtestExportEnabled()) {
    if (state.playtestRunId) order.push('playtestFun', 'playtestFairness', 'playtestClarity', 'playtestReplay');
    order.push('playtestExport');
  }
  return order;
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
  if (state.focus === 'achievements' || state.focus === 'contracts') {
    state.badgeView = state.focus;
    renderProfileScene(scene, state, dependencies);
  } else if (state.focus === 'return') scene.scene.start('MenuScene');
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
    if (state.saveDataOpen) {
      dependencies.playUiSound('close');
      closeSaveData(scene, state, dependencies);
      return;
    }
    dependencies.playUiSound('close');
    scene.scene.start('MenuScene');
  };
  const toggleMute = () => {
    dependencies.audio.toggleMute();
    scene.scene.restart();
  };
  bindControlActions(scene, {
    back: returnToMenu,
    previous: () => cycleProfileFocus(scene, state, dependencies, -1),
    next: () => cycleProfileFocus(scene, state, dependencies, 1),
    confirm: () => activateProfileFocus(scene, state, dependencies),
    mute: toggleMute,
    fullscreen: () => scene.scale.toggleFullscreen(),
  });
  const onTab = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    cycleProfileFocus(scene, state, dependencies, event.shiftKey ? -1 : 1);
  };
  const onGamepadDown = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
    if (button.index === 12 || button.index === 14) cycleProfileFocus(scene, state, dependencies, -1);
    else if (button.index === 13 || button.index === 15) cycleProfileFocus(scene, state, dependencies, 1);
    else if (button.index === 0) activateProfileFocus(scene, state, dependencies);
    else if (button.index === 1) returnToMenu();
  };
  scene.input.keyboard?.on('keydown-TAB', onTab);
  scene.input.gamepad?.on('down', onGamepadDown);
  scene.events.once('shutdown', () => {
    scene.input.keyboard?.off('keydown-TAB', onTab);
    scene.input.gamepad?.off('down', onGamepadDown);
  });

  dependencies.queueUiIconAssets(scene, profileUiIconIds, 'Profile UI', () => {
    if (scene.scene.isActive()) renderProfileScene(scene, state, dependencies);
  });
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
  scene.cameras.main.fadeIn(200);
  scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash')
    .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
    .setAlpha(0.52);
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.74);

  const account = loadAccount();
  const leaderCount = flockLeaders.filter((leader) => isLeaderUnlocked(account, leader.id)).length;
  const earned = account.achievements;
  const discovered = account.discoveredCards.length;
  const cardTotal = alphaCardSet.cards.length;
  const winRate = account.runs > 0 ? Math.round((account.wins / account.runs) * 100) : 0;
  const leaderRecordRows = flockLeaders.map((leader) => ({
    id: leader.id,
    name: leader.name,
    unlocked: isLeaderUnlocked(account, leader.id),
    ...leaderPersonalRecord(account, leader.id),
  }));
  const playtestMode = playtestExportEnabled();
  const playtestRuns = playtestRunPayload(dependencies.exportRunHistory()) ?? [];
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
      achievementTotal: achievements.length,
      contractBadges: account.contractBadges.length,
      discoveredCards: discovered,
      cardTotal,
    },
    badgeView: state.badgeView,
    focus: {
      current: state.focus,
      order: focusOrder,
      previous: controlBindingLabel('previous'),
      next: controlBindingLabel('next'),
      confirm: controlBindingLabel('confirm'),
      back: controlBindingLabel('back'),
    },
    contractBadges: [...account.contractBadges],
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
  renderProgressRail(scene, frame.left + 44, frame.top + 244, 304, 'Achievements', earned.length, achievements.length, UI_FIELD.brass);
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
  renderProfileSectionTabFrame(scene, badgeX + 146, frame.top + 210, 300, UI_FIELD.brass);
  const tabs: Array<{ view: ProfileBadgeView; x: number; label: string }> = [
    { view: 'achievements', x: badgeX + 88, label: 'Achievements' },
    { view: 'contracts', x: badgeX + 222, label: `Contracts ${account.contractBadges.length}` },
  ];
  tabs.forEach((tab) => {
    const selected = state.badgeView === tab.view;
    const focused = state.focus === tab.view;
    const hit = scene.add.rectangle(tab.x, frame.top + 210, 124, 56, selected ? 0x183451 : 0x0d1420, 0.94)
      .setStrokeStyle(focused ? 3 : 1, focused ? UI_FIELD.cyan : selected ? UI_FIELD.gold : UI_FIELD.cyan, focused ? 0.98 : selected ? 0.86 : 0.34)
      .setInteractive({ useHandCursor: true });
    scene.add.text(tab.x, frame.top + 210, tab.label, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: selected ? UI_GOLD : UI_SOFT,
    }).setResolution(2).setOrigin(0.5);
    hit.on('pointerdown', () => {
      state.focus = tab.view;
      if (state.badgeView === tab.view) return;
      dependencies.playUiSound('confirm');
      state.badgeView = tab.view;
      renderProfileScene(scene, state, dependencies);
    });
  });

  const visibleBadges = state.badgeView === 'achievements'
    ? achievements.map((achievement) => ({
        id: achievement.id,
        name: achievement.name,
        description: achievement.desc,
        earned: earned.includes(achievement.id),
      }))
    : account.contractBadges.map((badge) => {
        const [mapIndexText, id] = badge.split(':');
        const definition = dependencies.districtContracts.find((candidate) => candidate.id === id);
        return {
          id: badge,
          name: definition?.name ?? id,
          description: `District ${Number(mapIndexText) + 1} / ${definition?.goal ?? 'Contract complete'}`,
          earned: true,
        };
      });
  if (visibleBadges.length === 0) {
    scene.add.text(badgeX + 150, frame.top + 286, 'Complete a district contract to place its mark here.', {
      fontFamily: UI_FONT,
      fontSize: '13px',
      color: UI_MUTED,
      fixedWidth: 270,
      align: 'center',
      wordWrap: { width: 270 },
    }).setOrigin(0.5);
  }
  visibleBadges.slice(0, 8).forEach((badge, index) => {
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
    scene.add.text(frame.left + 36, frame.bottom - 47, `${controlBindingLabel('previous')} / ${controlBindingLabel('next')}: Navigate\n${controlBindingLabel('confirm')}: Select`, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.cyanText,
      lineSpacing: 3,
    }).setResolution(2).setName('profile-input-hint');
  }
  if (state.saveDataOpen) renderSaveDataOverlay(scene, state, dependencies, playtestMode, playtestRuns.length);
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
  const panel = dependencies.renderFieldPanel(scene, () => {}, GAME_WIDTH / 2, 360, 700, expanded ? 560 : 340, {
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
    scene.add.rectangle(panel.cx, panel.top + 280, 574, 1, UI_FIELD.cyan, 0.34);
    scene.add.text(panel.left + 64, panel.top + 296, 'PLAYTEST EXPERIENCE / LATEST RUN', {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.muted,
    }).setResolution(2);
    const latestLabel = state.playtestRunId
      ? `${state.playtestRunResult === 'win' ? 'WIN' : 'LOSS'}  |  ${state.playtestRunId}`
      : 'Complete a run, then return here to rate it.';
    scene.add.text(panel.right - 64, panel.top + 296, latestLabel, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: state.playtestRunId ? UI_FIELD.cyanText : UI_FIELD.muted,
      fixedWidth: 390,
      align: 'right',
    }).setResolution(2).setOrigin(1, 0).setName('profile-playtest-latest-run');

    const ratingRows: Array<{ key: PlaytestRatingKey; label: string; focus: ProfileFocus }> = [
      { key: 'fun', label: 'Fun', focus: 'playtestFun' },
      { key: 'fairness', label: 'Fair', focus: 'playtestFairness' },
      { key: 'clarity', label: 'Clear', focus: 'playtestClarity' },
      { key: 'replay', label: 'Replay', focus: 'playtestReplay' },
    ];
    ratingRows.forEach(({ key, label, focus }, index) => {
      const y = panel.top + 340 + index * 38;
      const enabled = Boolean(state.playtestRunId);
      const focused = state.focus === focus;
      const selected = state.playtestFeedback[key];
      const rowHit = scene.add.rectangle(panel.cx, y, 574, 32, 0x0b1420, focused ? 0.94 : 0.68)
        .setStrokeStyle(1, focused ? UI_FIELD.cyan : 0x344b5b, focused ? 0.88 : 0.45)
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
        const x = panel.right - 246 + (rating - 1) * 43;
        const chosen = selected === rating;
        const chip = scene.add.rectangle(x, y, 34, 24, chosen ? UI_FIELD.violet : 0x141b22, chosen ? 0.92 : 0.86)
          .setStrokeStyle(1, chosen ? 0xf0d8ff : 0x66798a, chosen ? 0.95 : 0.6)
          .setName(`profile-playtest-feedback-${key}-${rating}`);
        scene.add.text(x, y - 6, `${rating}`, {
          fontFamily: UI_FONT,
          fontSize: '11px',
          fontStyle: UI_BOLD,
          color: enabled ? (chosen ? '#ffffff' : UI_SOFT) : '#596a78',
        }).setResolution(2).setOrigin(0.5, 0);
        if (enabled) {
          chip.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
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
      panel.top + 510,
      230,
      44,
      `Export ${playtestRunCount} Run${playtestRunCount === 1 ? '' : 's'}`,
      playtestRunCount > 0,
      () => exportPlaytestHistory(scene, state, dependencies),
      UI_FIELD.violet,
    );
    exportHit.setName('profile-playtest-export-hit');
    renderProfileFocusRing(scene, exportHit, state.focus === 'playtestExport', 'playtestExport');
    scene.add.text(panel.cx, panel.top + 539, playtestStatusText(state, playtestRunCount), {
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
  const hit = scene.add.rectangle(cx, cy, width, height, 0x000000, 0.01).setInteractive({ useHandCursor: true });
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
