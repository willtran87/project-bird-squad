import type Phaser from 'phaser';
import type { RuntimeRouteMark } from '../types';
import { lazyModule } from '../lazy-module';
import { LAZY_LOAD_FAILED } from './session-config';
import { waymarkCompactArtAssets } from '../../art-assets';
import { formatEffects } from './effect-text';
import { formatWaymarkTrigger, routeMarkAccent, routeMarkEffects, routeMarkFamilyLabel, waymarkGlyph, waymarkSynergyTags } from './route-text';

export type CombatFxAssetsModule = typeof import('../combat-fx-assets');

export const loadCombatFxAssetsModule = lazyModule(() => import('../combat-fx-assets'));


export type CombatPreviewModule = typeof import('../combat-preview');

export const loadCombatPreviewModule = lazyModule(() => import('../combat-preview'));


export type BattleFxPresenterModule = typeof import('../battle/fx-presenter');

export const loadBattleFxPresenterModule = lazyModule(() => import('../battle/fx-presenter'));


export type BattleDebugStateModule = typeof import('../battle/debug-state');

export const loadBattleDebugStateModule = lazyModule(() => import('../battle/debug-state'));


export type BattleBackdropRendererModule = typeof import('../battle/render-backdrop');

export const loadBattleBackdropRendererModule = lazyModule(() => import('../battle/render-backdrop'));


export type BattleForegroundRendererModule = typeof import('../battle/render-foreground');

export const loadBattleForegroundRendererModule = lazyModule(() => import('../battle/render-foreground'));


export type RouteMapRendererModule = typeof import('../route-map-renderer');

export const loadRouteMapRendererModule = lazyModule(() => import('../route-map-renderer'));

export type RouteSecondaryPresentationModule = typeof import('../route-secondary-presentation');

export const loadRouteSecondaryPresentationModule = lazyModule(() => import('../route-secondary-presentation'));


export type BattleRewardRendererModule = typeof import('../battle/render-reward');

export const loadBattleRewardRendererModule = lazyModule(() => import('../battle/render-reward'));


export type BattleInspectRendererModule = typeof import('../battle/render-inspect');

export type BattleInspectCardView = import('../battle/render-inspect').BattleInspectCardView;

export type BattleInspectMode = import('../battle/render-inspect').BattleInspectMode;

export const loadBattleInspectRendererModule = lazyModule(() => import('../battle/render-inspect'));


export type FlockStatsOverlayModule = typeof import('../flock-stats-overlay');

export const loadFlockStatsOverlayModule = lazyModule(() => import('../flock-stats-overlay'));


export type CardHoverDetailModule = typeof import('../card-hover-detail');

export type CardHoverDetailView = import('../card-hover-detail').CardHoverDetailView;

export const loadCardHoverDetailModule = lazyModule(() => import('../card-hover-detail'));


export type CardComparisonModule = typeof import('../card-comparison');

export const loadCardComparisonModule = lazyModule(() => import('../card-comparison'));


export type RouteDeckBrowserModule = typeof import('../route-deck-browser');

export const loadRouteDeckBrowserModule = lazyModule(() => import('../route-deck-browser'));


export type RouteSupplyDrawerModule = typeof import('../route-supply-drawer');

export const loadRouteSupplyDrawerModule = lazyModule(() => import('../route-supply-drawer'));


export type RouteRewardOverlayModule = typeof import('../route-reward-overlay');

export const loadRouteRewardOverlayModule = lazyModule(() => import('../route-reward-overlay'));


export type WaymarkReviewModule = typeof import('../waymark-review');

export function ownedWaymarkReviewEntry(mark: RuntimeRouteMark, family = routeMarkFamilyLabel(mark.family)): SceneWaymarkReviewEntry {
  const effects = routeMarkEffects(mark);
  return { id: mark.id, name: mark.name, family, rarity: mark.rarity, source: mark.source, grammar: effects,
    meta: `${family} / ${mark.rarity.toUpperCase()} / ${mark.source.toUpperCase()}`,
    trigger: formatWaymarkTrigger(mark.trigger, effects), description: mark.description,
    effects: effects.map(effect => formatEffects([effect])), tags: waymarkSynergyTags(mark),
    accent: routeMarkAccent(mark), artKey: waymarkCompactArtAssets[mark.id]?.key,
    flavorText: mark.flavorText ?? '', glyph: waymarkGlyph(mark), tileMeta: '', summary: '' };
}

export type SceneWaymarkReviewEntry = import('../waymark-review').SceneWaymarkReviewEntry;

export const loadWaymarkReviewModule = lazyModule(() => import('../waymark-review'));


export type RouteDebugStateModule = typeof import('../route-debug-state');

export const loadRouteDebugStateModule = lazyModule(() => import('../route-debug-state'));


export type SavedDeckModule = typeof import('../saved-decks');

export const loadSavedDeckModule = () => import('../saved-decks');


export type BattleHudRendererModule = typeof import('../battle/render-hud');

export const loadBattleHudRendererModule = lazyModule(() => import('../battle/render-hud'));


export type BattleHandRendererModule = typeof import('../battle/render-hand');

export type BattleHandCardView = import('../battle/render-hand').BattleHandCardView;

export const loadBattleHandRendererModule = lazyModule(() => import('../battle/render-hand'));


export type DiscardChoiceModule = typeof import('../battle/discard-choice');

export type CombatDiscardChoice = import('../battle/discard-choice').DiscardChoiceState;

export type InterruptibleDecision = import('../battle/discard-choice').InterruptibleDecision;

export const loadDiscardChoiceModule = lazyModule(() => import('../battle/discard-choice'));


export type ReturnChoiceModule = typeof import('../battle/return-choice');

export type CombatReturnChoice = import('../battle/return-choice').ReturnChoiceState;

export const loadReturnChoiceModule = lazyModule(() => import('../battle/return-choice'));


export const loadBossDossierModule = lazyModule(() => import('../boss-dossier'));


type CodexSceneModule = typeof import('../codex-scene');

let codexSceneRegistered = false;

export const loadCodexSceneModule = lazyModule(() => import('../codex-scene'));


export function registerCodexScene(game: Phaser.Game, module: CodexSceneModule) {
  if (codexSceneRegistered) return;
  game.scene.add('CodexScene', module.CodexScene, false);
  codexSceneRegistered = true;
}


type ProfileSceneModule = typeof import('../profile-scene');

export const loadProfileSceneModule = lazyModule(() => import('../profile-scene'));


export function openProfileScene(scene: Phaser.Scene, data: { openSaveData?: boolean } = {}) {
  window.render_game_to_text = () => JSON.stringify({ mode: 'profileLoading', scene: 'MenuScene' });
  void loadProfileSceneModule()
    .then((module) => {
      module.registerRuntimeProfileScene(scene.game);
      if (scene.scene.isActive()) scene.scene.start('ProfileScene', data);
    })
    .catch((error) => {
      console.warn('Profile:', error);
      if (scene.scene.isActive()) {
        window.render_game_to_text = () => JSON.stringify({
          mode: 'profileLoadFailed',
          scene: scene.scene.key,
          error: LAZY_LOAD_FAILED,
        });
      }
    });
}
