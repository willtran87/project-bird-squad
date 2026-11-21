import Phaser from 'phaser';
import { setFeedbackTextHoldScale } from '../fx';
import { safeStorageGet, safeStorageSet } from '../safe-storage';
import { controlPanelRegistryKey, controlPanelFocusRegistryKey, controlPanelPageRegistryKey, controlCaptureRegistryKey, controlBindingsAreDefault, CONTROL_BINDING_DEFINITIONS, controlBindingLabel } from '../input-bindings';
import { screenShakeState, flashEffectsState } from '../visual-accessibility';
import type { AnimationPace, CombatPace, MotionPreference, TextPace } from './runtime-types';
import { COMBAT_INTRO_MIN_DISMISS_MS } from './fx-textures';
import { FAST_MODE_TIME_SCALE, normalizeFastMode, normalizeRumble, type FastModePreference, type RumblePreference } from '../pace-rules';

const SETTINGS_CONTROL_LABELS = ['Audio', 'Music', 'SFX', 'Card Voices', 'Ambience', 'Controls', 'Motion', 'Contrast', 'Effects', 'Combat Pace', 'Animation Pace', 'Text Pace', 'Screen Reader', 'Color Cues', 'Screen Shake', 'Flashes', 'Fast Mode', 'Rumble'] as const;


export function settingsFocusState(scene: Phaser.Scene, open: boolean) {
  if (!open) return undefined;
  const stored = Number(scene.registry.get(`birdsquad.settingsFocus.${scene.scene.key}`));
  const index = Number.isFinite(stored) ? Phaser.Math.Clamp(Math.round(stored), 0, SETTINGS_CONTROL_LABELS.length - 1) : 0;
  return { index, label: SETTINGS_CONTROL_LABELS[index], ...scene.registry.get(`birdsquad.settingsDetail.${scene.scene.key}`) };
}


export function controlsTextState(scene: Phaser.Scene, settingsOpen: boolean) {
  const panelOpen = settingsOpen && Boolean(scene.registry.get(controlPanelRegistryKey(scene)));
  const focus = Number(scene.registry.get(controlPanelFocusRegistryKey(scene)));
  const page = scene.registry.get(controlPanelPageRegistryKey(scene));
  const capture = scene.registry.get(controlCaptureRegistryKey(scene));
  return {
    customized: !controlBindingsAreDefault(),
    panelOpen,
    page: panelOpen && (page === 'utility' || page === 'play') ? page : undefined,
    focusIndex: panelOpen && Number.isFinite(focus) ? Math.round(focus) : undefined,
    captureAction: panelOpen && typeof capture === 'string' ? capture : undefined,
    bindings: Object.fromEntries(CONTROL_BINDING_DEFINITIONS.map((definition) => [
      definition.action,
      { label: definition.label, key: controlBindingLabel(definition.action) },
    ])),
  };
}







const MOTION_PREFERENCE_STORAGE_KEY = 'birdsquad.motionPreference';

const COMBAT_PACE_STORAGE_KEY = 'birdsquad.combatPace';

const ANIMATION_PACE_STORAGE_KEY = 'birdsquad.animationPace';

const TEXT_PACE_STORAGE_KEY = 'birdsquad.textPace';

const FAST_MODE_STORAGE_KEY = 'birdsquad.fastMode';

const RUMBLE_STORAGE_KEY = 'birdsquad.rumble';


function systemPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}


export function motionPreference(): MotionPreference {
  if (typeof window === 'undefined') return 'system';
  const stored = safeStorageGet(MOTION_PREFERENCE_STORAGE_KEY);
  return stored === 'full' || stored === 'reduced' || stored === 'system' ? stored : 'system';
}


export function setMotionPreference(value: MotionPreference) {
  if (typeof window === 'undefined') return;
  safeStorageSet(MOTION_PREFERENCE_STORAGE_KEY, value);
}


export function motionState() {
  const preference = motionPreference();
  const systemReduced = systemPrefersReducedMotion();
  const reduced = preference === 'reduced' || (preference === 'system' && systemReduced);
  return { preference, reduced, systemReduced };
}


export function currentScreenShakeState() {
  return screenShakeState(motionState().reduced);
}


export function currentFlashEffectsState() {
  return flashEffectsState(motionState().reduced);
}


export function combatPacePreference(): CombatPace {
  if (typeof window === 'undefined') return 'standard';
  const stored = safeStorageGet(COMBAT_PACE_STORAGE_KEY);
  return stored === 'cinematic' || stored === 'standard' || stored === 'snappy' ? stored : 'standard';
}


export function setCombatPacePreference(value: CombatPace) {
  if (typeof window === 'undefined') return;
  safeStorageSet(COMBAT_PACE_STORAGE_KEY, value);
}


export function combatPacingState() {
  return { preference: combatPacePreference() };
}


export function animationPacePreference(): AnimationPace {
  if (typeof window === 'undefined') return 'standard';
  const stored = safeStorageGet(ANIMATION_PACE_STORAGE_KEY);
  return stored === 'relaxed' || stored === 'fast' ? stored : 'standard';
}


/** Fast Mode multiplies every presentation clock (tweens, sprite animation,
 *  retained actors, set pieces) and shortens combat pauses. It never touches
 *  rules or the deterministic `advanceTime` clock, which still steps real ms. */
export function fastModePreference(): FastModePreference {
  if (typeof window === 'undefined') return 'off';
  return normalizeFastMode(safeStorageGet(FAST_MODE_STORAGE_KEY));
}


export function fastModeEnabled() {
  return fastModePreference() === 'on';
}


export function fastModeState() {
  const enabled = fastModeEnabled();
  return { preference: fastModePreference(), enabled, timeScale: enabled ? FAST_MODE_TIME_SCALE : 1 };
}


export function setFastModePreference(scene: Phaser.Scene | undefined, value: FastModePreference) {
  if (typeof window !== 'undefined') safeStorageSet(FAST_MODE_STORAGE_KEY, value);
  scene?.game.scene.getScenes(true).forEach(syncSceneAnimationPace);
}


/** Controller and touch vibration on big moments. Defaults on; Screen Shake off
 *  (or Reduced Motion) keeps it silent too. */
export function rumblePreference(): RumblePreference {
  if (typeof window === 'undefined') return 'on';
  return normalizeRumble(safeStorageGet(RUMBLE_STORAGE_KEY));
}


export function setRumblePreference(value: RumblePreference) {
  if (typeof window !== 'undefined') safeStorageSet(RUMBLE_STORAGE_KEY, value);
}


export function rumbleState() {
  const preference = rumblePreference();
  const shake = currentScreenShakeState();
  return { preference, enabled: preference === 'on' && shake.enabled, blockedByScreenShake: preference === 'on' && !shake.enabled };
}


export function animationPaceTimeScale(preference = animationPacePreference(), fast = fastModeEnabled()) {
  const base = preference === 'relaxed' ? 0.8 : preference === 'fast' ? 1.3 : 1;
  return fast ? base * FAST_MODE_TIME_SCALE : base;
}


export function animationPacingState(scene?: Phaser.Scene) {
  const preference = animationPacePreference();
  const timeScale = animationPaceTimeScale(preference, false) * (fastModeEnabled() ? FAST_MODE_TIME_SCALE : 1);
  return {
    preference,
    timeScale,
    tweenTimeScale: scene?.tweens.timeScale ?? timeScale,
    spriteTimeScale: scene?.anims.globalTimeScale ?? timeScale,
  };
}


export function syncSceneAnimationPace(scene: Phaser.Scene) {
  const timeScale = animationPaceTimeScale();
  scene.tweens.timeScale = timeScale;
  scene.anims.globalTimeScale = timeScale;
}


export function setAnimationPacePreference(scene: Phaser.Scene, value: AnimationPace) {
  if (typeof window !== 'undefined') safeStorageSet(ANIMATION_PACE_STORAGE_KEY, value);
  syncSceneAnimationPace(scene);
}


export function textPacePreference(): TextPace {
  if (typeof window === 'undefined') return 'standard';
  const stored = safeStorageGet(TEXT_PACE_STORAGE_KEY);
  return stored === 'relaxed' || stored === 'fast' ? stored : 'standard';
}


export function textPaceScale(preference = textPacePreference()) {
  if (preference === 'relaxed') return 1.45;
  if (preference === 'fast') return 0.65;
  return 1;
}


export function textPacingState() {
  const preference = textPacePreference();
  const holdScale = textPaceScale(preference);
  return {
    preference,
    holdScale,
    minimumReadableMs: Math.round(COMBAT_INTRO_MIN_DISMISS_MS * holdScale),
    calloutHoldMs: Math.round(380 * holdScale),
    bannerHoldMs: Math.round(520 * holdScale),
  };
}


export function setTextPacePreference(value: TextPace) {
  if (typeof window !== 'undefined') safeStorageSet(TEXT_PACE_STORAGE_KEY, value);
  setFeedbackTextHoldScale(textPaceScale(value));
}


setFeedbackTextHoldScale(textPaceScale());


export function prefersReducedMotion(): boolean {
  return motionState().reduced;
}


export function stableMotionSeed(id: string): number {
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
