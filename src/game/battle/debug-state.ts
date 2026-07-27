import type Phaser from 'phaser';

type DebugNode = Phaser.GameObjects.GameObject & {
  alpha?: number;
  list?: Phaser.GameObjects.GameObject[];
  name?: string;
  text?: string;
  texture?: { key?: string };
  visible?: boolean;
};

type DebugRoot = Phaser.GameObjects.Container | undefined;

export interface BattlePresentationDebugContext {
  scene: Phaser.Scene;
  roots: {
    backdrop: DebugRoot;
    battle: DebugRoot;
    hand: DebugRoot;
    fx: DebugRoot;
    system: DebugRoot;
  };
  counters: Record<string, unknown>;
  keywordTooltipFrameCount: number;
}

interface TextureState {
  loaded: boolean;
  rendered: boolean;
  count?: number;
  visible?: number;
  bursts?: number;
  labels?: string[];
}

const UI_TEXTURE_FIELDS = [
  'audioTogglePulseRing',
  'systemSettingsRowFrame',
  'systemSettingsToggleFrame',
  'systemSettingsVolumeSliderFrame',
  'systemSettingsMotionSwitchFrame',
  'systemFieldCommandFrame',
  'systemOverlayTitlePlaque',
  'systemPauseDetailRowFrame',
  'runOutcomeStatRowFrame',
  'runOutcomeCommandFrame',
  'runOutcomeReportFrame',
  'runOutcomeTitlePlaque',
  'combatCohesionGaugeFrame',
  'combatPileDock',
  'combatPileReviewFrame',
  'combatPileRowFrame',
  'deckReviewRowFrame',
  'deckReviewPageIndicatorFrame',
  'deckReviewTitlePlaque',
  'deckReviewDetailFrame',
  'deckReviewCostBadge',
  'deckReviewMetaChipFrame',
  'deckReviewSectionTabFrame',
  'combatPileScrollButtonFrame',
  'combatPileCountBadge',
  'combatPileDetailChipFrame',
  'combatPileStatChipFrame',
  'combatPileTitlePlaque',
  'combatPilePageIndicatorFrame',
  'overlayCloseCommandFrame',
  'combatRoostCommandFrame',
  'combatLogFrame',
  'combatLogEventBead',
  'combatTooltipFrame',
  'combatIncomingForecastFrame',
  'combatBeatProgressFrame',
  'combatHudMetricChipFrame',
  'combatSuitKeystoneChipFrame',
  'combatStatsTallyFrame',
  'combatStatsTallyRowFrame',
  'combatStatsTallyTitlePlaque',
  'combatHandRail',
  'combatHandSelectedPulse',
  'combatHandCardFrame',
  'combatEnemyVitalsFrame',
  'combatEnemyStatusChipFrame',
  'combatEncounterPlaque',
  'combatSupplyFeedbackFrame',
  'combatWaymarkFeedbackFrame',
  'combatEliteCrest',
  'flockStatsFlourish',
  'flockStatsTitlePlaque',
  'flockStatsCaptionFrame',
  'flockStatsFooterFrame',
  'flockStatsHeaderFrame',
  'flockStatsRowFrame',
  'runKitItemTileFrame',
  'runKitEmptySlotFrame',
  'routeWaymarkScrollRailFrame',
  'cardHoverDossierFrame',
  'cardHoverStatChipFrame',
  'rewardCeremonyBackdrop',
  'rewardChoiceCardFrame',
  'rewardHeaderPlaque',
  'rewardDeckNeedChipFrame',
  'rewardSkipCommandFrame'
] as const;

const FX_TEXTURE_FIELDS = [
  'combatRoostHandoff',
  'combatPlayerTurnRally',
  'combatImpactFlash',
  'combatPlayerHitConfirm',
  'combatPlayerCommitSigil',
  'combatSupplyUseBurst',
  'combatActionTrail',
  'combatCastFocusBurst',
  'combatWingbeatSpend',
  'combatEnemySwipe',
  'combatEnemyCommitmentSeal',
  'combatEnemyAttackTell',
  'combatEnemyWindupPlaque',
  'combatEnemySupportCharge',
  'combatEnemySupportTell',
  'combatFlockImpactBurst',
  'combatEnemyImpactContact',
  'combatOverextensionWarning',
  'combatBossPhaseBreak',
  'combatStatusCleanseSpecific',
  'combatOpenSkyBreak',
  'combatCacheChoiceReveal',
  'combatMoltTriggerChoice',
  'combatEnemyHeavyContact',
  'combatEnemyHealBeam',
  'combatResourceOvercap',
  'combatCoverGuard',
  'combatCoverBlockBurst',
  'combatEnemyCoverBlock',
  'combatPerfectBraceRiposte',
  'combatPinnedOpeningStrike',
  'combatFourSuitRally',
  'combatSparkEcho',
  'combatOverflowShelter',
  'combatFormationShift',
  'combatHealBloom',
  'combatEnemyMend',
  'combatEnemyCover',
  'combatCoverShatter',
  'combatCardDraw',
  'combatDiscardSweep',
  'combatShuffleVortex',
  'combatFouledPressure',
  'combatRuffledBreak',
  'combatResonanceSurge',
  'combatResonanceSpend',
  'combatWingbeatSurge',
  'combatWingbeatDrain',
  'combatWindedGust',
  'combatFlowSurge',
  'combatCleanseBurst',
  'combatBankCache',
  'combatThreatCharge',
  'combatEnemyRecoveryAfterglow',
  'combatMoltShift',
  'combatOpenSkyGuard',
  'combatOpenSkyExposure',
  'combatDefeatBurst',
  'combatEncounterIntro',
  'combatVictoryRally',
  'combatVictoryFanfareSigil',
  'combatTurnBanner'
] as const;

const SCENE_COMBAT_TEXTURES = {
  combatFloatingCallout: 'combat-floating-callout',
  combatAtmosphereStrip: 'combat-atmosphere-strip',
  combatCardBack: 'combat-card-back',
  combatTargetReticle: 'combat-target-reticle',
  combatTargetLockPulse: 'combat-target-lock-pulse'
} as const;

function kebabCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function uiTextureKey(field: string) {
  return `ui-icon-${kebabCase(field)}`;
}

function combatTextureKey(field: string) {
  return kebabCase(field);
}

function nodeChildren(node: DebugNode | undefined) {
  return Array.isArray(node?.list) ? node.list as DebugNode[] : [];
}

function textureCountInTrees(textureKey: string, roots: DebugRoot[], visibleOnly = false): number {
  const countChildren = (children: DebugNode[]): number => children.reduce((total, child) => {
    const visible = child.visible !== false && (child.alpha ?? 1) > 0.01;
    const own = child.texture?.key === textureKey && (!visibleOnly || visible) ? 1 : 0;
    return total + own + countChildren(nodeChildren(child));
  }, 0);
  return roots.reduce((total, root) => total + countChildren(nodeChildren(root as DebugNode | undefined)), 0);
}

function directTextureCount(textureKey: string, children: Phaser.GameObjects.GameObject[], visibleOnly = false) {
  return (children as DebugNode[]).filter((child) => (
    child.texture?.key === textureKey
    && (!visibleOnly || (child.visible !== false && (child.alpha ?? 1) > 0.01))
  )).length;
}

function sceneRoots(context: BattlePresentationDebugContext) {
  const handRoots = context.roots.hand?.visible ? [context.roots.hand] : [];
  return [context.roots.backdrop, context.roots.battle, ...handRoots, context.roots.fx, context.roots.system];
}

function sceneTextureCount(context: BattlePresentationDebugContext, textureKey: string, visibleOnly = false) {
  return textureCountInTrees(textureKey, sceneRoots(context), visibleOnly)
    + directTextureCount(textureKey, context.scene.children.list, visibleOnly);
}

function labelsByName(name: string, roots: DebugRoot[]) {
  const walk = (children: DebugNode[]): string[] => children.flatMap((child) => {
    const own = child.name === name && typeof child.text === 'string' && child.visible !== false && (child.alpha ?? 1) > 0.01
      ? [child.text]
      : [];
    return [...own, ...walk(nodeChildren(child))];
  });
  return roots.flatMap((root) => walk(nodeChildren(root as DebugNode | undefined)));
}

function namedCountInTrees(name: string, roots: DebugRoot[]) {
  const walk = (children: DebugNode[]): number => children.reduce((total, child) => {
    const own = child.name === name && child.visible !== false && (child.alpha ?? 1) > 0.01 ? 1 : 0;
    return total + own + walk(nodeChildren(child));
  }, 0);
  return roots.reduce((total, root) => total + walk(nodeChildren(root as DebugNode | undefined)), 0);
}

function loadedTextureState(scene: Phaser.Scene, textureKey: string, count: number): TextureState {
  return {
    loaded: scene.textures.exists(textureKey),
    rendered: count > 0,
    count
  };
}

function burstCount(context: BattlePresentationDebugContext, field: string) {
  const value = context.counters[`${field}Bursts`];
  return typeof value === 'number' ? value : 0;
}

/**
 * Builds presentation-only automation telemetry. Keeping this declarative and
 * lazy-loaded prevents BattleScene's boot chunk from carrying hundreds of
 * repeated texture-tree probes while preserving the public debug contract.
 */
export function buildBattlePresentationDebugState(context: BattlePresentationDebugContext) {
  const state: Record<string, TextureState> = {};

  for (const field of UI_TEXTURE_FIELDS) {
    const textureKey = uiTextureKey(field);
    state[field] = loadedTextureState(context.scene, textureKey, sceneTextureCount(context, textureKey));
  }

  const keywordTooltipTexture = uiTextureKey('keywordTooltipFrame');
  state.keywordTooltipFrame = loadedTextureState(
    context.scene,
    keywordTooltipTexture,
    context.keywordTooltipFrameCount
  );

  for (const field of FX_TEXTURE_FIELDS) {
    if (field === 'combatFourSuitRally') {
      const count = namedCountInTrees('combat-four-suit-flourish', [context.roots.fx]);
      state[field] = {
        loaded: true,
        rendered: count > 0,
        count,
        bursts: burstCount(context, field)
      };
      continue;
    }
    const textureKey = combatTextureKey(field);
    const count = field === 'combatCastFocusBurst'
      ? sceneTextureCount(context, textureKey)
      : textureCountInTrees(textureKey, [context.roots.fx]);
    state[field] = {
      ...loadedTextureState(context.scene, textureKey, count),
      bursts: burstCount(context, field)
    };
  }

  state.combatEnemyWindupPlaque.labels = labelsByName(
    'combat-enemy-windup-plaque-label',
    [context.roots.fx]
  );

  for (const [field, textureKey] of Object.entries(SCENE_COMBAT_TEXTURES)) {
    state[field] = loadedTextureState(context.scene, textureKey, sceneTextureCount(context, textureKey));
  }

  const battleHudTexture = uiTextureKey('battleHudCommandRail');
  const battleHudCount = directTextureCount(battleHudTexture, context.roots.battle?.list ?? []);
  state.battleHudRail = {
    loaded: context.scene.textures.exists(battleHudTexture),
    rendered: battleHudCount > 0
  };

  const enemyIntentTexture = uiTextureKey('enemyIntentRing');
  const enemyIntentCount = directTextureCount(enemyIntentTexture, context.roots.battle?.list ?? []);
  state.enemyIntentRing = loadedTextureState(context.scene, enemyIntentTexture, enemyIntentCount);

  const rewardGlowTexture = uiTextureKey('rewardChoiceGlowBurst');
  const rewardGlowCount = sceneTextureCount(context, rewardGlowTexture);
  state.rewardChoiceGlowBurst = {
    ...loadedTextureState(context.scene, rewardGlowTexture, rewardGlowCount),
    bursts: burstCount(context, 'rewardChoiceGlowBurst')
  };

  const rewardHoverTexture = uiTextureKey('rewardChoiceHoverRing');
  const rewardHoverCount = sceneTextureCount(context, rewardHoverTexture);
  const rewardHoverVisible = sceneTextureCount(context, rewardHoverTexture, true);
  state.rewardChoiceHoverRing = {
    loaded: context.scene.textures.exists(rewardHoverTexture),
    rendered: rewardHoverVisible > 0,
    count: rewardHoverCount,
    visible: rewardHoverVisible
  };

  return state;
}
