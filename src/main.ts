import './style.css';
import Phaser from 'phaser';
import { normalizeFlyway } from './game/flyway-rules';
import { KEYWORDS } from './game/keyword-definitions';
import { memoryStorageSessionActive } from './game/safe-storage';
import { routeBlueprints, alphaEnemyLibrary, alphaRouteMarkLibrary, alphaRouteMarkSet, alphaSupplyLibrary } from './game/runtime-data';
import { generateRouteMap, hashSeed } from './game/route-gen';
import type { RuntimeRouteMap, RuntimeEnemy, RuntimeRouteMark, RuntimeSupply } from './game/types';
import type { ReserveEnemyContract } from './game/runtime-data';
import { banner, floatingText } from './game/fx';
import { flockLeaders, getLeader, defaultLeaderId } from './game/leaders';
import { difficultyMods, difficultyLabel } from './game/difficulty';
import { isLeaderUnlocked, leaderUnlockHints, loadAccount, leaderMastery } from './game/meta';
import { UI_BODY, UI_BOLD, UI_CYAN, UI_FIELD, UI_FONT, UI_GOLD, UI_MUTED, UI_SOFT, UI_DISPLAY_FONT as TOKEN_DISPLAY_FONT, MIN_SUPPORTED_TOUCH_TARGET } from './game/theme';
import { quietButton } from './game/quiet-ui';
import { queueRuntimeImageAssets, uniqueImageAssets, type RuntimeImageAsset } from './game/runtime-images';
import { advanceGameTime, countTextureInGameObjects, killTweensForScene, killTweensForTree } from './game/scene-runtime';
import { firstFlightGuideState, firstMoltGuideState } from './game/first-flight-guide';
import { bindControlActions, controlActionForCode, controlBindingLabel, controlBindingsSnapshot } from './game/input-bindings';
import { graphicsQualityState, setGraphicsQualityPreference } from './game/graphics-quality';
import { colorCuePreference, colorCueState, screenShakePreference, flashEffectsPreference, setColorCuePreference, setFlashEffectsPreference, setScreenShakePreference, setVisualContrastPreference, visualContrastState, applyVisualContrastPreference } from './game/visual-accessibility';
import { screenReaderPreference, screenReaderState, setScreenReaderPreference, initializeScreenReaderAccessibility } from './game/screen-reader-accessibility';
import { getMapBalanceProfile } from './game/balance';
import { fitTextExcerpt } from './game/text-excerpt';
import { RETAIN_PRIORITY_RULE } from './game/effects/retain';
import type { ActiveCardContract, AudioMood, BossDossierModule, Card, CodexDataModule, CodexEnemyEntry, CodexEnemySource, CodexGlossaryTerm, CodexItemEntry, CodexItemTab, CodexSection, FlockState, MarketCardListing, MarketUtilityListing, MarketWaymarkListing, RenderPayload, RunSummary, TextureVisibleBounds } from './game/shared/runtime-types';
import { isRunOutcome, LAZY_LOAD_FAILED, SHARED_ROUTE_SEED } from './game/shared/session-config';
import { DISTRICT_CONTRACT_DEFINITIONS, KEYSTONE_AT, OVEREXTENSION_CARD_THRESHOLD, runDistrictOrdinal, runMapIndices } from './game/shared/gameplay-constants';
import { animationPacePreference, animationPacingState, combatPacePreference, combatPacingState, controlsTextState, currentFlashEffectsState, currentScreenShakeState, motionPreference, motionState, prefersReducedMotion, setAnimationPacePreference, setCombatPacePreference, setMotionPreference, setTextPacePreference, settingsFocusState, syncSceneAnimationPace, textPacePreference, textPaceScale, textPacingState } from './game/shared/preferences';
import { ENEMY_ATTACK_WINDUP_MS, ENEMY_FX_X, ENEMY_FX_Y, FLOCK_FX_X, FLOCK_FX_Y, FLOCK_HP_BAR, FLOW_HUD_HEIGHT, FLOW_HUD_PIP_GAP, FLOW_HUD_PIP_OFFSET, FLOW_HUD_WIDTH, FLOW_HUD_X_OFFSET, FLOW_HUD_Y_OFFSET, GAME_HEIGHT, GAME_WIDTH, HUD_MENU_PANEL, MENU_BORDER_WIDTH } from './game/shared/layout-constants';
import { COMBAT_ATMOSPHERE_TEXTURE, COMBAT_BANK_CACHE_TEXTURE, COMBAT_BOSS_PHASE_BREAK_TEXTURE, COMBAT_CACHE_CHOICE_REVEAL_TEXTURE, COMBAT_CARD_DRAW_TEXTURE, COMBAT_CLEANSE_BURST_TEXTURE, COMBAT_COVER_BLOCK_BURST_TEXTURE, COMBAT_COVER_GUARD_TEXTURE, COMBAT_COVER_SHATTER_TEXTURE, COMBAT_DEFEAT_BURST_TEXTURE, COMBAT_DISCARD_SWEEP_TEXTURE, COMBAT_ENEMY_ATTACK_TELL_TEXTURE, COMBAT_ENEMY_COVER_BLOCK_TEXTURE, COMBAT_ENEMY_COVER_TEXTURE, COMBAT_ENEMY_HEAL_BEAM_TEXTURE, COMBAT_ENEMY_HEAVY_CONTACT_TEXTURE, COMBAT_ENEMY_IMPACT_CONTACT_TEXTURE, COMBAT_ENEMY_MEND_TEXTURE, COMBAT_ENEMY_SUPPORT_CHARGE_TEXTURE, COMBAT_ENEMY_SUPPORT_TELL_TEXTURE, COMBAT_ENEMY_SWIPE_TEXTURE, COMBAT_FLOCK_IMPACT_BURST_TEXTURE, COMBAT_FLOW_SURGE_TEXTURE, COMBAT_FORMATION_SHIFT_TEXTURE, COMBAT_FOULED_PRESSURE_TEXTURE, COMBAT_HEAL_BLOOM_TEXTURE, COMBAT_IMPACT_FLASH_TEXTURE, COMBAT_MOLT_SHIFT_TEXTURE, COMBAT_MOLT_TRIGGER_CHOICE_TEXTURE, COMBAT_OPEN_SKY_BREAK_TEXTURE, COMBAT_OPEN_SKY_EXPOSURE_TEXTURE, COMBAT_OPEN_SKY_GUARD_TEXTURE, COMBAT_OVEREXTENSION_WARNING_TEXTURE, COMBAT_OVERFLOW_SHELTER_TEXTURE, COMBAT_PERFECT_BRACE_RIPOSTE_TEXTURE, COMBAT_PINNED_OPENING_STRIKE_TEXTURE, COMBAT_PLAYER_COMMIT_SIGIL_TEXTURE, COMBAT_PLAYER_HIT_CONFIRM_TEXTURE, COMBAT_RESONANCE_SPEND_TEXTURE, COMBAT_RESONANCE_SURGE_TEXTURE, COMBAT_RESOURCE_OVERCAP_TEXTURE, COMBAT_RUFFLED_BREAK_TEXTURE, COMBAT_SHUFFLE_VORTEX_TEXTURE, COMBAT_SPARK_ECHO_TEXTURE, COMBAT_STATUS_CLEANSE_SPECIFIC_TEXTURE, COMBAT_SUPPLY_USE_BURST_TEXTURE, COMBAT_THREAT_CHARGE_TEXTURE, COMBAT_TURN_BANNER_TEXTURE, COMBAT_VICTORY_FANFARE_SIGIL_TEXTURE, COMBAT_VICTORY_RALLY_TEXTURE, COMBAT_WINDED_GUST_TEXTURE, COMBAT_WINGBEAT_DRAIN_TEXTURE, COMBAT_WINGBEAT_SURGE_TEXTURE } from './game/shared/fx-textures';
import { loadBossDossierModule, loadCodexSceneModule, loadProfileSceneModule, registerCodexScene } from './game/shared/lazy-modules';
import { addRewardRevealHaloFx, addSupplyArtImage, addWaymarkArtImage, BATTLEFIELD_ASSETS, cardArtAssets, codexUiIconIds, DEFAULT_BATTLEFIELD_ASSET, deferredHowToPlayUiIconIds, deferredMenuSettingsUiIconIds, enemyArtAssets, howToPlayUiIconIds, MARKET_KIT_ASSETS, menuSettingsUiIconIds, reserveEnemyArtAsset, ROUTE_SET_PIECE_PROFILES, supplyArtAssets, supplyCompactArtAssets, titleMenuCompactIconIds, titleMenuUiIconIds, uiIconAssets, type UiIconId, waymarkArtAssets, waymarkCompactArtAssets } from './art-assets';
import { addUiIconImage, queueUiIconAssets, sceneCanQueueRuntimeAssets } from './game/shared/asset-loading';
import { buttonIconForLabel, collectionGoalSummary } from './game/shared/ui-iconography';
import { activeMapIndex, activeSeed, buildOutcomeFlightDetailsFor, cardLibrary, currentCombatNodes, currentMap } from './game/shared/run-session';
import { birdAudio } from './game/shared/bird-audio-director';
import { setSpectacleReady } from './game/shared/spectacle-ready';
import { MenuScene } from './scenes/menu-scene';
import { BootScene } from './scenes/boot-scene';
import { RouteScene } from './scenes/route-scene';
import { BattleSceneLoader, ensureBattleScene } from './scenes/battle-scene-loader';
import type { BattleScene } from './scenes/battle-scene';
import { cardsFromSave, cloneCard, createInitialRunState, getMaxUnlockedTier, hasActiveRun, loadActiveRun, loadRunHistory, playtestRating, RUN_HISTORY_KEY, sanitizeActiveRun, sanitizedPlaytestFeedback, sanitizeRunHistory } from './game/shared/run-state';
import { cardCompactArtAsset, cardLabel, compactCardArtKey, displayName, isAviaryCard, isSnagCard, loadedCardArtKey, renderSnagCardBorder } from './game/shared/card-presentation';
import { flockStatuses, suitAccentColor, suitFxMeta } from './game/shared/combat-status';
import { activateRenderedAudioToggleControl, addRouteWaymarkScrollRailFrame, addUi, audioToggleWaveBurstState, clamp, flowHudPresentation, hideKwTooltip, keywordTooltipState, playUiSound, renderAudioToggleControl, renderCloseControl, renderFieldPanel, renderHowToPlayOverlay, renderRichText, renderSettingsMenuOverlay, showKwTooltip, type UiAdd, type UnifiedRunHudData } from './game/shared/ui-helpers';
import { compactEffectSummary, compactSentenceText, formatEffects } from './game/shared/effect-text';
import { aggregateFlockStats, cardStatEntries, cardStatRows, flockStatLabel } from './game/shared/card-stats';
import { routeEffectTokens, routeMarkEffectText, routeMarkFamilyLabel, routeNodeTypeLabel, supplyAccent, supplyCategoryLabel, waymarkGlyph, waymarkSynergyTags } from './game/shared/route-text';
import { currentMove } from './game/shared/enemy-moves';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    __birdSquadState?: () => RenderPayload;
    __birdSquadGame?: Phaser.Game;
    __birdSquadLastRun?: RunSummary;
    __birdSquadExportRuns?: () => string;
    __birdSquadCurrentMap?: () => RuntimeRouteMap;
    __routeAudit?: readonly [
      typeof routeBlueprints,
      typeof generateRouteMap,
      typeof hashSeed,
      typeof getMapBalanceProfile,
    ];
    __birdSquadEnsureScene?: (sceneKey: string) => Promise<boolean>;
    __birdSquadAudio?: () => {
      muted: boolean;
      mood: AudioMood;
      unlocked: boolean;
      musicVolume?: number;
      sfxVolume?: number;
      voiceVolume?: number;
      ambienceVolume?: number;
      music?: { pattern: string; active: boolean; step: number; pulses: number };
    };
    __birdSquadShowKeywordTooltip?: (sceneKey: string, keyword: string, x: number, y: number) => boolean;
  }
}


function shouldPreserveDrawingBufferForCapture() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('capture') === '1' || params.get('preserveDrawingBuffer') === '1' || navigator.webdriver;
}


// The Codex scene is an optional, click-loaded boundary. Its renderer imports
// this deliberately narrow bridge so the boot path does not have to evaluate
// two thousand lines of collection and dossier presentation code.
export {
  aggregateFlockStats, cardsFromSave, cardStatRows, flockStatLabel, KEYSTONE_AT,
  addUi, flowHudPresentation, FLOCK_HP_BAR, FLOW_HUD_X_OFFSET, FLOW_HUD_Y_OFFSET, FLOW_HUD_WIDTH, FLOW_HUD_HEIGHT, FLOW_HUD_PIP_OFFSET, FLOW_HUD_PIP_GAP,
  addRewardRevealHaloFx,
  addRouteWaymarkScrollRailFrame, addSupplyArtImage, addUiIconImage, addWaymarkArtImage,
  SHARED_ROUTE_SEED, advanceGameTime, alphaEnemyLibrary, alphaRouteMarkLibrary, alphaRouteMarkSet, alphaSupplyLibrary,
  animationPacePreference, animationPacingState, audioToggleWaveBurstState,
  bindControlActions, birdAudio, cardArtAssets, cardCompactArtAsset, cardLabel, cardLibrary, clamp,
  collectionGoalSummary, colorCuePreference, colorCueState, combatPacePreference, combatPacingState, createInitialRunState,
  compactSentenceText, controlActionForCode, controlBindingLabel, controlBindingsSnapshot, currentMap,
  controlsTextState, currentFlashEffectsState, currentScreenShakeState,
  codexUiIconIds, compactCardArtKey, compactEffectSummary,
  countTextureInGameObjects, displayName, enemyArtAssets, flockLeaders,
  deferredHowToPlayUiIconIds, deferredMenuSettingsUiIconIds, DISTRICT_CONTRACT_DEFINITIONS,
  firstFlightGuideState, formatEffects, GAME_HEIGHT, GAME_WIDTH, getLeader, getMaxUnlockedTier, howToPlayUiIconIds,
  graphicsQualityState, hasActiveRun, hideKwTooltip, isAviaryCard, isLeaderUnlocked, isSnagCard,
  KEYWORDS, killTweensForScene, killTweensForTree, LAZY_LOAD_FAILED, leaderUnlockHints,
  loadAccount, loadActiveRun, loadBossDossierModule, loadCodexSceneModule,
  loadRunHistory, loadedCardArtKey, menuSettingsUiIconIds, motionPreference, motionState, playUiSound,
  prefersReducedMotion, sceneCanQueueRuntimeAssets,
  queueRuntimeImageAssets, queueUiIconAssets, activateRenderedAudioToggleControl,
  renderAudioToggleControl, renderCloseControl,
  renderFieldPanel, renderHowToPlayOverlay, renderRichText, renderSettingsMenuOverlay,
  renderSnagCardBorder, reserveEnemyArtAsset, ROUTE_SET_PIECE_PROFILES, routeEffectTokens, routeMarkEffectText,
  routeMarkFamilyLabel, routeNodeTypeLabel, registerCodexScene,
  sanitizeActiveRun, sanitizeRunHistory, screenReaderPreference, screenReaderState,
  buildOutcomeFlightDetailsFor, playtestRating, sanitizedPlaytestFeedback, RUN_HISTORY_KEY,
  screenShakePreference, flashEffectsPreference, settingsFocusState, setAnimationPacePreference, setColorCuePreference, setCombatPacePreference,
  setFlashEffectsPreference, setGraphicsQualityPreference, setMotionPreference, setScreenReaderPreference,
  setScreenShakePreference, setTextPacePreference, setVisualContrastPreference,
  showKwTooltip, keywordTooltipState, suitAccentColor, supplyAccent, supplyArtAssets, supplyCategoryLabel, supplyCompactArtAssets,
  HUD_MENU_PANEL, UI_BODY, UI_BOLD, UI_CYAN, UI_FIELD, UI_FONT, UI_GOLD, UI_MUTED, UI_SOFT,
  syncSceneAnimationPace, textPacePreference, textPacingState, titleMenuCompactIconIds, titleMenuUiIconIds,
  uiIconAssets, uniqueImageAssets, visualContrastState, waymarkArtAssets, waymarkCompactArtAssets, waymarkGlyph,
  waymarkSynergyTags,
};

export type {
  BossDossierModule, Card, CodexDataModule, CodexEnemyEntry, CodexEnemySource, CodexGlossaryTerm,
  CodexItemEntry, CodexItemTab, CodexSection, ReserveEnemyContract, RuntimeEnemy, RuntimeImageAsset,
  RuntimeRouteMark, RuntimeSupply, TextureVisibleBounds, UiIconId,
};


const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // prefer WebGL: real texture filtering + mipmaps for crisp art
  title: 'Bird Squad',
  parent: 'game-container',
  backgroundColor: '#08101d',
  // The card art is detailed 1024x1536 illustrations shown small, so we want
  // smooth (LINEAR) minification + mipmaps, NOT nearest-neighbour pixel-art mode.
  pixelArt: false,
  antialias: true,
  roundPixels: false,
  render: {
    // Art and high-resolution text already carry smooth alpha edges. Avoid a
    // multisampled backbuffer on every frame; keep texture antialiasing and
    // trilinear minification above/below for the illustrated assets.
    antialiasGL: false,
    mipmapFilter: 'LINEAR_MIPMAP_LINEAR', // trilinear: sharp, alias-free downscaling
    powerPreference: 'high-performance',
    preserveDrawingBuffer: shouldPreserveDrawingBufferForCapture()
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    min: { width: 320, height: 180 },
    max: { width: 1920, height: 1080 }
  },
  input: {
    keyboard: true,
    mouse: true,
    touch: true,
    gamepad: true
  },
  // BattleScene's ~240 KB lives in its own chunk; the loader holds its slot.
  scene: [BootScene, MenuScene, RouteScene, BattleSceneLoader]
};


// --- Global text crispness -------------------------------------------------
// Phaser bakes each Text object to its own canvas at `resolution`x device
// pixels (default 1). Our UI is authored at 1280x720 then FIT-scaled up to the
// display (~1.5x on a 1080p monitor, ~3x on HiDPI), which softens every glyph.
// Bake text at a higher resolution so it stays sharp after upscaling. Card art
// is unaffected - it downsamples through mipmaps. This one patch raises detail
// for every `this.add.text(...)` in the game.
const TEXT_RESOLUTION = Math.min(4, Math.max(3, Math.ceil((window.devicePixelRatio || 1) * 2)));

const _factoryText = Phaser.GameObjects.GameObjectFactory.prototype.text;

Phaser.GameObjects.GameObjectFactory.prototype.text = function (
  this: Phaser.GameObjects.GameObjectFactory,
  x: number,
  y: number,
  text: string | string[],
  style?: Phaser.Types.GameObjects.Text.TextStyle
) {
  return _factoryText.call(this, x, y, text, { resolution: TEXT_RESOLUTION, ...style });
};


applyVisualContrastPreference();

window.__birdSquadGame = new Phaser.Game(config);
setSpectacleReady(import('./game/spectacle/stage').then((m) => m.installSpectacle(window.__birdSquadGame!), () => undefined));

initializeScreenReaderAccessibility();

window.__birdSquadEnsureScene = async (sceneKey: string) => {
  const game = window.__birdSquadGame;
  if (!game) return false;
  if (sceneKey === 'CodexScene') registerCodexScene(game, await loadCodexSceneModule());
  if (sceneKey === 'ProfileScene') (await loadProfileSceneModule()).registerRuntimeProfileScene(game);
  if (sceneKey === 'BattleScene') return ensureBattleScene(game);
  return Boolean(game.scene.getScene(sceneKey));
};

window.__birdSquadCurrentMap = () => currentMap();

window.__routeAudit = [
  routeBlueprints,
  generateRouteMap,
  hashSeed,
  getMapBalanceProfile,
];

window.__birdSquadAudio = () => birdAudio.snapshot();

window.__birdSquadShowKeywordTooltip = (sceneKey: string, keyword: string, x: number, y: number) => {
  const scene = window.__birdSquadGame?.scene.getScene(sceneKey);
  if (scene) showKwTooltip(scene, keyword, x, y);
  return !!scene;
};


export type { BattleScene };
export { BATTLEFIELD_ASSETS, DEFAULT_BATTLEFIELD_ASSET, normalizeFlyway, memoryStorageSessionActive, difficultyMods, difficultyLabel, COMBAT_ATMOSPHERE_TEXTURE, isRunOutcome, firstMoltGuideState, OVEREXTENSION_CARD_THRESHOLD, RETAIN_PRIORITY_RULE, flockStatuses, currentMove, currentCombatNodes, TOKEN_DISPLAY_FONT, fitTextExcerpt, activeSeed, runMapIndices, runDistrictOrdinal, activeMapIndex, leaderMastery, defaultLeaderId };


export type { RenderPayload, UnifiedRunHudData, UiAdd };


// Shared constants for deferred combat presentation; no eager module import.
export { COMBAT_BANK_CACHE_TEXTURE, COMBAT_BOSS_PHASE_BREAK_TEXTURE, COMBAT_CACHE_CHOICE_REVEAL_TEXTURE, COMBAT_CARD_DRAW_TEXTURE, COMBAT_CLEANSE_BURST_TEXTURE, COMBAT_COVER_BLOCK_BURST_TEXTURE, COMBAT_COVER_GUARD_TEXTURE, COMBAT_COVER_SHATTER_TEXTURE, COMBAT_DEFEAT_BURST_TEXTURE, COMBAT_DISCARD_SWEEP_TEXTURE, COMBAT_ENEMY_ATTACK_TELL_TEXTURE, COMBAT_ENEMY_COVER_BLOCK_TEXTURE, COMBAT_ENEMY_COVER_TEXTURE, COMBAT_ENEMY_HEAL_BEAM_TEXTURE, COMBAT_ENEMY_HEAVY_CONTACT_TEXTURE, COMBAT_ENEMY_IMPACT_CONTACT_TEXTURE, COMBAT_ENEMY_MEND_TEXTURE, COMBAT_ENEMY_SUPPORT_CHARGE_TEXTURE, COMBAT_ENEMY_SUPPORT_TELL_TEXTURE, COMBAT_ENEMY_SWIPE_TEXTURE, COMBAT_FLOCK_IMPACT_BURST_TEXTURE, COMBAT_FLOW_SURGE_TEXTURE, COMBAT_FORMATION_SHIFT_TEXTURE, COMBAT_FOULED_PRESSURE_TEXTURE, COMBAT_HEAL_BLOOM_TEXTURE, COMBAT_IMPACT_FLASH_TEXTURE, COMBAT_MOLT_SHIFT_TEXTURE, COMBAT_MOLT_TRIGGER_CHOICE_TEXTURE, COMBAT_OPEN_SKY_BREAK_TEXTURE, COMBAT_OPEN_SKY_EXPOSURE_TEXTURE, COMBAT_OPEN_SKY_GUARD_TEXTURE, COMBAT_OVEREXTENSION_WARNING_TEXTURE, COMBAT_OVERFLOW_SHELTER_TEXTURE, COMBAT_PERFECT_BRACE_RIPOSTE_TEXTURE, COMBAT_PINNED_OPENING_STRIKE_TEXTURE, COMBAT_PLAYER_COMMIT_SIGIL_TEXTURE, COMBAT_PLAYER_HIT_CONFIRM_TEXTURE, COMBAT_RESONANCE_SPEND_TEXTURE, COMBAT_RESONANCE_SURGE_TEXTURE, COMBAT_RESOURCE_OVERCAP_TEXTURE, COMBAT_RUFFLED_BREAK_TEXTURE, COMBAT_SHUFFLE_VORTEX_TEXTURE, COMBAT_SPARK_ECHO_TEXTURE, COMBAT_STATUS_CLEANSE_SPECIFIC_TEXTURE, COMBAT_SUPPLY_USE_BURST_TEXTURE, COMBAT_THREAT_CHARGE_TEXTURE, COMBAT_TURN_BANNER_TEXTURE, COMBAT_VICTORY_FANFARE_SIGIL_TEXTURE, COMBAT_VICTORY_RALLY_TEXTURE, COMBAT_WINDED_GUST_TEXTURE, COMBAT_WINGBEAT_DRAIN_TEXTURE, COMBAT_WINGBEAT_SURGE_TEXTURE, ENEMY_ATTACK_WINDUP_MS, ENEMY_FX_X, ENEMY_FX_Y, FLOCK_FX_X, FLOCK_FX_Y, banner, floatingText, suitFxMeta };

export type { ActiveCardContract, FlockState };


export { textPaceScale };


// Shared bindings for deferred route presentation; no eager module import.
export { MARKET_KIT_ASSETS, MENU_BORDER_WIDTH, MIN_SUPPORTED_TOUCH_TARGET, buttonIconForLabel, cardStatEntries, cloneCard, quietButton };

export type { MarketCardListing, MarketWaymarkListing, MarketUtilityListing };
export { formatWaymarkTrigger } from './game/shared/route-text';
