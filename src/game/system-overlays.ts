import Phaser from 'phaser';
import { memoryStorageSessionActive } from './safe-storage';
import {
  CONTROL_BINDING_DEFINITIONS,
  controlActionLabel,
  controlBindingLabel,
  controlBindingsAreDefault,
  controlCaptureRegistryKey,
  controlCodeLabel,
  controlPanelFocusRegistryKey,
  controlPanelPageRegistryKey,
  controlPanelRegistryKey,
  isBindableControlCode,
  matchesControlAction,
  resetControlBindings,
  setControlBinding,
  settingsOverlayInputRegistryKey,
  type ControlAction,
  type ControlBindingPage,
} from './input-bindings';
import type { GraphicsQualityPreference, GraphicsQualityState } from './graphics-quality';
import type {
  ColorCuePreference,
  ColorCueState,
  FlashEffectsPreference,
  FlashEffectsState,
  ScreenShakePreference,
  ScreenShakeState,
  VisualContrastPreference,
  VisualContrastState,
} from './visual-accessibility';
import type { ScreenReaderPreference, ScreenReaderState } from './screen-reader-accessibility';
import { MIN_SUPPORTED_TOUCH_TARGET } from './theme';

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const UI_FONT = 'Arial';
const UI_BOLD = 'bold';
const UI_GOLD = '#ffe1a3';
const UI_CYAN = '#8df4ff';
const UI_SOFT = '#b9c7d6';
const UI_FIELD = {
  ink: 0x070b12,
  gold: 0xd8a840,
  brass: 0xf0c36f,
  cyan: 0x7ab8d6,
  green: 0x8fd6a0,
  danger: 0xe05b4f,
  muted: '#91a6b8',
  warm: '#ffe1a3',
  text: '#e7eef7',
};

type UiAdd = (object: Phaser.GameObjects.GameObject) => void;
type MotionPreference = 'full' | 'system' | 'reduced';
type CombatPace = 'cinematic' | 'standard' | 'snappy';
type AnimationPace = 'relaxed' | 'standard' | 'fast';
type TextPace = 'relaxed' | 'standard' | 'fast';
type SettingsRowKind = 'toggle' | 'slider' | 'motion' | 'contrast' | 'graphics' | 'pace' | 'animationPace' | 'textPace' | 'controls' | 'screenReader' | 'colorCues' | 'screenShake' | 'flashEffects';
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
type FrameOptions = { alpha?: number; tint?: number };

export interface SettingsOverlayOptions {
  title: string;
  subtitle: string;
  onClose: () => void;
  onToggleAudio: () => void;
  onSetMusicVolume: (value: number) => void;
  onSetSfxVolume: (value: number) => void;
  onSetVoiceVolume: (value: number) => void;
  onSetAmbienceVolume: (value: number) => void;
  onSetMotionPreference: (value: MotionPreference) => void;
  onSetVisualContrastPreference: (value: VisualContrastPreference) => void;
  onSetColorCuePreference: (value: ColorCuePreference) => void;
  onSetScreenShakePreference: (value: ScreenShakePreference) => void;
  onSetFlashEffectsPreference: (value: FlashEffectsPreference) => void;
  onSetGraphicsQualityPreference: (value: GraphicsQualityPreference) => void;
  onSetCombatPacePreference: (value: CombatPace) => void;
  onSetAnimationPacePreference: (value: AnimationPace) => void;
  onSetTextPacePreference: (value: TextPace) => void;
  onSetScreenReaderPreference: (value: ScreenReaderPreference) => void;
  onToggleFullscreen: () => void;
}

export interface HowToPlayOverlayOptions {
  onClose: () => void;
  guide: { enabled: boolean; completed: boolean };
  onGuideAction: () => void;
}

export interface PauseOverlayOptions {
  title: string;
  subtitle: string;
  details: Array<[string, string]>;
  onResume: () => void;
  onMenu: () => void;
  onToggleAudio: () => void;
  onSettings?: () => void;
  onAbandon?: () => void;
}

export interface ConfirmRunExitOverlayOptions {
  onKeepPlaying: () => void;
  onAbandonRun: () => void;
}

export interface SystemOverlayDependencies {
  audio: {
    isMuted: () => boolean;
    snapshot: () => { musicVolume: number; sfxVolume: number; voiceVolume: number; ambienceVolume: number };
    toggleMute: () => void;
  };
  combatPacePreference: () => CombatPace;
  animationPacePreference: () => AnimationPace;
  textPacePreference: () => TextPace;
  graphicsQualityState: () => GraphicsQualityState;
  motionState: () => { preference: MotionPreference; reduced: boolean };
  colorCueState: () => ColorCueState;
  screenShakeState: () => ScreenShakeState;
  flashEffectsState: () => FlashEffectsState;
  screenReaderState: () => ScreenReaderState;
  visualContrastState: () => VisualContrastState;
  playUiSound: (kind?: 'confirm' | 'close' | 'locked') => void;
  prefersReducedMotion: () => boolean;
  activateAudioToggleControl: (scene: Phaser.Scene) => boolean;
  renderAudioToggleControl: (
    scene: Phaser.Scene,
    addTo: UiAdd,
    x: number,
    y: number,
    onToggle?: () => void,
  ) => unknown;
  renderCloseControl: (
    scene: Phaser.Scene,
    addTo: UiAdd,
    x: number,
    y: number,
    onClick: () => void,
  ) => unknown;
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
  ) => unknown;
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

function addUi<T extends Phaser.GameObjects.GameObject>(addTo: UiAdd, object: T) {
  addTo(object);
  return object;
}

function iconKey(id: string) {
  return `ui-icon-${id}`;
}

function motionPreferenceLabel(value: MotionPreference) {
  if (value === 'full') return 'Full';
  if (value === 'reduced') return 'Reduced';
  return 'System';
}

function graphicsQualityLabel(value: GraphicsQualityPreference) {
  if (value === 'full') return 'Full';
  if (value === 'lean') return 'Lean';
  return 'Auto';
}

function combatPaceLabel(value: CombatPace) {
  if (value === 'cinematic') return 'Cinematic';
  if (value === 'snappy') return 'Snappy';
  return 'Standard';
}

function animationPaceLabel(value: AnimationPace) {
  if (value === 'relaxed') return 'Relaxed';
  if (value === 'fast') return 'Fast';
  return 'Standard';
}

function textPaceLabel(value: TextPace) {
  if (value === 'relaxed') return 'Relaxed';
  if (value === 'fast') return 'Fast';
  return 'Standard';
}

function visualContrastLabel(value: VisualContrastPreference) {
  return value === 'high' ? 'High' : 'Standard';
}

function colorCueLabel(value: ColorCuePreference) {
  return value === 'reinforced' ? 'Reinforced' : 'Standard';
}

function screenShakeLabel(state: ScreenShakeState) {
  if (state.reducedByMotion) return 'Off (Motion)';
  return state.preference === 'on' ? 'On' : 'Off';
}

function flashEffectsLabel(state: FlashEffectsState) {
  if (state.reducedByMotion) return 'Reduced (Motion)';
  return state.preference === 'reduced' ? 'Reduced' : 'Full';
}

function screenReaderLabel(value: ScreenReaderPreference) {
  return value === 'on' ? 'On' : 'Off';
}

function addIconImage(scene: Phaser.Scene, id: string, x: number, y: number, size: number) {
  const key = iconKey(id);
  if (!scene.textures.exists(key)) return undefined;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return scene.add.image(x, y, key).setDisplaySize(size * 2.2, size * 2.2);
}

function addOverlayPanelFlourish(
  scene: Phaser.Scene,
  addTo: UiAdd,
  frame: FieldFrame,
  options: { alpha?: number; tint?: number; yOffset?: number },
  dependencies: SystemOverlayDependencies,
) {
  const key = iconKey('overlay-panel-flourish');
  if (!scene.textures.exists(key)) return undefined;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const alpha = options.alpha ?? 0.18;
  const flourish = scene.add.image(frame.cx, frame.cy + (options.yOffset ?? 0), key)
    .setDisplaySize(Math.min(frame.w + 130, 850), Math.min(frame.h + 96, 560))
    .setAlpha(dependencies.prefersReducedMotion() ? Math.min(alpha, 0.12) : alpha)
    .setBlendMode(Phaser.BlendModes.ADD);
  if (options.tint !== undefined) flourish.setTint(options.tint);
  addUi(addTo, flourish);
  if (!dependencies.prefersReducedMotion()) {
    scene.tweens.add({
      targets: flourish,
      alpha: alpha * 0.64,
      scaleX: flourish.scaleX * 1.014,
      scaleY: flourish.scaleY * 1.014,
      angle: 0.55,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  return flourish;
}

function addSystemMenuCommandFrame(
  scene: Phaser.Scene,
  addTo: UiAdd,
  frame: FieldFrame,
  options: { alpha?: number; tint?: number; yOffset?: number },
  dependencies: SystemOverlayDependencies,
) {
  const key = iconKey('system-menu-command-frame');
  if (!scene.textures.exists(key)) return undefined;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const reduced = dependencies.prefersReducedMotion();
  const alpha = reduced ? Math.min(options.alpha ?? 0.28, 0.2) : (options.alpha ?? 0.28);
  const y = frame.cy + (options.yOffset ?? 0);
  const width = Math.min(frame.w + 116, 820);
  const height = Math.min(frame.h + 6, 392);
  const frameImage = scene.add.image(frame.cx, y, key)
    .setDisplaySize(width, height)
    .setAlpha(alpha)
    .setName('system-menu-command-frame');
  const glint = scene.add.image(frame.cx, y, key)
    .setDisplaySize(width, height)
    .setAlpha(reduced ? 0.045 : 0.075)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setName('system-menu-command-frame');
  if (options.tint !== undefined) {
    frameImage.setTint(options.tint);
    glint.setTint(options.tint);
  }
  addUi(addTo, frameImage);
  addUi(addTo, glint);
  if (!reduced) {
    scene.tweens.add({
      targets: frameImage,
      alpha: { from: alpha * 0.82, to: alpha },
      scaleX: `+=${frameImage.scaleX * 0.008}`,
      scaleY: `+=${frameImage.scaleY * 0.008}`,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: glint,
      alpha: { from: 0.045, to: 0.075 },
      scaleX: `+=${glint.scaleX * 0.006}`,
      scaleY: `+=${glint.scaleY * 0.006}`,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  return frameImage;
}

function addSystemOverlayTitlePlaque(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  width: number,
  height: number,
  options: FrameOptions,
) {
  const key = iconKey('system-overlay-title-plaque');
  if (!scene.textures.exists(key)) return undefined;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const plaque = scene.add.image(cx, cy, key)
    .setDisplaySize(width, height)
    .setAlpha(options.alpha ?? 0.54)
    .setName('system-overlay-title-plaque');
  if (options.tint !== undefined) plaque.setTint(options.tint);
  addUi(addTo, plaque);
  return plaque;
}

function addAssetFrame(
  scene: Phaser.Scene,
  addTo: UiAdd,
  id: string,
  cx: number,
  cy: number,
  width: number,
  height: number,
  options: FrameOptions,
  reducedAlpha: number,
) {
  const key = iconKey(id);
  if (!scene.textures.exists(key)) return undefined;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const requestedAlpha = options.alpha ?? 0.76;
  const frame = scene.add.image(cx, cy, key)
    .setDisplaySize(width, height)
    .setAlpha(requestedAlpha)
    .setName(id);
  if (options.tint !== undefined) frame.setTint(options.tint);
  addUi(addTo, frame);
  frame.setData('reducedAlpha', Math.min(requestedAlpha, reducedAlpha));
  return frame;
}

function addSystemSettingsRowFrame(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  width: number,
  height: number,
  options: FrameOptions,
  dependencies: SystemOverlayDependencies,
) {
  const frame = addAssetFrame(scene, addTo, 'system-settings-row-frame', cx, cy, width, height, options, 0.68);
  if (frame && dependencies.prefersReducedMotion()) frame.setAlpha(frame.getData('reducedAlpha'));
  return frame;
}

function addSystemSettingsToggleFrame(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  width: number,
  height: number,
  options: FrameOptions,
  dependencies: SystemOverlayDependencies,
) {
  const frame = addAssetFrame(scene, addTo, 'system-settings-toggle-frame', cx, cy, width, height, options, 0.6);
  if (frame && dependencies.prefersReducedMotion()) frame.setAlpha(frame.getData('reducedAlpha'));
  return frame;
}

function addSystemSettingsVolumeSliderFrame(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  width: number,
  height: number,
  options: FrameOptions,
  dependencies: SystemOverlayDependencies,
) {
  const frame = addAssetFrame(scene, addTo, 'system-settings-volume-slider-frame', cx, cy, width, height, options, 0.64);
  if (frame && dependencies.prefersReducedMotion()) frame.setAlpha(frame.getData('reducedAlpha'));
  return frame;
}

function addSystemSettingsMotionSwitchFrame(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  width: number,
  height: number,
  options: FrameOptions,
  dependencies: SystemOverlayDependencies,
) {
  const frame = addAssetFrame(scene, addTo, 'system-settings-motion-switch-frame', cx, cy, width, height, options, 0.66);
  if (frame && dependencies.prefersReducedMotion()) frame.setAlpha(frame.getData('reducedAlpha'));
  return frame;
}

function addHowToPlayGuideFrame(
  scene: Phaser.Scene,
  addTo: UiAdd,
  frame: FieldFrame,
  dependencies: SystemOverlayDependencies,
) {
  const key = iconKey('how-to-play-guide-frame');
  if (!scene.textures.exists(key)) return undefined;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const reduced = dependencies.prefersReducedMotion();
  const alpha = reduced ? 0.14 : 0.2;
  const y = frame.cy + 16;
  const width = Math.min(frame.w + 112, 860);
  const height = Math.min(frame.h - 42, 456);
  const guide = scene.add.image(frame.cx, y, key)
    .setDisplaySize(width, height)
    .setAlpha(alpha)
    .setName('how-to-play-guide-frame');
  const glint = scene.add.image(frame.cx, y, key)
    .setDisplaySize(width, height)
    .setAlpha(reduced ? 0.035 : 0.06)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setName('how-to-play-guide-frame');
  addUi(addTo, guide);
  addUi(addTo, glint);
  if (!reduced) {
    scene.tweens.add({
      targets: guide,
      alpha: { from: alpha * 0.82, to: alpha },
      scaleX: `+=${guide.scaleX * 0.006}`,
      scaleY: `+=${guide.scaleY * 0.006}`,
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: glint,
      alpha: { from: 0.035, to: 0.06 },
      duration: 2100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  return guide;
}

function addHowToPlayTopicCardFrame(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  width: number,
  height: number,
  accent: number,
  dependencies: SystemOverlayDependencies,
) {
  const card = addAssetFrame(
    scene,
    addTo,
    'how-to-play-topic-card-frame',
    cx,
    cy,
    width,
    height,
    { alpha: 0.76, tint: accent },
    0.7,
  );
  if (card && dependencies.prefersReducedMotion()) card.setAlpha(card.getData('reducedAlpha'));
  return card;
}

function addHowToPlayTipRowFrame(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  width: number,
  height: number,
  alpha: number,
  tint: number,
) {
  return addAssetFrame(scene, addTo, 'how-to-play-tip-row-frame', cx, cy, width, height, { alpha, tint }, alpha);
}

function addSystemPauseDetailRowFrame(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  width: number,
  height: number,
  alpha: number,
  dependencies: SystemOverlayDependencies,
) {
  const row = addAssetFrame(
    scene,
    addTo,
    'system-pause-detail-row-frame',
    cx,
    cy,
    width,
    height,
    { alpha },
    0.6,
  );
  if (row && dependencies.prefersReducedMotion()) row.setAlpha(row.getData('reducedAlpha'));
  return row;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function adjacentValue<T>(values: readonly T[], value: T, direction: -1 | 1): T {
  const current = Math.max(0, values.indexOf(value));
  return values[(current + direction + values.length) % values.length];
}

function renderSettingsVolumeSlider(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  width: number,
  value: number,
  accent: number,
  onChange: (value: number) => void,
  controlName: string,
  dependencies: SystemOverlayDependencies,
) {
  const normalized = clamp(value, 0, 1);
  const frame = addSystemSettingsVolumeSliderFrame(
    scene,
    addTo,
    cx,
    cy,
    width + 46,
    50,
    { alpha: 0.78, tint: accent },
    dependencies,
  );
  const hit = addUi(addTo, scene.add.rectangle(cx, cy, width + 28, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.02)
    .setName(controlName)
    .setInteractive({ useHandCursor: true }));
  const trackWidth = width - 78;
  const trackX = cx - trackWidth / 2 - 6;
  const fillWidth = Math.max(8, trackWidth * normalized);
  const track = addUi(addTo, scene.add.rectangle(cx - 6, cy, trackWidth, 9, 0x02070d, frame ? 0.28 : 0.72)
    .setStrokeStyle(1, 0x1b2f3a, 0.64));
  const fill = addUi(addTo, scene.add.rectangle(trackX + fillWidth / 2, cy, fillWidth, 7, accent, 0.82)
    .setBlendMode(Phaser.BlendModes.ADD));
  const knobX = trackX + trackWidth * normalized;
  const knob = addUi(addTo, scene.add.circle(knobX, cy, 9, 0x06151b, 0.96)
    .setStrokeStyle(2, accent, 0.96));
  const glint = addUi(addTo, scene.add.circle(knobX, cy, 4, 0xdffaff, 0.86));
  const applyPointer = (pointer: Phaser.Input.Pointer) => {
    const next = clamp((pointer.x - trackX) / trackWidth, 0, 1);
    onChange(Math.round(next * 20) / 20);
  };
  hit.on('pointerdown', applyPointer);
  hit.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    if (pointer.isDown) applyPointer(pointer);
  });
  hit.on('pointerover', () => {
    track.setAlpha(frame ? 0.4 : 0.86);
    fill.setAlpha(0.98);
    knob.setScale(1.08);
    glint.setScale(1.12);
  });
  hit.on('pointerout', () => {
    track.setAlpha(frame ? 0.28 : 0.72);
    fill.setAlpha(0.82);
    knob.setScale(1);
    glint.setScale(1);
  });
  return hit;
}

function renderSettingsMotionSwitch(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  preference: MotionPreference,
  onChange: () => void,
  dependencies: SystemOverlayDependencies,
) {
  const state = dependencies.motionState();
  const activeIndex = preference === 'full' ? 0 : preference === 'system' ? 1 : 2;
  const frame = addSystemSettingsMotionSwitchFrame(scene, addTo, cx, cy, 268, 58, {
    alpha: state.reduced ? 0.74 : 0.82,
    tint: preference === 'reduced' ? 0xffefc4 : preference === 'full' ? 0xdffaff : undefined,
  }, dependencies);
  const hit = addUi(addTo, scene.add.rectangle(cx, cy, 276, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.02)
    .setName('system-settings-motion-switch-hit')
    .setInteractive({ useHandCursor: true }));
  [cx - 84, cx, cx + 84].forEach((x, index) => {
    const active = index === activeIndex;
    addUi(addTo, scene.add.circle(x, cy + 13, active ? 9 : 5, active ? 0x06151b : 0x020409, active ? 0.96 : 0.72)
      .setStrokeStyle(active ? 3 : 1, active ? (state.reduced ? UI_FIELD.gold : UI_FIELD.cyan) : 0x49606d, active ? 0.98 : 0.55)
      .setName(active ? 'system-settings-motion-switch-active' : 'system-settings-motion-switch-notch'));
    if (active) {
      addUi(addTo, scene.add.circle(x, cy + 13, 4, 0xdffaff, state.reduced ? 0.72 : 0.88)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setName('system-settings-motion-switch-active'));
    }
  });
  hit.on('pointerover', () => frame?.setAlpha(state.reduced ? 0.82 : 0.92));
  hit.on('pointerout', () => frame?.setAlpha(state.reduced ? 0.74 : 0.82));
  hit.on('pointerdown', () => {
    dependencies.playUiSound('confirm');
    onChange();
  });
  return hit;
}

function renderSettingsCombatPaceSwitch(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  preference: CombatPace,
  onChange: () => void,
  dependencies: SystemOverlayDependencies,
) {
  const activeIndex = preference === 'cinematic' ? 0 : preference === 'standard' ? 1 : 2;
  const frame = addSystemSettingsMotionSwitchFrame(scene, addTo, cx, cy, 268, 58, {
    alpha: 0.82,
    tint: preference === 'cinematic' ? 0xffefc4 : preference === 'snappy' ? 0xdffaff : undefined,
  }, dependencies);
  const hit = addUi(addTo, scene.add.rectangle(cx, cy, 276, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.02)
    .setName('system-settings-combat-pace-switch-hit')
    .setInteractive({ useHandCursor: true }));
  [cx - 84, cx, cx + 84].forEach((x, index) => {
    const active = index === activeIndex;
    addUi(addTo, scene.add.circle(x, cy + 13, active ? 9 : 5, active ? 0x06151b : 0x020409, active ? 0.96 : 0.72)
      .setStrokeStyle(active ? 3 : 1, active ? UI_FIELD.gold : 0x49606d, active ? 0.98 : 0.55)
      .setName(active ? 'system-settings-combat-pace-active' : 'system-settings-combat-pace-notch'));
  });
  hit.on('pointerover', () => frame?.setAlpha(0.92));
  hit.on('pointerout', () => frame?.setAlpha(0.82));
  hit.on('pointerdown', () => {
    dependencies.playUiSound('confirm');
    onChange();
  });
  return hit;
}

function renderSettingsContrastSwitch(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  preference: VisualContrastPreference,
  onChange: () => void,
  dependencies: SystemOverlayDependencies,
) {
  const highContrast = preference === 'high';
  addSystemSettingsToggleFrame(scene, addTo, cx, cy, 176, 42, {
    alpha: highContrast ? 0.88 : 0.66,
    tint: highContrast ? 0xdffaff : undefined,
  }, dependencies);
  const hit = addUi(addTo, scene.add.rectangle(cx, cy, 184, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.02)
    .setName('system-settings-contrast-toggle-hit')
    .setInteractive({ useHandCursor: true }));
  hit.on('pointerdown', () => {
    dependencies.playUiSound('confirm');
    onChange();
  });
  return hit;
}

function renderSettingsGraphicsQualitySwitch(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  preference: GraphicsQualityPreference,
  onChange: () => void,
  dependencies: SystemOverlayDependencies,
) {
  const state = dependencies.graphicsQualityState();
  const activeIndex = preference === 'full' ? 0 : preference === 'auto' ? 1 : 2;
  const frame = addSystemSettingsMotionSwitchFrame(scene, addTo, cx, cy, 268, 58, {
    alpha: state.lean ? 0.74 : 0.82,
    tint: preference === 'lean' ? 0xffefc4 : preference === 'full' ? 0xdffaff : undefined,
  }, dependencies);
  const hit = addUi(addTo, scene.add.rectangle(cx, cy, 276, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.02)
    .setName('system-settings-graphics-quality-switch-hit')
    .setInteractive({ useHandCursor: true }));
  [cx - 84, cx, cx + 84].forEach((x, index) => {
    const active = index === activeIndex;
    addUi(addTo, scene.add.circle(x, cy + 13, active ? 9 : 5, active ? 0x06151b : 0x020409, active ? 0.96 : 0.72)
      .setStrokeStyle(active ? 3 : 1, active ? (state.lean ? UI_FIELD.gold : UI_FIELD.cyan) : 0x49606d, active ? 0.98 : 0.55)
      .setName(active ? 'system-settings-graphics-quality-active' : 'system-settings-graphics-quality-notch'));
  });
  hit.on('pointerover', () => frame?.setAlpha(state.lean ? 0.82 : 0.92));
  hit.on('pointerout', () => frame?.setAlpha(state.lean ? 0.74 : 0.82));
  hit.on('pointerdown', () => {
    dependencies.playUiSound('confirm');
    onChange();
  });
  return hit;
}

export function renderPauseMenuOverlay(
  scene: Phaser.Scene,
  addTo: UiAdd,
  options: PauseOverlayOptions,
  dependencies: SystemOverlayDependencies,
) {
  addUi(addTo, scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.82)
    .setInteractive({ useHandCursor: false }));
  const frame = dependencies.renderFieldPanel(scene, addTo, GAME_WIDTH / 2, GAME_HEIGHT / 2, 620, options.onAbandon ? 500 : 430, {
    accent: UI_FIELD.gold,
    fill: UI_FIELD.ink,
  });
  const icon = addIconImage(scene, 'pause-medallion', frame.left + 112, frame.top + 118, 54);
  if (icon) addUi(addTo, icon.setAlpha(0.96));
  addUi(addTo, scene.add.text(frame.left + 206, frame.top + 72, memoryStorageSessionActive() ? 'Practice Paused' : options.title, {
    fontFamily: 'Georgia, serif',
    fontSize: '34px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
    stroke: '#000000',
    strokeThickness: 4,
  }));
  addUi(addTo, scene.add.text(frame.left + 208, frame.top + 116, memoryStorageSessionActive()
    ? 'Nothing saved. Main Menu ends practice.' : options.subtitle, {
    fontFamily: UI_FONT,
    fontSize: '15px',
    fontStyle: UI_BOLD,
    color: UI_CYAN,
    wordWrap: { width: 340 },
  }));
  options.details.slice(0, 4).forEach(([label, value], index) => {
    const y = frame.top + 170 + index * 34;
    addUi(addTo, scene.add.rectangle(frame.left + 310, y, 390, 25, 0x050a12, index % 2 === 0 ? 0.36 : 0.2));
    addUi(addTo, scene.add.text(frame.left + 136, y, label, {
      fontFamily: UI_FONT,
      fontSize: '16px',
      color: UI_FIELD.muted,
    }).setOrigin(0, 0.5));
    addUi(addTo, scene.add.text(frame.left + 486, y, value, {
      fontFamily: UI_FONT,
      fontSize: '16px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.text,
      align: 'right',
    }).setOrigin(1, 0.5));
  });
  dependencies.renderAudioToggleControl(scene, addTo, frame.right - 74, frame.top + 58, options.onToggleAudio);
  const commandY = frame.bottom - (options.onAbandon ? 110 : 72);
  if (options.onSettings) {
    dependencies.renderFieldButton(scene, addTo, frame.left + 132, commandY, 172, 64, 'Resume', true, options.onResume, UI_FIELD.gold);
    dependencies.renderFieldButton(scene, addTo, frame.cx, commandY, 156, 56, 'Settings', true, options.onSettings, UI_FIELD.cyan);
    dependencies.renderFieldButton(scene, addTo, frame.right - 132, commandY, 156, 56, 'Main Menu', true, options.onMenu, UI_FIELD.cyan);
  } else {
    dependencies.renderFieldButton(scene, addTo, frame.left + 174, frame.bottom - 72, 180, 56, 'Resume', true, options.onResume, UI_FIELD.cyan);
    dependencies.renderFieldButton(scene, addTo, frame.right - 174, frame.bottom - 72, 180, 56, 'Main Menu', true, options.onMenu, UI_FIELD.gold);
  }
  if (options.onAbandon) (dependencies.renderFieldButton(scene, addTo, frame.cx, frame.bottom - 38, 220, 58,
    memoryStorageSessionActive() ? 'End Practice…' : 'Abandon Flight…', true, options.onAbandon, UI_FIELD.danger) as Phaser.GameObjects.Rectangle)
    .setName('pause-abandon-hit');
}

export function renderConfirmRunExitOverlay(
  scene: Phaser.Scene,
  addTo: UiAdd,
  options: ConfirmRunExitOverlayOptions,
  dependencies: SystemOverlayDependencies,
) {
  addUi(addTo, scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.86)
    .setInteractive({ useHandCursor: false }));
  const frameKey = iconKey('confirm-exit-frame');
  if (scene.textures.exists(frameKey)) {
    scene.textures.get(frameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    addUi(addTo, scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, frameKey)
      .setDisplaySize(742, 278)
      .setAlpha(0.94)
      .setName('confirm-exit-frame'));
    addUi(addTo, scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, frameKey)
      .setDisplaySize(760, 284)
      .setAlpha(dependencies.prefersReducedMotion() ? 0.035 : 0.055)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('confirm-exit-frame'));
  } else {
    addUi(addTo, scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 640, 286, 0x0d1420, 0.98)
      .setStrokeStyle(3, 0xff7a6e, 0.92));
  }
  addUi(addTo, scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 78, memoryStorageSessionActive() ? 'End practice?' : 'Abandon this run?', {
    fontFamily: UI_FONT,
    fontSize: '30px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5));
  addUi(addTo, scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24, memoryStorageSessionActive()
    ? 'Practice is discarded. Your saved flight and collection stay unchanged.' : 'Your progress on this run will be lost.', {
    fontFamily: UI_FONT,
    fontSize: '16px',
    color: UI_SOFT,
    align: 'center',
    wordWrap: { width: 540 },
  }).setOrigin(0.5).setName('route-confirm-exit-subtitle'));

  const commandFrameKey = iconKey('confirm-exit-command-frame');
  const hasCommandFrame = scene.textures.exists(commandFrameKey);
  const renderCommand = (x: number, danger: boolean) => {
    addUi(addTo, scene.add.rectangle(x, GAME_HEIGHT / 2 + 56, 230, 54, danger ? 0x2a1014 : 0x122235, hasCommandFrame ? (danger ? 0.24 : 0.18) : 0.98)
      .setStrokeStyle(2, danger ? 0xff7a6e : 0x7ab8d6, hasCommandFrame ? (danger ? 0.28 : 0.22) : 0.95));
    if (hasCommandFrame) {
      scene.textures.get(commandFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const command = scene.add.image(x, GAME_HEIGHT / 2 + 56, commandFrameKey)
        .setDisplaySize(262, 62)
        .setAlpha(danger ? 0.92 : 0.88)
        .setName('confirm-exit-command-frame');
      if (danger) {
        command.setTint(0xffe5dd);
        addUi(addTo, scene.add.rectangle(x, GAME_HEIGHT / 2 + 57, 198, 25, 0x54151b, 0.16));
      }
      addUi(addTo, command);
    }
  };
  const keepX = GAME_WIDTH / 2 - 140;
  renderCommand(keepX, false);
  addUi(addTo, scene.add.text(keepX, GAME_HEIGHT / 2 + 56, 'Keep Playing', {
    fontFamily: UI_FONT,
    fontSize: '18px',
    fontStyle: UI_BOLD,
    color: '#eef8ff',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5));
  const keepHit = addUi(addTo, scene.add.rectangle(keepX, GAME_HEIGHT / 2 + 56, 230, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
    .setInteractive({ useHandCursor: true })
    .setName('route-confirm-exit-keep-hit'));
  keepHit.on('pointerdown', options.onKeepPlaying);

  const abandonX = GAME_WIDTH / 2 + 140;
  renderCommand(abandonX, true);
  addUi(addTo, scene.add.text(abandonX, GAME_HEIGHT / 2 + 56, memoryStorageSessionActive() ? 'End Practice' : 'Abandon Run', {
    fontFamily: UI_FONT,
    fontSize: '18px',
    fontStyle: UI_BOLD,
    color: '#ffd8d2',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5));
  const abandonHit = addUi(addTo, scene.add.rectangle(abandonX, GAME_HEIGHT / 2 + 56, 230, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
    .setInteractive({ useHandCursor: true })
    .setName('route-confirm-exit-abandon-hit'));
  abandonHit.on('pointerdown', options.onAbandonRun);
  addUi(addTo, scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 4, 'Esc to keep playing', {
    fontFamily: UI_FONT,
    fontSize: '12px',
    color: '#b8c5d8',
  }).setOrigin(0.5).setAlpha(0.92).setName('route-confirm-exit-escape-hint'));
}

const settingsInputCleanups = new WeakMap<Phaser.Scene, () => void>();

export function renderSettingsMenuOverlay(
  scene: Phaser.Scene,
  addTo: UiAdd,
  options: SettingsOverlayOptions,
  dependencies: SystemOverlayDependencies,
) {
  // A deferred scene redraw can replace a panel before its old destroy callback.
  // Retire the previous input owner before attaching replacement handlers.
  settingsInputCleanups.get(scene)?.();
  const lifecycle = addUi(addTo, scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.84)
    .setInteractive({ useHandCursor: false }));
  const settingsInputKey = settingsOverlayInputRegistryKey(scene);
  const controlsPanelKey = controlPanelRegistryKey(scene);
  const controlsCaptureKey = controlCaptureRegistryKey(scene);
  const reopenControlsPanel = Boolean(scene.registry.get(controlsPanelKey));
  const dismissSettingsOverlay = () => {
    scene.registry.set(controlsPanelKey, false);
    scene.registry.remove(controlsCaptureKey);
    options.onClose();
  };
  scene.registry.set(settingsInputKey, true);
  const frame = dependencies.renderFieldPanel(scene, addTo, GAME_WIDTH / 2, GAME_HEIGHT / 2, 1160, 660, {
    accent: UI_FIELD.cyan,
    fill: UI_FIELD.ink,
  });
  addOverlayPanelFlourish(scene, addTo, frame, { alpha: 0.06, tint: 0xdffaff, yOffset: 4 }, dependencies);
  addSystemMenuCommandFrame(scene, addTo, frame, { alpha: 0.08, yOffset: 2 }, dependencies);
  const icon = addIconImage(scene, 'settings-medallion', frame.left + 112, frame.top + 118, 54);
  if (icon) addUi(addTo, icon.setAlpha(0.96));
  addSystemOverlayTitlePlaque(scene, addTo, frame.left + 364, frame.top + 96, 424, 88, {
    alpha: 0.52,
    tint: 0xdffaff,
  });
  addUi(addTo, scene.add.text(frame.left + 206, frame.top + 72, options.title, {
    fontFamily: 'Georgia, serif',
    fontSize: '34px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
    stroke: '#000000',
    strokeThickness: 4,
  }));
  addUi(addTo, scene.add.text(frame.left + 208, frame.top + 116, options.subtitle, {
    fontFamily: UI_FONT,
    fontSize: '15px',
    fontStyle: UI_BOLD,
    color: UI_CYAN,
    wordWrap: { width: 340 },
  }));
  dependencies.renderCloseControl(scene, addTo, frame.right - 66, frame.top + 58, dismissSettingsOverlay);

  const audioSnapshot = dependencies.audio.snapshot();
  const motion = dependencies.motionState();
  const contrast = dependencies.visualContrastState();
  const colorCues = dependencies.colorCueState();
  const screenShake = dependencies.screenShakeState();
  const flashEffects = dependencies.flashEffectsState();
  const graphics = dependencies.graphicsQualityState();
  const pace = dependencies.combatPacePreference();
  const animationPace = dependencies.animationPacePreference();
  const textPace = dependencies.textPacePreference();
  const screenReader = dependencies.screenReaderState();
  const rows: Array<[string, string, SettingsRowKind]> = [
    ['Audio', dependencies.audio.isMuted() ? 'Muted' : 'On', 'toggle'],
    ['Music', `${Math.round(audioSnapshot.musicVolume * 100)}%`, 'slider'],
    ['SFX', `${Math.round(audioSnapshot.sfxVolume * 100)}%`, 'slider'],
    ['Card Voices', `${Math.round(audioSnapshot.voiceVolume * 100)}%`, 'slider'],
    ['Ambience', `${Math.round(audioSnapshot.ambienceVolume * 100)}%`, 'slider'],
    ['Controls', controlBindingsAreDefault() ? 'Default' : 'Custom', 'controls'],
    ['Motion', motionPreferenceLabel(motion.preference), 'motion'],
    ['Contrast', visualContrastLabel(contrast.preference), 'contrast'],
    ['Effects', graphicsQualityLabel(graphics.preference), 'graphics'],
    ['Combat Pace', combatPaceLabel(pace), 'pace'],
    ['Animation Pace', animationPaceLabel(animationPace), 'animationPace'],
    ['Text Pace', textPaceLabel(textPace), 'textPace'],
    ['Screen Reader', screenReaderLabel(screenReader.preference), 'screenReader'],
    ['Color Cues', colorCueLabel(colorCues.preference), 'colorCues'],
    ['Screen Shake', screenShakeLabel(screenShake), 'screenShake'],
    ['Flashes', flashEffectsLabel(flashEffects), 'flashEffects'],
  ];
  let musicVolume = audioSnapshot.musicVolume;
  let sfxVolume = audioSnapshot.sfxVolume;
  let voiceVolume = audioSnapshot.voiceVolume;
  let ambienceVolume = audioSnapshot.ambienceVolume;
  let motionPreference = motion.preference;
  let contrastPreference = contrast.preference;
  let colorCuePreference = colorCues.preference;
  let screenShakePreference = screenShake.preference;
  let flashEffectsPreference = flashEffects.preference;
  let graphicsPreference = graphics.preference;
  let pacePreference = pace;
  let animationPacePreference = animationPace;
  let textPacePreference = textPace;
  let screenReaderPreference = screenReader.preference;
  let controlsValueText: Phaser.GameObjects.Text | undefined;
  let audioValueText: Phaser.GameObjects.Text | undefined;
  let audioToggleFrame: Phaser.GameObjects.Image | undefined;
  let openControlsPanel = (_playSound = true) => {};
  const controlsRowIndex = rows.findIndex(([, , kind]) => kind === 'controls');
  const sections = [
    { label: 'Audio', rows: [0, 1, 2, 3, 4], detail: 'Balance music, cues, card voices, and ambience independently.' },
    { label: 'Presentation', rows: [8, 9, 10, 11], detail: 'Tune visual detail and pacing. Combat rules stay the same.' },
    { label: 'Accessibility', rows: [6, 7, 12, 13, 14, 15], detail: 'Adjust motion, contrast, announcements, color cues, shake, and flashes.' },
    { label: 'Controls', rows: [5], detail: 'Remap keyboard actions. Conflicting keys swap safely.' },
  ];
  const navigationOrder = sections.flatMap((section) => section.rows);
  const rowObjects: Phaser.GameObjects.GameObject[][] = rows.map(() => []);
  const sectionButtons: Phaser.GameObjects.Rectangle[] = [];
  let sectionDescription: Phaser.GameObjects.Text | undefined;
  const sectionForRow = (index: number) => sections.findIndex((section) => section.rows.includes(index));
  const focusRegistryKey = `birdsquad.settingsFocus.${scene.scene.key}`;
  const storedFocusIndex = Number(scene.registry.get(focusRegistryKey));
  let focusIndex = Number.isFinite(storedFocusIndex)
    ? Math.round(clamp(storedFocusIndex, 0, rows.length - 1))
    : 0;
  let focusRing: Phaser.GameObjects.Rectangle | undefined;
  const rowFrames: Array<Phaser.GameObjects.Image | undefined> = [];
  const restingRowFrameAlpha = (index: number) => index % 2 === 0 ? 0.44 : 0.3;
  const rowPosition = (index: number) => {
    const row = sections[sectionForRow(index)].rows.indexOf(index);
    const cx = frame.right - 310;
    return { cx, y: frame.top + 198 + row * 64, right: cx + 260 };
  };
  const setFocus = (index: number) => {
    focusIndex = (index + rows.length) % rows.length;
    const position = rowPosition(focusIndex);
    focusRing?.setPosition(position.cx, position.y);
    focusRing?.setData('index', focusIndex);
    focusRing?.setData('label', rows[focusIndex][0]);
    rowFrames.forEach((rowFrame, rowIndex) => {
      rowFrame?.setAlpha(rowIndex === focusIndex ? 0.82 : restingRowFrameAlpha(rowIndex));
    });
    scene.registry.set(focusRegistryKey, focusIndex);
    const sectionIndex = sectionForRow(focusIndex);
    rowObjects.forEach((objects, rowIndex) => objects.forEach((object) => {
      const visible = sectionForRow(rowIndex) === sectionIndex;
      (object as Phaser.GameObjects.Rectangle).setVisible(visible);
      if (object.input) object.input.enabled = visible;
    }));
    sectionButtons.forEach((button, index) => button
      .setFillStyle(index === sectionIndex ? 0x183247 : 0x08131e, 0.98)
      .setStrokeStyle(index === sectionIndex ? 2 : 1, index === sectionIndex ? UI_FIELD.cyan : 0x355163, 1)
      .setData('selected', index === sectionIndex));
    sectionDescription?.setText(sections[sectionIndex].detail);
    scene.registry.set(`birdsquad.settingsDetail.${scene.scene.key}`, {
      section: sections[sectionIndex].label, value: rows[focusIndex][1],
      position: sections[sectionIndex].rows.indexOf(focusIndex) + 1,
      count: sections[sectionIndex].rows.length,
    });
  };
  const moveFocus = (direction: number) => setFocus(navigationOrder[
    (navigationOrder.indexOf(focusIndex) + direction + navigationOrder.length) % navigationOrder.length
  ]);
  const changeSection = (direction: number) => setFocus(sections[
    (sectionForRow(focusIndex) + direction + sections.length) % sections.length
  ].rows[0]);
  const setMusicVolume = (value: number) => {
    musicVolume = Math.round(clamp(value, 0, 1) * 20) / 20;
    options.onSetMusicVolume(musicVolume);
  };
  const setSfxVolume = (value: number) => {
    sfxVolume = Math.round(clamp(value, 0, 1) * 20) / 20;
    options.onSetSfxVolume(sfxVolume);
  };
  const setVoiceVolume = (value: number) => {
    voiceVolume = Math.round(clamp(value, 0, 1) * 20) / 20;
    options.onSetVoiceVolume(voiceVolume);
  };
  const setAmbienceVolume = (value: number) => {
    ambienceVolume = Math.round(clamp(value, 0, 1) * 20) / 20;
    options.onSetAmbienceVolume(ambienceVolume);
  };
  const setMotion = (value: MotionPreference) => {
    motionPreference = value;
    options.onSetMotionPreference(value);
  };
  const setGraphics = (value: GraphicsQualityPreference) => {
    graphicsPreference = value;
    options.onSetGraphicsQualityPreference(value);
  };
  const setContrast = (value: VisualContrastPreference) => {
    contrastPreference = value;
    options.onSetVisualContrastPreference(value);
  };
  const setColorCues = (value: ColorCuePreference) => {
    colorCuePreference = value;
    options.onSetColorCuePreference(value);
  };
  const setScreenShake = (value: ScreenShakePreference) => {
    screenShakePreference = value;
    options.onSetScreenShakePreference(value);
  };
  const setFlashEffects = (value: FlashEffectsPreference) => {
    flashEffectsPreference = value;
    options.onSetFlashEffectsPreference(value);
  };
  const setPace = (value: CombatPace) => {
    pacePreference = value;
    options.onSetCombatPacePreference(value);
  };
  const setAnimationPace = (value: AnimationPace) => {
    animationPacePreference = value;
    options.onSetAnimationPacePreference(value);
  };
  const setTextPace = (value: TextPace) => {
    textPacePreference = value;
    options.onSetTextPacePreference(value);
  };
  const setScreenReader = (value: ScreenReaderPreference) => {
    screenReaderPreference = value;
    options.onSetScreenReaderPreference(value);
  };
  const refreshAudioPresentation = () => {
    const muted = dependencies.audio.isMuted();
    rows[0][1] = muted ? 'Muted' : 'On';
    audioValueText?.setText(muted ? 'Muted' : 'On');
    if (audioToggleFrame) {
      audioToggleFrame.setAlpha(muted ? 0.52 : 0.7);
      if (muted) audioToggleFrame.clearTint();
      else audioToggleFrame.setTint(0xdffaff);
    }
  };
  const notifyAudioToggle = () => {
    refreshAudioPresentation();
    setFocus(focusIndex);
    options.onToggleAudio();
  };
  const toggleAudio = () => {
    if (sectionForRow(focusIndex) === 0 && dependencies.activateAudioToggleControl(scene)) return;
    dependencies.audio.toggleMute();
    notifyAudioToggle();
  };
  const adjustFocused = (direction: -1 | 1) => {
    if (focusIndex === 0) {
      toggleAudio();
      return;
    }
    dependencies.playUiSound('confirm');
    const kind = rows[focusIndex][2];
    if (focusIndex === 1) setMusicVolume(musicVolume + direction * 0.05);
    else if (focusIndex === 2) setSfxVolume(sfxVolume + direction * 0.05);
    else if (focusIndex === 3) setVoiceVolume(voiceVolume + direction * 0.05);
    else if (focusIndex === 4) setAmbienceVolume(ambienceVolume + direction * 0.05);
    else if (kind === 'controls') openControlsPanel();
    else if (kind === 'motion') setMotion(adjacentValue(['full', 'system', 'reduced'] as const, motionPreference, direction));
    else if (kind === 'contrast') setContrast(adjacentValue(['standard', 'high'] as const, contrastPreference, direction));
    else if (kind === 'graphics') setGraphics(adjacentValue(['full', 'auto', 'lean'] as const, graphicsPreference, direction));
    else if (kind === 'pace') setPace(adjacentValue(['cinematic', 'standard', 'snappy'] as const, pacePreference, direction));
    else if (kind === 'animationPace') setAnimationPace(adjacentValue(['relaxed', 'standard', 'fast'] as const, animationPacePreference, direction));
    else if (kind === 'textPace') setTextPace(adjacentValue(['relaxed', 'standard', 'fast'] as const, textPacePreference, direction));
    else if (kind === 'screenReader') setScreenReader(adjacentValue(['off', 'on'] as const, screenReaderPreference, direction));
    else if (kind === 'colorCues') setColorCues(adjacentValue(['standard', 'reinforced'] as const, colorCuePreference, direction));
    else if (kind === 'screenShake') setScreenShake(adjacentValue(['on', 'off'] as const, screenShakePreference, direction));
    else if (kind === 'flashEffects') setFlashEffects(adjacentValue(['full', 'reduced'] as const, flashEffectsPreference, direction));
  };
  const activateFocused = () => {
    if (focusIndex === 0) {
      toggleAudio();
      return;
    }
    dependencies.playUiSound('confirm');
    const kind = rows[focusIndex][2];
    if (focusIndex === 1) setMusicVolume(musicVolume + 0.05);
    else if (focusIndex === 2) setSfxVolume(sfxVolume + 0.05);
    else if (focusIndex === 3) setVoiceVolume(voiceVolume + 0.05);
    else if (focusIndex === 4) setAmbienceVolume(ambienceVolume + 0.05);
    else if (kind === 'controls') openControlsPanel();
    else if (kind === 'motion') setMotion(adjacentValue(['system', 'full', 'reduced'] as const, motionPreference, 1));
    else if (kind === 'contrast') setContrast(adjacentValue(['standard', 'high'] as const, contrastPreference, 1));
    else if (kind === 'graphics') setGraphics(adjacentValue(['auto', 'full', 'lean'] as const, graphicsPreference, 1));
    else if (kind === 'pace') setPace(adjacentValue(['cinematic', 'standard', 'snappy'] as const, pacePreference, 1));
    else if (kind === 'animationPace') setAnimationPace(adjacentValue(['relaxed', 'standard', 'fast'] as const, animationPacePreference, 1));
    else if (kind === 'textPace') setTextPace(adjacentValue(['relaxed', 'standard', 'fast'] as const, textPacePreference, 1));
    else if (kind === 'screenReader') setScreenReader(adjacentValue(['off', 'on'] as const, screenReaderPreference, 1));
    else if (kind === 'colorCues') setColorCues(adjacentValue(['standard', 'reinforced'] as const, colorCuePreference, 1));
    else if (kind === 'screenShake') setScreenShake(adjacentValue(['on', 'off'] as const, screenShakePreference, 1));
    else if (kind === 'flashEffects') setFlashEffects(adjacentValue(['full', 'reduced'] as const, flashEffectsPreference, 1));
  };
const addSettingsObject = addTo;
  rows.forEach(([label, value, kind], index) => {
    const addTo: UiAdd = (object) => {
      rowObjects[index].push(object);
      addSettingsObject(object);
    };
    const position = rowPosition(index);
    const { cx, y, right } = position;
    addUi(addTo, scene.add.rectangle(cx, y, 502, 42, 0x050a12, index % 2 === 0 ? 0.42 : 0.26));
    const rowFrame = addSystemSettingsRowFrame(scene, addTo, cx, y, 530, MIN_SUPPORTED_TOUCH_TARGET, {
      alpha: restingRowFrameAlpha(index),
    }, dependencies);
    rowFrame?.setName(`system-settings-row-frame-${index}`);
    rowFrames[index] = rowFrame;
    const focusZone = addUi(addTo, scene.add.rectangle(cx, y, 530, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setName(`system-settings-row-${index}-hit`)
      .setInteractive({ useHandCursor: kind !== 'slider' }));
    focusZone.on('pointerover', () => setFocus(index));
    focusZone.on('pointerdown', () => {
      setFocus(index);
      if (index === 0) toggleAudio();
      else if (kind === 'controls') openControlsPanel();
      else if (kind === 'motion') setMotion(adjacentValue(['system', 'full', 'reduced'] as const, motionPreference, 1));
      else if (kind === 'contrast') setContrast(adjacentValue(['standard', 'high'] as const, contrastPreference, 1));
      else if (kind === 'graphics') setGraphics(adjacentValue(['auto', 'full', 'lean'] as const, graphicsPreference, 1));
      else if (kind === 'pace') setPace(adjacentValue(['cinematic', 'standard', 'snappy'] as const, pacePreference, 1));
      else if (kind === 'animationPace') setAnimationPace(adjacentValue(['relaxed', 'standard', 'fast'] as const, animationPacePreference, 1));
      else if (kind === 'textPace') setTextPace(adjacentValue(['relaxed', 'standard', 'fast'] as const, textPacePreference, 1));
      else if (kind === 'screenReader') setScreenReader(adjacentValue(['off', 'on'] as const, screenReaderPreference, 1));
      else if (kind === 'colorCues') setColorCues(adjacentValue(['standard', 'reinforced'] as const, colorCuePreference, 1));
      else if (kind === 'screenShake') setScreenShake(adjacentValue(['on', 'off'] as const, screenShakePreference, 1));
      else if (kind === 'flashEffects') setFlashEffects(adjacentValue(['full', 'reduced'] as const, flashEffectsPreference, 1));
    });
    addUi(addTo, scene.add.text(cx - 238, y, label, {
      fontFamily: UI_FONT,
      fontSize: '17px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.text,
    }).setOrigin(0, 0.5));
    if (kind === 'slider') {
      const slider = label === 'Music'
        ? { value: audioSnapshot.musicVolume, color: UI_FIELD.cyan, name: 'music', set: setMusicVolume }
        : label === 'SFX'
          ? { value: audioSnapshot.sfxVolume, color: UI_FIELD.gold, name: 'sfx', set: setSfxVolume }
          : label === 'Card Voices'
            ? { value: audioSnapshot.voiceVolume, color: UI_FIELD.brass, name: 'voices', set: setVoiceVolume }
            : { value: audioSnapshot.ambienceVolume, color: UI_FIELD.green, name: 'ambience', set: setAmbienceVolume };
      renderSettingsVolumeSlider(
        scene,
        addTo,
        right - 186,
        y,
        254,
        slider.value,
        slider.color,
        (next) => {
          setFocus(index);
          slider.set(next);
        },
        `system-settings-${slider.name}-slider-hit`,
        dependencies,
      );
      addUi(addTo, scene.add.text(right - 62, y, value, {
        fontFamily: UI_FONT,
        fontSize: '16px',
        fontStyle: UI_BOLD,
        color: UI_FIELD.text,
        align: 'right',
      }).setOrigin(1, 0.5));
    } else if (kind === 'motion') {
      renderSettingsMotionSwitch(scene, addTo, right - 184, y, motion.preference, () => {
        setFocus(index);
        setMotion(adjacentValue(['system', 'full', 'reduced'] as const, motionPreference, 1));
      }, dependencies);
      addUi(addTo, scene.add.text(right - 62, y, value, {
        fontFamily: UI_FONT,
        fontSize: '16px',
        fontStyle: UI_BOLD,
        color: motion.reduced ? '#ffe7a8' : UI_FIELD.text,
        align: 'right',
      }).setOrigin(1, 0.5));
    } else if (kind === 'pace') {
      renderSettingsCombatPaceSwitch(scene, addTo, right - 184, y, pace, () => {
        setFocus(index);
        setPace(adjacentValue(['cinematic', 'standard', 'snappy'] as const, pacePreference, 1));
      }, dependencies);
      addUi(addTo, scene.add.text(right - 62, y, value, {
        fontFamily: UI_FONT,
        fontSize: '16px',
        fontStyle: UI_BOLD,
        color: UI_FIELD.text,
        align: 'right',
      }).setOrigin(1, 0.5));
    } else if (kind === 'animationPace') {
      const toggle = addSystemSettingsToggleFrame(scene, addTo, right - 144, y, 176, 42, {
        alpha: 0.7,
        tint: animationPace === 'standard' ? undefined : 0xdffaff,
      }, dependencies);
      const animationHit = addUi(addTo, scene.add.rectangle(right - 144, y, 276, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
        .setName('system-settings-animation-pace-toggle-hit')
        .setInteractive({ useHandCursor: true }));
      animationHit.on('pointerdown', () => {
        setFocus(index);
        setAnimationPace(adjacentValue(['relaxed', 'standard', 'fast'] as const, animationPacePreference, 1));
      });
      if (toggle) toggle.setName('system-settings-animation-pace-frame');
      addUi(addTo, scene.add.text(right - 96, y, value, {
        fontFamily: UI_FONT,
        fontSize: '17px',
        fontStyle: UI_BOLD,
        color: UI_FIELD.text,
        align: 'right',
      }).setOrigin(1, 0.5));
    } else if (kind === 'contrast') {
      renderSettingsContrastSwitch(scene, addTo, right - 144, y, contrast.preference, () => {
        setFocus(index);
        setContrast(adjacentValue(['standard', 'high'] as const, contrastPreference, 1));
      }, dependencies);
      addUi(addTo, scene.add.text(right - 96, y, value, {
        fontFamily: UI_FONT,
        fontSize: '17px',
        fontStyle: UI_BOLD,
        color: contrast.highContrast ? UI_CYAN : UI_FIELD.text,
        align: 'right',
      }).setOrigin(1, 0.5));
    } else if (kind === 'graphics') {
      renderSettingsGraphicsQualitySwitch(scene, addTo, right - 184, y, graphics.preference, () => {
        setFocus(index);
        setGraphics(adjacentValue(['auto', 'full', 'lean'] as const, graphicsPreference, 1));
      }, dependencies);
      addUi(addTo, scene.add.text(right - 62, y, value, {
        fontFamily: UI_FONT,
        fontSize: '16px',
        fontStyle: UI_BOLD,
        color: graphics.lean ? '#ffe7a8' : UI_FIELD.text,
        align: 'right',
      }).setOrigin(1, 0.5));
    } else {
      const toggleFrame = addSystemSettingsToggleFrame(scene, addTo, right - 144, y, 176, 42, {
        alpha: label === 'Audio' && dependencies.audio.isMuted() ? 0.52 : 0.7,
        tint: (label === 'Audio' && !dependencies.audio.isMuted())
          || (kind === 'screenReader' && screenReader.enabled)
          || (kind === 'colorCues' && colorCues.reinforced)
          || (kind === 'screenShake' && screenShake.enabled)
          || (kind === 'flashEffects' && flashEffects.reduced)
          ? 0xdffaff
          : undefined,
      }, dependencies);
      const valueText = addUi(addTo, scene.add.text(right - 96, y, value, {
        fontFamily: UI_FONT,
        fontSize: '17px',
        fontStyle: UI_BOLD,
        color: UI_FIELD.text,
        align: 'right',
      }).setOrigin(1, 0.5));
      if (label === 'Audio') {
        audioValueText = valueText.setName('system-settings-audio-value');
        audioToggleFrame = toggleFrame;
      }
      if (kind === 'controls') controlsValueText = valueText;
    }
  });

  const initialFocusPosition = rowPosition(focusIndex);
  focusRing = addUi(addTo, scene.add.rectangle(initialFocusPosition.cx, initialFocusPosition.y, 536, MIN_SUPPORTED_TOUCH_TARGET, 0x06151b, 0.04)
    .setStrokeStyle(2, UI_FIELD.cyan, 0.96)
    .setName('system-settings-focus-ring'));
  const audioPosition = rowPosition(0);
  dependencies.renderAudioToggleControl(scene, (object) => {
    rowObjects[0].push(object);
    addTo(object);
  }, audioPosition.right - 48, audioPosition.y, () => {
    setFocus(0);
    notifyAudioToggle();
  });
  sections.forEach((section, index) => {
    const x = frame.left + 226;
    const y = frame.top + 198 + index * 68;
    const button = addUi(addTo, scene.add.rectangle(x, y, 280, MIN_SUPPORTED_TOUCH_TARGET, 0x08131e, 0.98)
      .setInteractive({ useHandCursor: true })
      .setName(`system-settings-section-${index}-hit`)
      .setData('label', section.label));
    button.on('pointerdown', () => {
      dependencies.playUiSound('confirm');
      setFocus(section.rows[0]);
    });
    sectionButtons.push(button);
    addUi(addTo, scene.add.text(x - 118, y, section.label, {
      fontFamily: UI_FONT, fontSize: '18px', fontStyle: UI_BOLD, color: UI_GOLD,
    }).setOrigin(0, 0.5));
  });
  sectionDescription = addUi(addTo, scene.add.text(frame.left + 88, frame.top + 454, '', {
    fontFamily: UI_FONT, fontSize: '15px', color: UI_SOFT,
    wordWrap: { width: 280 }, maxLines: 4,
  }).setName('system-settings-section-description'));
  addUi(addTo, scene.add.text(frame.cx, frame.bottom - 30, 'Up / Down / Tab: move   ·   Left / Right: adjust   ·   PgUp / PgDn or LB / RB: section', {
    fontFamily: UI_FONT, fontSize: '13px', color: UI_CYAN,
    align: 'center', fixedWidth: 1000,
  }).setOrigin(0.5).setName('system-settings-navigation-hint'));
  setFocus(focusIndex);
  dependencies.renderFieldButton(scene, addTo, frame.cx, frame.bottom - 72, 190, MIN_SUPPORTED_TOUCH_TARGET, scene.scale.isFullscreen ? 'Windowed' : 'Full Screen', true, () => {
    options.onToggleFullscreen();
  }, UI_FIELD.cyan);

  const controlsPageKey = controlPanelPageRegistryKey(scene);
  const controlsFocusKey = controlPanelFocusRegistryKey(scene);
  let controlsPanel: Phaser.GameObjects.Container | undefined;
  let controlsFocusRing: Phaser.GameObjects.Rectangle | undefined;
  let controlsRowFrames: Array<Phaser.GameObjects.Image | undefined> = [];
  const restingControlsRowFrameAlpha = (index: number) => index % 2 === 0 ? 0.42 : 0.28;
  let controlsPage: ControlBindingPage = scene.registry.get(controlsPageKey) === 'utility' ? 'utility' : 'play';
  let controlsFocusIndex = Number(scene.registry.get(controlsFocusKey));
  if (!Number.isFinite(controlsFocusIndex)) controlsFocusIndex = 0;
  controlsFocusIndex = Math.round(clamp(controlsFocusIndex, 0, 6));
  const storedCaptureAction = scene.registry.get(controlsCaptureKey);
  let captureAction = reopenControlsPanel
    && CONTROL_BINDING_DEFINITIONS.some((definition) => definition.action === storedCaptureAction)
      ? storedCaptureAction as ControlAction
      : undefined;
  let controlsStatus = '';
  let renderControlsPanel = () => {};

  const pageDefinitions = () => CONTROL_BINDING_DEFINITIONS.filter((definition) => definition.page === controlsPage);
  const controlsFocusGeometry = (index: number, controlFrame: FieldFrame) => index < 6
    ? { x: controlFrame.cx, y: controlFrame.top + 200 + index * MIN_SUPPORTED_TOUCH_TARGET, width: 566, height: MIN_SUPPORTED_TOUCH_TARGET }
    : { x: controlFrame.cx, y: controlFrame.bottom - 58, width: 196, height: 58 };

  const updateControlsValue = () => {
    rows[controlsRowIndex][1] = controlBindingsAreDefault() ? 'Default' : 'Custom';
    controlsValueText?.setText(rows[controlsRowIndex][1]);
  };

  const setControlsFocus = (index: number, controlFrame?: FieldFrame) => {
    controlsFocusIndex = (index + 7) % 7;
    scene.registry.set(controlsFocusKey, controlsFocusIndex);
    if (!controlsFocusRing || !controlFrame) return;
    const geometry = controlsFocusGeometry(controlsFocusIndex, controlFrame);
    controlsFocusRing.setPosition(geometry.x, geometry.y).setSize(geometry.width, geometry.height);
    controlsFocusRing.setDisplaySize(geometry.width, geometry.height);
    const definition = pageDefinitions()[controlsFocusIndex];
    controlsFocusRing.setData('index', controlsFocusIndex);
    controlsFocusRing.setData('label', definition?.label ?? 'Reset Defaults');
    controlsRowFrames.forEach((rowFrame, rowIndex) => {
      rowFrame?.setAlpha(rowIndex === controlsFocusIndex ? 0.82 : restingControlsRowFrameAlpha(rowIndex));
    });
  };

  const closeControlsPanel = (playSound = true) => {
    const wasOpen = Boolean(controlsPanel?.active) || Boolean(scene.registry.get(controlsPanelKey));
    captureAction = undefined;
    scene.registry.remove(controlsCaptureKey);
    scene.registry.set(controlsPanelKey, false);
    controlsPanel?.destroy(true);
    controlsPanel = undefined;
    controlsFocusRing = undefined;
    if (wasOpen) {
      if (focusRing?.active) focusRing.setVisible(true);
      setFocus(controlsRowIndex);
      if (playSound) dependencies.playUiSound('close');
    }
  };

  const setControlsPage = (page: ControlBindingPage) => {
    if (controlsPage === page) return;
    controlsPage = page;
    controlsFocusIndex = Math.min(controlsFocusIndex, 5);
    captureAction = undefined;
    controlsStatus = '';
    scene.registry.set(controlsPageKey, page);
    scene.registry.remove(controlsCaptureKey);
    dependencies.playUiSound('confirm');
    renderControlsPanel();
  };

  const beginControlCapture = (action: ControlAction) => {
    captureAction = action;
    controlsStatus = `Listening for ${controlActionLabel(action)}`;
    scene.registry.set(controlsCaptureKey, action);
    dependencies.playUiSound('confirm');
    renderControlsPanel();
  };

  const resetAllControls = () => {
    resetControlBindings();
    captureAction = undefined;
    controlsStatus = 'Default keyboard bindings restored';
    scene.registry.remove(controlsCaptureKey);
    updateControlsValue();
    dependencies.playUiSound('confirm');
    renderControlsPanel();
  };

  const activateControlsFocus = () => {
    const definition = pageDefinitions()[controlsFocusIndex];
    if (definition) beginControlCapture(definition.action);
    else resetAllControls();
  };

  renderControlsPanel = () => {
    controlsPanel?.destroy(true);
    const panel = scene.add.container(0, 0).setName('system-controls-panel');
    controlsPanel = addUi(addTo, panel);
    controlsRowFrames = [];
    const addPanel: UiAdd = (object) => panel.add(object);
    addUi(addPanel, scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.97)
      .setInteractive({ useHandCursor: false })
      .setName('system-controls-modal-backdrop'));
    const controlFrame = dependencies.renderFieldPanel(scene, addPanel, GAME_WIDTH / 2, GAME_HEIGHT / 2, 760, 660, {
      accent: UI_FIELD.cyan,
      fill: UI_FIELD.ink,
    });
    panel.setData('frame', controlFrame);
    addOverlayPanelFlourish(scene, addPanel, controlFrame, { alpha: 0.14, tint: 0xdffaff, yOffset: 2 }, dependencies);
    addSystemMenuCommandFrame(scene, addPanel, controlFrame, { alpha: 0.24, yOffset: 1 }, dependencies);
    const controlIcon = addIconImage(scene, 'settings-medallion', controlFrame.left + 104, controlFrame.top + 102, 50);
    if (controlIcon) addUi(addPanel, controlIcon.setAlpha(0.96));
    addSystemOverlayTitlePlaque(scene, addPanel, controlFrame.left + 390, controlFrame.top + 82, 500, 86, {
      alpha: 0.5,
      tint: 0xdffaff,
    });
    addUi(addPanel, scene.add.text(controlFrame.left + 190, controlFrame.top + 58, 'Controls', {
      fontFamily: 'Georgia, serif',
      fontSize: '32px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      stroke: '#000000',
      strokeThickness: 4,
    }));
    addUi(addPanel, scene.add.text(controlFrame.left + 192, controlFrame.top + 100, 'Keyboard bindings  /  Controller: Standard', {
      fontFamily: UI_FONT,
      fontSize: '14px',
      fontStyle: UI_BOLD,
      color: UI_CYAN,
    }));
    dependencies.renderCloseControl(scene, addPanel, controlFrame.right - 64, controlFrame.top + 52, () => closeControlsPanel());

    (['play', 'utility'] as const).forEach((page, index) => {
      const x = controlFrame.cx - 96 + index * 192;
      const active = page === controlsPage;
      addSystemSettingsToggleFrame(scene, addPanel, x, controlFrame.top + 132, 174, 40, {
        alpha: active ? 0.84 : 0.5,
        tint: active ? 0xdffaff : undefined,
      }, dependencies);
      const hit = addUi(addPanel, scene.add.rectangle(x, controlFrame.top + 132, 180, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
        .setName(`system-controls-${page}-tab-hit`)
        .setInteractive({ useHandCursor: true }));
      hit.on('pointerdown', () => setControlsPage(page));
      addUi(addPanel, scene.add.text(x, controlFrame.top + 132, page === 'play' ? 'Play' : 'Utility', {
        fontFamily: UI_FONT,
        fontSize: '13px',
        fontStyle: UI_BOLD,
        color: active ? UI_CYAN : UI_FIELD.muted,
      }).setOrigin(0.5));
    });

    const definitions = pageDefinitions();
    definitions.forEach((definition, index) => {
      const y = controlFrame.top + 200 + index * MIN_SUPPORTED_TOUCH_TARGET;
      addUi(addPanel, scene.add.rectangle(controlFrame.cx, y, 548, 42, 0x050a12, index % 2 === 0 ? 0.42 : 0.26));
      const rowFrame = addSystemSettingsRowFrame(scene, addPanel, controlFrame.cx, y, 566, MIN_SUPPORTED_TOUCH_TARGET, {
        alpha: restingControlsRowFrameAlpha(index),
      }, dependencies);
      rowFrame?.setName(`system-controls-row-frame-${index}`);
      controlsRowFrames[index] = rowFrame;
      const hit = addUi(addPanel, scene.add.rectangle(controlFrame.cx, y, 566, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
        .setName(`system-controls-binding-${definition.action}-hit`)
        .setInteractive({ useHandCursor: true }));
      hit.on('pointerover', () => setControlsFocus(index, controlFrame));
      hit.on('pointerdown', () => {
        setControlsFocus(index, controlFrame);
        beginControlCapture(definition.action);
      });
      addUi(addPanel, scene.add.text(controlFrame.left + 126, y, definition.label, {
        fontFamily: UI_FONT,
        fontSize: '14px',
        fontStyle: UI_BOLD,
        color: UI_FIELD.text,
      }).setOrigin(0, 0.5));
      addSystemSettingsToggleFrame(scene, addPanel, controlFrame.right - 164, y, 196, 40, {
        alpha: captureAction === definition.action ? 0.9 : 0.68,
        tint: captureAction === definition.action ? 0xffefc4 : 0xdffaff,
      }, dependencies);
      addUi(addPanel, scene.add.text(controlFrame.right - 164, y, captureAction === definition.action ? 'Press a key' : controlBindingLabel(definition.action), {
        fontFamily: UI_FONT,
        fontSize: '13px',
        fontStyle: UI_BOLD,
        color: captureAction === definition.action ? UI_GOLD : UI_CYAN,
        align: 'center',
      }).setOrigin(0.5));
    });

    addUi(addPanel, scene.add.text(controlFrame.cx, controlFrame.bottom - 104, controlsStatus, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: captureAction ? UI_GOLD : UI_SOFT,
      align: 'center',
      wordWrap: { width: 520 },
    }).setOrigin(0.5));

    dependencies.renderFieldButton(scene, addPanel, controlFrame.cx, controlFrame.bottom - 58, 190, 56, 'Reset Defaults', true, resetAllControls, UI_FIELD.cyan);
    const resetGeometry = controlsFocusGeometry(6, controlFrame);
    const resetHit = addUi(addPanel, scene.add.rectangle(resetGeometry.x, resetGeometry.y, resetGeometry.width, resetGeometry.height, 0x020409, 0.001)
      .setName('system-controls-reset-hit')
      .setInteractive({ useHandCursor: true }));
    resetHit.on('pointerover', () => setControlsFocus(6, controlFrame));
    resetHit.on('pointerdown', () => {
      setControlsFocus(6, controlFrame);
      resetAllControls();
    });

    const geometry = controlsFocusGeometry(controlsFocusIndex, controlFrame);
    controlsFocusRing = addUi(addPanel, scene.add.rectangle(geometry.x, geometry.y, geometry.width, geometry.height, 0x06151b, 0.04)
      .setStrokeStyle(2, UI_FIELD.cyan, 0.98)
      .setName('system-controls-focus-ring'));
    setControlsFocus(controlsFocusIndex, controlFrame);
  };

  openControlsPanel = (playSound = true) => {
    if (controlsPanel?.active) return;
    setFocus(controlsRowIndex);
    focusRing?.setVisible(false);
    scene.registry.set(controlsPanelKey, true);
    scene.registry.set(controlsPageKey, controlsPage);
    if (playSound) dependencies.playUiSound('confirm');
    renderControlsPanel();
  };
  if (reopenControlsPanel) openControlsPanel(false);

  const onKeyDown = (event: KeyboardEvent) => {
    if (cleanedUp || !lifecycle.active || !scene.sys.settings.active) return;
    let handled = true;
    if (controlsPanel?.active) {
      if (captureAction) {
        if (event.code === 'Escape' && captureAction !== 'back') {
          captureAction = undefined;
          controlsStatus = 'Binding unchanged';
          scene.registry.remove(controlsCaptureKey);
          dependencies.playUiSound('close');
          renderControlsPanel();
        } else if (!isBindableControlCode(event.code)) {
          controlsStatus = `${controlCodeLabel(event.code)} is reserved`;
          dependencies.playUiSound('locked');
          renderControlsPanel();
        } else {
          const action = captureAction;
          const update = setControlBinding(action, event.code);
          captureAction = undefined;
          scene.registry.remove(controlsCaptureKey);
          if (update) {
            controlsStatus = update.swappedAction
              ? `${controlActionLabel(action)}: ${controlCodeLabel(event.code)}  /  swapped with ${controlActionLabel(update.swappedAction)}`
              : `${controlActionLabel(action)}: ${controlCodeLabel(event.code)}`;
            updateControlsValue();
            dependencies.playUiSound('confirm');
          }
          renderControlsPanel();
        }
      } else if (event.key === 'ArrowUp') setControlsFocus(controlsFocusIndex - 1, controlsPanel.getData('frame'));
      else if (event.key === 'ArrowDown') setControlsFocus(controlsFocusIndex + 1, controlsPanel.getData('frame'));
      else if (event.key === 'Tab') setControlsFocus(controlsFocusIndex + (event.shiftKey ? -1 : 1), controlsPanel.getData('frame'));
      else if (event.key === 'ArrowLeft' || matchesControlAction(event, 'previous')) {
        if (controlsFocusIndex >= 6) setControlsFocus(6, controlsPanel.getData('frame'));
        else setControlsPage(controlsPage === 'play' ? 'utility' : 'play');
      } else if (event.key === 'ArrowRight' || matchesControlAction(event, 'next')) {
        if (controlsFocusIndex >= 6) setControlsFocus(6, controlsPanel.getData('frame'));
        else setControlsPage(controlsPage === 'play' ? 'utility' : 'play');
      } else if (event.key === 'Enter' || event.key === ' ' || matchesControlAction(event, 'confirm')) activateControlsFocus();
      else if (event.key === 'Escape' || matchesControlAction(event, 'back')) closeControlsPanel();
      else handled = false;
    } else if (event.key === 'PageUp') changeSection(-1);
    else if (event.key === 'PageDown') changeSection(1);
    else if (event.key === 'ArrowUp') moveFocus(-1);
    else if (event.key === 'ArrowDown') moveFocus(1);
    else if (event.key === 'Tab') moveFocus(event.shiftKey ? -1 : 1);
    else if (event.key === 'ArrowLeft' || matchesControlAction(event, 'previous')) adjustFocused(-1);
    else if (event.key === 'ArrowRight' || matchesControlAction(event, 'next')) adjustFocused(1);
    else if (event.key === 'Enter' || event.key === ' ' || matchesControlAction(event, 'confirm')) activateFocused();
    else if (event.key === 'Escape' || matchesControlAction(event, 'back')) dismissSettingsOverlay();
    else if (matchesControlAction(event, 'mute')) toggleAudio();
    else if (matchesControlAction(event, 'fullscreen')) options.onToggleFullscreen();
    else handled = false;
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const onGamepadDown = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
    if (cleanedUp || !lifecycle.active || !scene.sys.settings.active) return;
    if (controlsPanel?.active) {
      const controlFrame = controlsPanel.getData('frame') as FieldFrame;
      if (captureAction && button.index === 1) {
        captureAction = undefined;
        controlsStatus = 'Binding unchanged';
        scene.registry.remove(controlsCaptureKey);
        dependencies.playUiSound('close');
        renderControlsPanel();
      } else if (!captureAction && button.index === 12) setControlsFocus(controlsFocusIndex - 1, controlFrame);
      else if (!captureAction && button.index === 13) setControlsFocus(controlsFocusIndex + 1, controlFrame);
      else if (!captureAction && button.index === 14) {
        if (controlsFocusIndex >= 6) setControlsFocus(6, controlFrame);
        else setControlsPage(controlsPage === 'play' ? 'utility' : 'play');
      } else if (!captureAction && button.index === 15) {
        if (controlsFocusIndex >= 6) setControlsFocus(6, controlFrame);
        else setControlsPage(controlsPage === 'play' ? 'utility' : 'play');
      } else if (!captureAction && button.index === 0) activateControlsFocus();
      else if (!captureAction && button.index === 1) closeControlsPanel();
      return;
    }
    if (button.index === 4) changeSection(-1);
    else if (button.index === 5) changeSection(1);
    else if (button.index === 12) moveFocus(-1);
    else if (button.index === 13) moveFocus(1);
    else if (button.index === 14) adjustFocused(-1);
    else if (button.index === 15) adjustFocused(1);
    else if (button.index === 0) activateFocused();
    else if (button.index === 1) dismissSettingsOverlay();
  };
  scene.input.keyboard?.on('keydown', onKeyDown);
  scene.input.gamepad?.on('down', onGamepadDown);
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    scene.input.keyboard?.off('keydown', onKeyDown);
    scene.input.gamepad?.off('down', onGamepadDown);
    controlsPanel?.destroy(true);
    controlsPanel = undefined;
    controlsFocusRing = undefined;
    if (settingsInputCleanups.get(scene) === cleanup) {
      scene.registry.set(settingsInputKey, false);
      settingsInputCleanups.delete(scene);
    }
    lifecycle.off(Phaser.GameObjects.Events.DESTROY, cleanup);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onSceneShutdown);
  };
  const onSceneShutdown = () => {
    cleanup();
  };
  settingsInputCleanups.set(scene, cleanup);
  lifecycle.once(Phaser.GameObjects.Events.DESTROY, cleanup);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onSceneShutdown);
}

export function renderHowToPlayOverlay(
  scene: Phaser.Scene,
  addTo: UiAdd,
  options: HowToPlayOverlayOptions,
  dependencies: SystemOverlayDependencies,
) {
  addUi(addTo, scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.93)
    .setInteractive({ useHandCursor: false }));
  const frame = dependencies.renderFieldPanel(scene, addTo, GAME_WIDTH / 2, GAME_HEIGHT / 2, 1060, 620, {
    accent: UI_FIELD.brass,
    fill: UI_FIELD.ink,
  });
  addOverlayPanelFlourish(scene, addTo, frame, { alpha: 0.18, yOffset: 2 }, dependencies);
  addHowToPlayGuideFrame(scene, addTo, frame, dependencies);
  const icon = addIconImage(scene, 'help-medallion', frame.left + 106, frame.top + 92, 50);
  if (icon) addUi(addTo, icon.setAlpha(0.96));
  addSystemOverlayTitlePlaque(scene, addTo, frame.left + 390, frame.top + 82, 500, 92, {
    alpha: 0.52,
    tint: 0xffefc4,
  });
  addUi(addTo, scene.add.text(frame.left + 188, frame.top + 58, 'How to Play', {
    fontFamily: 'Georgia, serif',
    fontSize: '34px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
    stroke: '#000000',
    strokeThickness: 4,
  }));
  addUi(addTo, scene.add.text(frame.left + 190, frame.top + 104, 'Build a flock, learn its combinations, and adapt your next choice. No single build is required.', {
    fontFamily: UI_FONT,
    fontSize: '16px',
    fontStyle: UI_BOLD,
    color: UI_CYAN,
    wordWrap: { width: 740 },
  }).setName('how-to-play-readable'));
  dependencies.renderCloseControl(scene, addTo, frame.right - 68, frame.top + 58, options.onClose);

  const cards = [
    {
      title: '1 / Plan the Route',
      icon: 'route-pin',
      accent: UI_FIELD.cyan,
      body: 'Compare GAIN and RISK. Choose fights, healing, or a Market to suit your current flock.',
    },
    {
      title: '2 / Read, Play, Roost',
      icon: 'release-card',
      accent: UI_FIELD.danger,
      body: 'Read enemy intent. Spend Wingbeats on cards; Cover protects Cohesion. Roost ends your turn.',
    },
    {
      title: '3 / Add or Skip',
      icon: 'draw-stack',
      accent: UI_FIELD.green,
      body: 'Inspect rewards for fit. Adding changes your draw pool and Flock Stats. Skip keeps the deck and grants Scrap.',
    },
    {
      title: '4 / Preen a Card',
      icon: 'preen-kit',
      accent: UI_FIELD.brass,
      body: 'Compare the exact upgrade before choosing. Preen improves a card for this flight without adding a copy.',
    },
    {
      title: '5 / Shape Your Deck',
      icon: 'flock-heart',
      accent: UI_FIELD.green,
      body: 'Review your deck on the route. Balance damage, Cover, and recovery; leave room to try new combinations.',
    },
    {
      title: '6 / Learn and Fly Again',
      icon: 'record-medallion',
      accent: UI_FIELD.cyan,
      body: 'Your collection record persists. Flight upgrades do not. Review the result, then try another plan.',
    },
  ];
  cards.forEach((card, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = frame.left + 184 + column * 346;
    const y = frame.top + 230 + row * 158;
    addHowToPlayTopicCardFrame(scene, addTo, x, y, 316, 140, card.accent, dependencies);
    addUi(addTo, scene.add.rectangle(x, y, 304, 128, 0x06111b, 0.96)
      .setStrokeStyle(1, card.accent, 0.5).setName('how-to-play-topic-panel'));
    const cardIcon = addIconImage(scene, card.icon, x - 130, y - 43, 24);
    if (cardIcon) addUi(addTo, cardIcon.setDisplaySize(24, 24).setAlpha(0.92).setName('how-to-play-topic-icon'));
    addUi(addTo, scene.add.text(x - 110, y - 53, card.title, {
      fontFamily: UI_FONT,
      fontSize: '17px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.warm,
    }).setResolution(2).setName('how-to-play-readable'));
    addUi(addTo, scene.add.text(x - 136, y - 22, card.body, {
      fontFamily: UI_FONT,
      fontSize: '16px',
      color: '#e6eef5',
      lineSpacing: 2,
      wordWrap: { width: 272 },
    }).setResolution(2).setName('how-to-play-readable'));
  });

  const tips: Array<[string, string]> = [
    [
      'Quick keys',
      `${controlBindingLabel('roost')} Roost  |  ${controlBindingLabel('confirm')} Confirm  |  1-9 Cards  |  ${controlBindingLabel('skipReward')} Skip  |  ${controlBindingLabel('mute')} Mute`,
    ],
    ['Your pace', 'Inspect before committing. Skip or replay the guide whenever you like.'],
  ];
  tips.forEach(([label, value], index) => {
    const y = frame.bottom - 125 + index * 32;
    const accent = index % 2 === 0 ? UI_FIELD.cyan : UI_FIELD.brass;
    const textAccent = index % 2 === 0 ? UI_CYAN : UI_GOLD;
    addHowToPlayTipRowFrame(
      scene,
      addTo,
      frame.cx,
      y,
      968,
      28,
      index % 2 === 0 ? 0.34 : 0.24,
      accent,
    );
    addUi(addTo, scene.add.rectangle(frame.cx, y, 940, 28, 0x050a12, 0.94));
    addUi(addTo, scene.add.text(frame.cx - 458, y, label.toUpperCase(), {
      fontFamily: UI_FONT,
      fontSize: '14px',
      fontStyle: UI_BOLD,
      color: textAccent,
      fixedWidth: 100,
      maxLines: 1,
    }).setOrigin(0, 0.5).setResolution(2).setName('how-to-play-tip-label'));
    addUi(addTo, scene.add.text(frame.cx - 340, y, value, {
      fontFamily: UI_FONT,
      fontSize: '15px',
      color: UI_FIELD.text,
      fixedWidth: 800,
      maxLines: 1,
    }).setOrigin(0, 0.5).setResolution(2).setName('how-to-play-tip-value'));
  });

  const guideLabel = options.guide.enabled && !options.guide.completed ? 'Skip Guide' : 'Replay Guide';
  dependencies.renderFieldButton(scene, addTo, frame.cx, frame.bottom - 42, 190, 56, guideLabel, true, options.onGuideAction, UI_FIELD.cyan);
}
