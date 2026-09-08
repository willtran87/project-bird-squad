import type Phaser from 'phaser';
import {
  SHARED_ROUTE_SEED,
  advanceGameTime,
  animationPacingState,
  audioToggleWaveBurstState,
  birdAudio,
  collectionGoalSummary,
  colorCueState,
  combatPacingState,
  controlBindingLabel,
  controlsTextState,
  countTextureInGameObjects,
  currentFlashEffectsState,
  currentScreenShakeState,
  firstFlightGuideState,
  getMaxUnlockedTier,
  graphicsQualityState,
  motionState,
  screenReaderState,
  settingsFocusState,
  textPacingState,
  titleMenuCompactIconIds,
  titleMenuUiIconIds,
  deferredHowToPlayUiIconIds,
  deferredMenuSettingsUiIconIds,
  uiIconAssets,
  visualContrastState,
} from '../main';

export function installMenuDebugState(scene: any) {
  window.advanceTime = (ms: number) => advanceGameTime(scene.game, ms);
  window.render_game_to_text = () => JSON.stringify({
    mode: 'menu',
    scene: 'MenuScene',
    prompt: SHARED_ROUTE_SEED ? 'Fly the shared route or choose your own setup.' : 'Choose a setup, then start a run.',
    storageRecovery: scene.storageRecoveryNotice ? {
      ...scene.storageRecoveryNotice,
      rendered: scene.children.list.some((child: any) => child.name === 'storage-recovery-notice'),
    } : undefined,
    sharedRoute: SHARED_ROUTE_SEED ? { seed: SHARED_ROUTE_SEED, runMode: scene.selectedRunMode } : undefined,
    settingsOpen: Boolean(scene.settingsOverlay),
    settingsFocus: settingsFocusState(scene, Boolean(scene.settingsOverlay)),
    controls: controlsTextState(scene, Boolean(scene.settingsOverlay)),
    helpOpen: Boolean(scene.helpOverlay),
    helpContent: scene.helpOverlay?.list.filter((child: any) => child.name === 'how-to-play-readable')
      .map((child: any) => child.text),
    collectionGoal: {
      ...collectionGoalSummary(scene.menuAccount),
      rendered: scene.children.list.some((child: any) => child.name === 'title-collection-goal-hit'),
      input: { pointer: true, keyboardFocus: 'codex', controllerFocus: 'codex' },
    },
    titleFocus: {
      current: scene.menuFocus,
      label: scene.menuFocusLabel(),
      order: scene.menuFocusOrder(),
      previous: controlBindingLabel('previous'),
      next: controlBindingLabel('next'),
      confirm: controlBindingLabel('confirm'),
      ringRendered: scene.children.list.some((child: any) => child.name === 'title-menu-focus-ring'),
    },
    titleComposition: titleCompositionState(scene),
    titleBoot: titleBootState(scene),
    titleTransition: {
      generation: scene.menuGeneration,
      fadeRunning: scene.cameras.main?.fadeEffect?.isRunning ?? false,
      fadeComplete: scene.cameras.main?.fadeEffect?.isComplete ?? false,
      fadeProgress: Number((scene.cameras.main?.fadeEffect?.progress ?? 0).toFixed(3)),
    },
    selectedLeader: scene.selectedLeaderId,
    selectedDifficulty: scene.selectedDifficulty,
    selectedRunMode: scene.selectedRunMode,
    runModeChoices: scene.children.list
      .filter((child: any) => child.name === 'title-run-mode-option')
      .map((child: any) => ({
        mode: child.getData('mode'),
        summary: child.getData('mode') === 'quick'
          ? 'Quick, 3 districts, no tier unlock'
          : 'Full, 4 districts, unlocks tiers',
        selected: child.getData('mode') === scene.selectedRunMode,
      })),
    maxUnlockedDifficulty: getMaxUnlockedTier(),
    titleAscensionPlaque: textureState(scene, 'title-ascension-plaque'),
    titleAscensionValueFrame: textureState(scene, 'title-ascension-value-frame'),
    titleAscensionStepperFrame: textureState(scene, 'title-ascension-stepper-frame'),
    titleAscensionStatusStrip: textureState(scene, 'title-ascension-status-strip'),
    titleHomeCommandDais: textureState(scene, 'title-home-command-dais'),
    titleLogoBackplate: countedTextureState(scene, 'title-logo-backplate'),
    titleLeaderCardFrame: textureState(scene, 'title-leader-card-frame'),
    titleLeaderSelectedFlourish: textureState(scene, 'title-leader-selected-flourish', true),
    titleLeaderHeaderFrame: textureState(scene, 'title-leader-header-frame'),
    titleLeaderTooltipFrame: countedTextureState(scene, 'title-leader-tooltip-frame', scene.leaderTooltip?.list ?? []),
    titleStartCommandFrame: textureState(scene, 'title-start-command-frame'),
    titleRunLaunchFlourish: titleRunLaunchFlourishState(scene),
    titleUtilityCommandFrame: textureState(scene, 'title-utility-command-frame'),
    audioTogglePulseRing: countedTextureState(scene, 'audio-toggle-pulse-ring'),
    audioToggleWaveBurst: audioToggleWaveBurstState(scene, scene.children.list),
    howToPlayTopicCardFrame: countedTextureState(scene, 'how-to-play-topic-card-frame'),
    howToPlayTipRowFrame: countedTextureState(scene, 'how-to-play-tip-row-frame'),
    systemSettingsRowFrame: countedTextureState(scene, 'system-settings-row-frame'),
    systemSettingsToggleFrame: countedTextureState(scene, 'system-settings-toggle-frame'),
    systemSettingsVolumeSliderFrame: countedTextureState(scene, 'system-settings-volume-slider-frame'),
    systemSettingsMotionSwitchFrame: countedTextureState(scene, 'system-settings-motion-switch-frame'),
    systemFieldCommandFrame: countedTextureState(scene, 'system-field-command-frame'),
    systemOverlayTitlePlaque: countedTextureState(scene, 'system-overlay-title-plaque'),
    audio: birdAudio.snapshot(),
    motion: motionState(),
    visualContrast: visualContrastState(),
    colorCues: colorCueState(),
    screenShake: currentScreenShakeState(),
    flashEffects: currentFlashEffectsState(),
    graphics: graphicsQualityState(),
    screenReader: screenReaderState(),
    combatPacing: combatPacingState(),
    animationPacing: animationPacingState(scene),
    textPacing: textPacingState(),
    graphicsRuntime: {
      ambientParticleEmitters: scene.children.list.filter((child: any) => child.name === 'title-ambient-particles').length,
    },
    firstFlightGuide: firstFlightGuideState(),
  });
}

function roundedBounds(object: any) {
  const bounds = object?.getBounds?.();
  return bounds ? {
    left: Math.round(bounds.left),
    top: Math.round(bounds.top),
    right: Math.round(bounds.right),
    bottom: Math.round(bounds.bottom),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  } : undefined;
}

function titleCompositionState(scene: any) {
  const named = (name: string) => scene.children.list.find((child: any) => child.name === name);
  const logo = roundedBounds(named('title-logo'));
  const hint = roundedBounds(named('title-input-hint'));
  const hintBackdrop = roundedBounds(named('title-input-hint-backdrop'));
  const hintVisual = hintBackdrop ?? hint;
  const withinCanvas = (bounds: ReturnType<typeof roundedBounds>) => Boolean(bounds
    && bounds.left >= 0
    && bounds.top >= 0
    && bounds.right <= scene.scale.gameSize.width
    && bounds.bottom <= scene.scale.gameSize.height);
  const overlaps = Boolean(logo && hintVisual
    && logo.left < hintVisual.right
    && logo.right > hintVisual.left
    && logo.top < hintVisual.bottom
    && logo.bottom > hintVisual.top);
  return {
    logo,
    hint,
    hintBackdrop,
    logoWithinCanvas: withinCanvas(logo),
    hintWithinCanvas: withinCanvas(hintVisual),
    clear: Boolean(logo && hintVisual && !overlaps),
  };
}

function titleBootState(scene: any) {
  const loadedCount = (ids: readonly (keyof typeof uiIconAssets)[]) => ids.filter((id) => (
    scene.textures.exists(uiIconAssets[id].key)
  )).length;
  const essentialLoaded = loadedCount(titleMenuUiIconIds);
  const compactDimensions = titleMenuCompactIconIds.flatMap((id: keyof typeof uiIconAssets) => {
    const source = scene.textures.get(uiIconAssets[id].key)?.getSourceImage() as { width?: number; height?: number } | undefined;
    return source?.width && source.height ? [{ width: source.width, height: source.height }] : [];
  });
  const essentialTexturePixels = titleMenuUiIconIds.reduce((total: number, id: keyof typeof uiIconAssets) => {
    const source = scene.textures.get(uiIconAssets[id].key)?.getSourceImage() as { width?: number; height?: number } | undefined;
    return total + (source?.width ?? 0) * (source?.height ?? 0);
  }, 0);
  return {
    generation: scene.menuGeneration,
    splashFormat: 'webp',
    essentialAssetCount: titleMenuUiIconIds.length,
    essentialLoaded,
    ready: essentialLoaded === titleMenuUiIconIds.length,
    essentialTexturePixels,
    compactAssetCount: titleMenuCompactIconIds.length,
    compactLoaded: compactDimensions.length,
    compactMaxDimension: Math.max(0, ...compactDimensions.flatMap(({ width, height }: { width: number; height: number }) => [width, height])),
    deferredHelpAssetCount: deferredHowToPlayUiIconIds.length,
    deferredHelpLoaded: loadedCount(deferredHowToPlayUiIconIds),
    deferredSettingsAssetCount: deferredMenuSettingsUiIconIds.length,
    deferredSettingsLoaded: loadedCount(deferredMenuSettingsUiIconIds),
  };
}

function titleRunLaunchFlourishState(scene: any) {
  const texture = 'title-run-launch-flourish';
  const count = countTextureInGameObjects(scene.children.list, texture);
  return {
    loaded: scene.textures.exists(texture),
    rendered: count > 0,
    count,
    bursts: scene.titleRunLaunchFlourishBursts,
    pending: scene.titleRunLaunchPending,
  };
}

function textureState(scene: any, id: keyof typeof uiIconAssets, visibleOnly = false) {
  const key = uiIconAssets[id].key;
  const matches = scene.children.list.filter((child: any) => (
    child.texture?.key === key && (!visibleOnly || child.visible)
  ));
  return { loaded: scene.textures.exists(key), rendered: matches.length > 0, count: matches.length };
}

function countedTextureState(
  scene: any,
  id: keyof typeof uiIconAssets,
  objects: Phaser.GameObjects.GameObject[] = scene.children.list,
) {
  const key = uiIconAssets[id].key;
  const count = countTextureInGameObjects(objects, key);
  return { loaded: scene.textures.exists(key), rendered: count > 0, count };
}
