import Phaser from 'phaser';
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

export function showLeaderTooltip(scene: any, id: string, anchorX: number) {
  scene.hideLeaderTooltip();
  const leader = getLeader(id);
  const unlocked = isLeaderUnlocked(scene.menuAccount, leader.id);
  const tooltipX = Phaser.Math.Clamp(anchorX, 328, GAME_WIDTH - 328);
  const tooltip = scene.add.container(tooltipX, 404).setDepth(100);
  const key = uiIconAssets['title-leader-tooltip-frame'].key;
  const frame = scene.textures.exists(key)
    ? scene.add.image(0, 0, key)
      .setDisplaySize(unlocked ? 704 : 680, unlocked ? 126 : 108)
      .setAlpha(unlocked ? 0.78 : 0.58)
      .setName('title-leader-tooltip-frame')
    : undefined;
  if (frame) {
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    if (!unlocked) frame.setTint(0x8fa4bd);
  }
  const bg = frame
    ? scene.add.rectangle(0, 0, unlocked ? 574 : 552, unlocked ? 72 : 58, 0x05070c, 0.08)
    : scene.add.rectangle(0, 0, 640, unlocked ? 88 : 72, 0x05070c, 0.86)
      .setStrokeStyle(2, unlocked ? 0xe8b830 : 0x7ab8d6, unlocked ? 0.9 : 0.68);
  const title = scene.add.text(0, unlocked ? -32 : -22, unlocked
    ? `${leader.name} - ${leader.suit} / ${leader.bird}`
    : `${leader.name} - Locked`, {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: unlocked ? '#ffe1a3' : '#9fb1c4',
    align: 'center',
    stroke: '#05070c',
    strokeThickness: 2,
    wordWrap: { width: 600 },
  }).setOrigin(0.5);
  const body = scene.add.text(0, unlocked ? 7 : 13, unlocked
    ? `${leader.blurb}\nSignature: ${leader.signatureName} - ${leader.signatureText}`
    : leaderUnlockHints[leader.id] ?? 'Locked', {
    fontFamily: 'Georgia, serif',
    fontSize: '12px',
    fontStyle: unlocked ? 'italic' : '',
    color: unlocked ? '#dce7f2' : '#9fb1c4',
    align: 'center',
    stroke: '#05070c',
    strokeThickness: 2,
    wordWrap: { width: 584 },
  }).setOrigin(0.5);
  body.setLineSpacing(2);
  tooltip.add(frame ? [frame, bg, title, body] : [bg, title, body]);
  scene.leaderTooltip = tooltip;
  scene.updateMenuTextState();
}
