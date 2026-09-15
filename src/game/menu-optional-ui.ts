import { replayFirstFlightGuide, skipFirstFlightGuide } from './first-flight-guide';
import {
  GAME_WIDTH,
  LAZY_LOAD_FAILED,
  UI_BOLD,
  UI_FONT,
  UI_GOLD,
  birdAudio,
  firstFlightGuideState,
  getLeader,
  isLeaderUnlocked,
  leaderUnlockHints,
  howToPlayUiIconIds,
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
  uiIconAssets,
} from '../main';

/** Non-blocking saved-flight context; never creates a second entry action. */
export function renderResumeContext(scene: any, run: {
  leaderId?: string; pendingDistrictPreens?: number; completedRouteNodeIds: string[];
}, district: { name: string; bossNodeId: string }) {
  scene.children.getByName('title-resume-context')?.destroy();
  const next = run.pendingDistrictPreens ? 'Free Preen ready'
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
  const notice = scene.add.text(GAME_WIDTH - 240, 72, 'Opening Codex…', {
    fontFamily: UI_FONT,
    fontSize: '12px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
    stroke: '#05070c',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(120).setName('codex-scene-loading');
  void loadCodexSceneModule()
    .then((module) => {
      registerCodexScene(game, module);
      if (!game.scene.isActive('MenuScene')) return;
      if (notice.active) notice.destroy();
      game.scene.getScene('MenuScene').scene.start('CodexScene', { openCollectionAtlas, openCardId });
    })
    .catch((error) => {
      console.warn(LAZY_LOAD_FAILED, error);
      if (!scene.sys.settings.active) return;
      scene.codexOpening = false;
      notice.setText('Codex unavailable · click to retry').setColor('#ffb09a');
      scene.time.delayedCall(2400, () => notice.destroy());
    });
}

export function openSettingsOverlay(scene: any, queueAssets = true) {
  if (scene.settingsOverlay) return;
  scene.hideLeaderTooltip();
  if (scene.helpOverlay) scene.closeHelpOverlay();
  if (queueAssets) {
    queueUiIconAssets(scene, menuSettingsUiIconIds, 'Title Settings UI', () => {
      if (scene.scene.isActive() && scene.settingsOverlay?.active) refreshSettingsOverlay(scene, false);
    });
  }
  const overlay = scene.add.container(0, 0).setDepth(80);
  scene.settingsOverlay = overlay;
  scene.menuFocusRing?.setVisible(false);
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
    onSetVisualContrastPreference: (value) => { setVisualContrastPreference(value); refreshSettingsOverlay(scene); },
    onSetColorCuePreference: (value) => { setColorCuePreference(value); refreshSettingsOverlay(scene); },
    onSetScreenShakePreference: (value) => { setScreenShakePreference(value); refreshSettingsOverlay(scene); },
    onSetFlashEffectsPreference: (value) => { setFlashEffectsPreference(value); refreshSettingsOverlay(scene); },
    onSetGraphicsQualityPreference: (value) => { setGraphicsQualityPreference(value); scene.syncHomeParticles(); refreshSettingsOverlay(scene); },
    onSetCombatPacePreference: (value) => { setCombatPacePreference(value); refreshSettingsOverlay(scene); },
    onSetAnimationPacePreference: (value) => { setAnimationPacePreference(scene, value); refreshSettingsOverlay(scene); },
    onSetTextPacePreference: (value) => { setTextPacePreference(value); refreshSettingsOverlay(scene); },
    onSetScreenReaderPreference: (value) => { setScreenReaderPreference(value); refreshSettingsOverlay(scene); },
    onToggleFullscreen: () => scene.scale.toggleFullscreen(),
  });
  scene.updateMenuTextState();
}

export function openHelpOverlay(scene: any, queueAssets = true) {
  if (scene.helpOverlay) return;
  scene.hideLeaderTooltip();
  if (scene.settingsOverlay) scene.closeSettingsOverlay();
  if (queueAssets) {
    queueUiIconAssets(scene, howToPlayUiIconIds, 'How to Play UI', () => {
      if (!scene.scene.isActive() || !scene.helpOverlay?.active) return;
      scene.closeHelpOverlay();
      openHelpOverlay(scene, false);
    });
  }
  const overlay = scene.add.container(0, 0).setDepth(80);
  scene.helpOverlay = overlay;
  scene.menuFocusRing?.setVisible(false);
  renderHowToPlayOverlay(scene, (obj) => overlay.add(obj), {
    onClose: () => scene.closeHelpOverlay(),
    guide: firstFlightGuideState(),
    onGuideAction: () => toggleFirstFlightGuide(scene),
  });
  scene.updateMenuTextState();
}

function refreshSettingsOverlay(scene: any, queueAssets = true) {
  scene.time.delayedCall(16, () => {
    if (!scene.scene.isActive() || !scene.settingsOverlay?.active) return;
    scene.closeSettingsOverlay();
    openSettingsOverlay(scene, queueAssets);
  });
}

export function toggleFirstFlightGuide(scene: any) {
  const guide = firstFlightGuideState();
  if (guide.enabled && !guide.completed) skipFirstFlightGuide();
  else replayFirstFlightGuide();
  playUiSound('confirm');
  scene.time.delayedCall(16, () => {
    if (!scene.scene.isActive() || !scene.helpOverlay?.active) return;
    scene.closeHelpOverlay();
    openHelpOverlay(scene);
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
    fontSize: '20px',
    fontStyle: UI_BOLD,
    color: unlocked ? '#dfc18b' : '#a4b6c2',
    align: 'center',
    wordWrap: { width: 1080 },
  }).setResolution(2).setOrigin(0.5).setName('title-leader-description-title');
  const body = scene.add.text(0, 0, unlocked
    ? `${leader.blurb} Signature: ${leader.signatureName} - ${leader.signatureText}`
    : leaderUnlockHints[leader.id] ?? 'Locked', {
    fontFamily: UI_FONT,
    fontSize: '20px',
    color: unlocked ? '#c5d1d8' : '#a4b6c2',
    align: 'center',
    wordWrap: { width: 1080 },
  }).setResolution(2).setOrigin(0.5, 0).setName('title-leader-description-body');
  body.setLineSpacing(2);
  tooltip.add([title, body]);
  scene.leaderTooltip = tooltip;
  scene.updateMenuTextState();
}
