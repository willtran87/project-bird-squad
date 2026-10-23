import { replayFirstFlightGuide, skipFirstFlightGuide } from './first-flight-guide';
import { showDownloadRecovery } from '../update-recovery';
import { pendingOverlay } from './pending-overlay';
import {
  GAME_WIDTH,
  UI_BOLD,
  UI_FONT,
  birdAudio,
  firstFlightGuideState,
  getLeader,
  isLeaderUnlocked,
  leaderUnlockHints,
  loadCodexSceneModule,
  playUiSound,
  queueUiIconAssets,
  registerCodexScene,
  renderHowToPlayOverlay,
  renderSettingsMenuOverlay,
  menuSettingsUiIconIds,
  setAnimationPacePreference,
  setColorCuePreference,
  setCombatPacePreference,
  setFlashEffectsPreference,
  setGraphicsQualityPreference,
  setMotionPreference,
  setScreenReaderPreference,
  setScreenShakePreference,
  setTextPacePreference,
  setVisualContrastPreference,
} from '../main';

/** Decorative portraits load only after opening setup; labels and controls never wait. */
export async function renderSetupLeaderPortraits(scene: any) {
  const generation = scene.menuGeneration;
  const module = await import('./setup-portraits');
  if (scene.scene.isActive() && scene.menuGeneration === generation && scene.setupOpen) module.renderSetupPortraits(scene);
}

/** Non-blocking saved-flight context; never creates a second entry action. */
export function renderResumeContext(scene: any, run: {
  leaderId?: string; pendingDistrictPreens?: number; completedRouteNodeIds: string[];
  pendingCombatReward?: { stage: string };
}, district: { name: string; bossNodeId: string }) {
  scene.children.getByName('title-resume-context')?.destroy();
  const next = run.pendingCombatReward ? 'Rewards ready · fight cleared' : run.pendingDistrictPreens ? 'Free Preen ready'
    : run.completedRouteNodeIds.includes(district.bossNodeId) ? 'District cleared' : 'Reach the boss';
  scene.add.text(260, 316, `${getLeader(run.leaderId).name}\n${district.name} · ${next}`, {
    fontFamily: UI_FONT, fontSize: '20px', color: '#bfcbd0', align: 'center',
    wordWrap: { width: 410 }, lineSpacing: 5,
  }).setResolution(2).setOrigin(0.5, 0).setName('title-resume-context').setVisible(!scene.setupOpen);
  scene.updateMenuTextState();
}

export function openCodex(scene: any, openCollectionAtlas = false, openCardId?: string) {
  if (scene.codexOpening) return;
  scene.codexOpening = true;
  const game = scene.game;
  pendingOverlay(scene, object => (object as any).setDepth(120), loadCodexSceneModule,
    module => {
      registerCodexScene(game, module);
      game.scene.getScene('MenuScene').scene.start('CodexScene', { openCollectionAtlas, openCardId });
    }, () => {
      scene.codexOpening = false;
      scene.updateMenuTextState();
    });
}

export function openSettingsOverlay(scene: any, queueAssets = true) {
  if (scene.settingsOverlay) return;
  scene.hideLeaderTooltip();
  if (scene.helpOverlay) scene.closeHelpOverlay();
  if (queueAssets) {
    queueUiIconAssets(scene, menuSettingsUiIconIds, 'Title Settings UI', () => {
      if (scene.scene.isActive() && scene.settingsOverlay?.active
        && !scene.settingsOverlay.list.some((child: any) => child.name === 'pending-overlay')) refreshSettingsOverlay(scene, false);
    });
  }
  const overlay = scene.add.container(0, 0).setDepth(80);
  scene.settingsOverlay = overlay;
  scene.menuFocusRing?.setVisible(false);
  const update = (set: (value: any) => void) => (value: any) => { set(value); refreshSettingsOverlay(scene); };
  renderSettingsMenuOverlay(scene, (obj) => overlay.add(obj), {
    title: 'Settings',
    subtitle: 'Title controls',
    onClose: () => scene.closeSettingsOverlay(),
    onToggleAudio: () => scene.updateMenuTextState(),
    onSetMusicVolume: (value) => { birdAudio.setMusicVolume(value); refreshSettingsOverlay(scene); },
    onSetSfxVolume: (value) => { birdAudio.setSfxVolume(value); refreshSettingsOverlay(scene); },
    onSetVoiceVolume: (value) => { birdAudio.setVoiceVolume(value); refreshSettingsOverlay(scene); },
    onSetAmbienceVolume: (value) => { birdAudio.setAmbienceVolume(value); refreshSettingsOverlay(scene); },
    onSetMotionPreference: (value) => { setMotionPreference(value); scene.syncHomeParticles(); refreshSettingsOverlay(scene); },
    onSetVisualContrastPreference: update(setVisualContrastPreference),
    onSetColorCuePreference: update(setColorCuePreference),
    onSetScreenShakePreference: update(setScreenShakePreference),
    onSetFlashEffectsPreference: update(setFlashEffectsPreference),
    onSetGraphicsQualityPreference: (value) => { setGraphicsQualityPreference(value); scene.syncHomeParticles(); refreshSettingsOverlay(scene); },
    onSetCombatPacePreference: update(setCombatPacePreference),
    onSetAnimationPacePreference: (value) => { setAnimationPacePreference(scene, value); refreshSettingsOverlay(scene); },
    onSetTextPacePreference: update(setTextPacePreference),
    onSetScreenReaderPreference: update(setScreenReaderPreference),
    onToggleFullscreen: () => scene.scale.toggleFullscreen(),
  });
  scene.updateMenuTextState();
}

export function openHelpOverlay(scene: any, _queueAssets = true, initialFocus = 0) {
  if (scene.helpOverlay) return;
  scene.hideLeaderTooltip();
  if (scene.settingsOverlay) scene.closeSettingsOverlay();
  // This quiet guide has no image controls. A decorative download must not
  // rebuild its pending/error panel or steal the player's focused action.
  const overlay = scene.add.container(0, 0).setDepth(80);
  scene.helpOverlay = overlay;
  scene.menuFocusRing?.setVisible(false);
  renderHowToPlayOverlay(scene, (obj) => overlay.add(obj), {
    initialFocus,
    onClose: () => scene.closeHelpOverlay(),
    guide: firstFlightGuideState(),
    onGuideAction: () => toggleFirstFlightGuide(scene),
    onPractice: () => {
      if (overlay.getData('practiceFailed')) { showDownloadRecovery(); return; }
      if (overlay.getData('practiceLoading')) return;
      overlay.setData('practiceLoading', true);
      const control = overlay.list.find((child: any) => child.getData('label') === 'Practice lessons');
      control?.setData('statusLabel', 'Opening lessons…').setData('status', 'loading');
      const failed = () => {
        if (!overlay.active) return;
        overlay.setData('practiceFailed', true);
        const text = 'Lessons are unavailable. Close to keep playing, or review recovery options before reloading.';
        overlay.setData('topic', text);
        overlay.list.find((child: any) => child.name === 'guide-download-status')?.setText(text);
        control?.setData('statusLabel', 'Recovery options').setData('status', 'error');
        scene.updateMenuTextState();
      };
      const timeout = setTimeout(failed, 8000);
      overlay.once('destroy', () => clearTimeout(timeout));
      void import('./practice-lessons').then(module => {
        clearTimeout(timeout);
        if (scene.scene.isActive() && scene.helpOverlay === overlay) module.openPracticeLessons(scene);
      }).catch(() => {
        clearTimeout(timeout);
        if (!overlay.active) return;
        overlay.setData('practiceLoading', false);
        failed();
        playUiSound('locked');
        scene.updateMenuTextState();
      });
    },
  });
  scene.updateMenuTextState();
}

function refreshHelpOverlay(scene: any, overlay: any) {
  if (!scene.scene.isActive() || scene.helpOverlay !== overlay || !overlay.active) return;
  const index = overlay.list.find((child: any) => child.name === 'how-to-play-actions')?.getData('actionFocus')?.index ?? 0;
  scene.closeHelpOverlay();
  openHelpOverlay(scene, false, index);
}

function refreshSettingsOverlay(scene: any, queueAssets = true) {
  const overlay = scene.settingsOverlay;
  scene.time.delayedCall(16, () => {
    if (!scene.scene.isActive() || !overlay?.active || scene.settingsOverlay !== overlay) return;
    scene.closeSettingsOverlay();
    openSettingsOverlay(scene, queueAssets);
  });
}

export function toggleFirstFlightGuide(scene: any) {
  const overlay = scene.helpOverlay;
  const guide = firstFlightGuideState();
  if (guide.enabled && !guide.completed) skipFirstFlightGuide();
  else replayFirstFlightGuide();
  playUiSound('confirm');
  scene.time.delayedCall(16, () => {
    refreshHelpOverlay(scene, overlay);
  });
}

export function showLeaderTooltip(scene: any, id: string, _anchorX: number) {
  if (scene.settingsOverlay || scene.helpOverlay || !scene.setupOpen) return;
  scene.hideLeaderTooltip();
  const leader = getLeader(id);
  const unlocked = isLeaderUnlocked(scene.menuAccount, leader.id);
  const tooltip = scene.add.container(GAME_WIDTH / 2, 350).setDepth(100);
  const title = scene.add.text(0, -24, unlocked
    ? `${leader.name} - ${leader.suit} / ${leader.bird}`
    : `${leader.name} - Locked`, {
    fontFamily: UI_FONT,
    fontSize: '21px',
    fontStyle: UI_BOLD,
    color: unlocked ? '#dfc18b' : '#a4b6c2',
    align: 'center',
    wordWrap: { width: 1080 },
  }).setResolution(2).setOrigin(0.5).setName('title-leader-description-title');
  const body = scene.add.text(0, 0, unlocked
    ? `${leader.blurb} Signature: ${leader.signatureName} - ${leader.signatureText}`
    : leaderUnlockHints[leader.id] ?? 'Locked', {
    fontFamily: UI_FONT,
    fontSize: '21px',
    color: unlocked ? '#c5d1d8' : '#a4b6c2',
    align: 'center',
    wordWrap: { width: 1080 },
  }).setResolution(2).setOrigin(0.5, 0).setName('title-leader-description-body');
  body.setLineSpacing(2);
  tooltip.add([title, body]);
  scene.leaderTooltip = tooltip;
  scene.updateMenuTextState();
}
