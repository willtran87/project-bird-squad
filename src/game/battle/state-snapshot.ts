import Phaser from 'phaser';
import { BATTLEFIELD_ASSETS, currentMap, DEFAULT_BATTLEFIELD_ASSET, loadAccount, normalizeFlyway, keywordTooltipState, memoryStorageSessionActive, textPacingState, controlBindingLabel, difficultyMods, difficultyLabel, birdAudio, motionState, visualContrastState, colorCueState, currentScreenShakeState, currentFlashEffectsState, graphicsQualityState, screenReaderState, combatPacingState, animationPacingState, countTextureInGameObjects, COMBAT_ATMOSPHERE_TEXTURE, audioToggleWaveBurstState, settingsFocusState, controlsTextState, uiIconAssets, isRunOutcome, displayName, firstFlightGuideState, firstMoltGuideState, OVEREXTENSION_CARD_THRESHOLD, formatEffects, RETAIN_PRIORITY_RULE, flockStatuses, waymarkSynergyTags, currentMove, currentCombatNodes } from '../../main';
import type { BattleScene, RenderPayload } from '../../main';

// Typed access contract for the scene's deferred presentation adapter.
type SceneAccess = Phaser.Scene & {
  currentBattlefieldAsset: BattleScene['currentBattlefieldAsset'];
  rewardChoices: BattleScene['rewardChoices'];
  root: BattleScene['root'];
  firstCombatGuideCard: BattleScene['firstCombatGuideCard'];
  firstCombatGuideTarget: BattleScene['firstCombatGuideTarget'];
  retentionPlan: BattleScene['retentionPlan'];
  battleDebugStateModule: BattleScene['battleDebugStateModule'];
  backdropLayer: BattleScene['backdropLayer'];
  handLayer: BattleScene['handLayer'];
  fxLayer: BattleScene['fxLayer'];
  systemOverlayLayer: BattleScene['systemOverlayLayer'];
  flyway: BattleScene['flyway'];
  cardContributions: BattleScene['cardContributions'];
  flightCombat: BattleScene['flightCombat'];
  mode: BattleScene['mode'];
  battleAssetReadiness: BattleScene['battleAssetReadiness'];
  combatAnimationPending: BattleScene['combatAnimationPending'];
  playerCardFxBaseline: BattleScene['playerCardFxBaseline'];
  playerCardFxTransientCount: BattleScene['playerCardFxTransientCount'];
  playerCardFxLastRetired: BattleScene['playerCardFxLastRetired'];
  combatIntroActive: BattleScene['combatIntroActive'];
  combatIntroDismissQueued: BattleScene['combatIntroDismissQueued'];
  combatIntroDismissed: BattleScene['combatIntroDismissed'];
  time: BattleScene['time'];
  combatIntroStartedAtMs: BattleScene['combatIntroStartedAtMs'];
  combatIntroElapsedMs: BattleScene['combatIntroElapsedMs'];
  combatEnemyTurnBeat: BattleScene['combatEnemyTurnBeat'];
  combatEnemyTurnMove: BattleScene['combatEnemyTurnMove'];
  enemyTurnBeatProgress: BattleScene['enemyTurnBeatProgress'];
  combatFxModule: BattleScene['combatFxModule'];
  runDifficulty: BattleScene['runDifficulty'];
  activeFxParticleBursts: BattleScene['activeFxParticleBursts'];
  battleFxPresenterReady: BattleScene['battleFxPresenterReady'];
  battleFxPresenterModule: BattleScene['battleFxPresenterModule'];
  battleRenderRequests: BattleScene['battleRenderRequests'];
  battleRenderPasses: BattleScene['battleRenderPasses'];
  battleRenderCoalesced: BattleScene['battleRenderCoalesced'];
  battleRenderQueued: BattleScene['battleRenderQueued'];
  battleRenderLastMs: BattleScene['battleRenderLastMs'];
  battleRenderMaxMs: BattleScene['battleRenderMaxMs'];
  battleRenderTotalMs: BattleScene['battleRenderTotalMs'];
  battleBackdropBuilds: BattleScene['battleBackdropBuilds'];
  battleBackdropReuses: BattleScene['battleBackdropReuses'];
  battleHandBuilds: BattleScene['battleHandBuilds'];
  battleHandReuses: BattleScene['battleHandReuses'];
  battleDebugStateReady: BattleScene['battleDebugStateReady'];
  battleBackdropRendererReady: BattleScene['battleBackdropRendererReady'];
  battleBackdropRendererModule: BattleScene['battleBackdropRendererModule'];
  battleForegroundRendererReady: BattleScene['battleForegroundRendererReady'];
  battleForegroundRendererModule: BattleScene['battleForegroundRendererModule'];
  battleHudRendererReady: BattleScene['battleHudRendererReady'];
  battleHudRendererModule: BattleScene['battleHudRendererModule'];
  battleHandRendererReady: BattleScene['battleHandRendererReady'];
  battleHandRendererModule: BattleScene['battleHandRendererModule'];
  battleRewardRendererLoading: BattleScene['battleRewardRendererLoading'];
  battleRewardRendererModule: BattleScene['battleRewardRendererModule'];
  battleRewardRendererFailed: BattleScene['battleRewardRendererFailed'];
  rewardPresentationReady: BattleScene['rewardPresentationReady'];
  battleInspectRendererLoading: BattleScene['battleInspectRendererLoading'];
  battleInspectRendererModule: BattleScene['battleInspectRendererModule'];
  battleInspectRendererFailed: BattleScene['battleInspectRendererFailed'];
  openingDraw: BattleScene['openingDraw'];
  children: BattleScene['children'];
  pauseOverlayOpen: BattleScene['pauseOverlayOpen'];
  pauseSaveFailed: BattleScene['pauseSaveFailed'];
  settingsOverlayOpen: BattleScene['settingsOverlayOpen'];
  textures: BattleScene['textures'];
  outcomeUnlockHighlights: BattleScene['outcomeUnlockHighlights'];
  bossDossierModule: BattleScene['bossDossierModule'];
  outcomeDetailsOpen: BattleScene['outcomeDetailsOpen'];
  outcomeFlightDetails: BattleScene['outcomeFlightDetails'];
  encounter: BattleScene['encounter'];
  encounterObjectiveTextState: BattleScene['encounterObjectiveTextState'];
  encounterObjectiveFeedbackStatus: BattleScene['encounterObjectiveFeedbackStatus'];
  encounterObjectiveFeedbackBursts: BattleScene['encounterObjectiveFeedbackBursts'];
  activeMoltPower: BattleScene['activeMoltPower'];
  combatMoltPowerBursts: BattleScene['combatMoltPowerBursts'];
  turn: BattleScene['turn'];
  energy: BattleScene['energy'];
  spark: BattleScene['spark'];
  flock: BattleScene['flock'];
  getSelectedCard: BattleScene['getSelectedCard'];
  cardBuildsFlow: BattleScene['cardBuildsFlow'];
  isGuidedFirstCombat: BattleScene['isGuidedFirstCombat'];
  firstMoltGuideCard: BattleScene['firstMoltGuideCard'];
  effectiveCost: BattleScene['effectiveCost'];
  registry: BattleScene['registry'];
  hand: BattleScene['hand'];
  cardsPlayedThisTurn: BattleScene['cardsPlayedThisTurn'];
  combatInputFocusState: BattleScene['combatInputFocusState'];
  combatCardDetail: BattleScene['combatCardDetail'];
  selectedInstanceId: BattleScene['selectedInstanceId'];
  selectedCardOutcomePreview: BattleScene['selectedCardOutcomePreview'];
  discardChoice: BattleScene['discardChoice'];
  discardChoiceModule: BattleScene['discardChoiceModule'];
  returnChoice: BattleScene['returnChoice'];
  returnChoiceModule: BattleScene['returnChoiceModule'];
  discardPile: BattleScene['discardPile'];
  activeCardContract: BattleScene['activeCardContract'];
  getInspectedCardPayload: BattleScene['getInspectedCardPayload'];
  cardInspectFocusState: BattleScene['cardInspectFocusState'];
  selectedEnemyId: BattleScene['selectedEnemyId'];
  allDeckCards: BattleScene['allDeckCards'];
  drawPile: BattleScene['drawPile'];
  clearedPile: BattleScene['clearedPile'];
  incomingFlockDamagePreview: BattleScene['incomingFlockDamagePreview'];
  waymarkChoices: BattleScene['waymarkChoices'];
  waymarkRewardBuildObservations: BattleScene['waymarkRewardBuildObservations'];
  rewardObservations: BattleScene['rewardObservations'];
  districtLeans: BattleScene['districtLeans'];
  upgradeChoices: BattleScene['upgradeChoices'];
  enemies: BattleScene['enemies'];
  currentRouteIndex: BattleScene['currentRouteIndex'];
  completedRouteNodeIds: BattleScene['completedRouteNodeIds'];
  scrap: BattleScene['scrap'];
  routeMarks: BattleScene['routeMarks'];
  runSupplies: BattleScene['runSupplies'];
  battlefieldMood: BattleScene['battlefieldMood'];
  inspectOverlay: BattleScene['inspectOverlay'];
  waymarkDrawerOpen: BattleScene['waymarkDrawerOpen'];
  waymarkReviewModule: BattleScene['waymarkReviewModule'];
  supplyDrawerOpen: BattleScene['supplyDrawerOpen'];
  waymarkFeedback: BattleScene['waymarkFeedback'];
  supplyFeedback: BattleScene['supplyFeedback'];
  flockStatRows: BattleScene['flockStatRows'];
  log: BattleScene['log'];
};

export function buildBattleStateSnapshot(raw: BattleScene): RenderPayload {
    const scene = raw as unknown as SceneAccess;
    const battlefield = scene.currentBattlefieldAsset();
    const districtBattlefield = BATTLEFIELD_ASSETS[currentMap().id] ?? DEFAULT_BATTLEFIELD_ASSET;
    const rewardAccount = scene.rewardChoices.length ? loadAccount() : undefined;
    const cardCollection = rewardAccount?.cardCollection ?? {};
    const collectionTargets = new Set(rewardAccount?.hunt ?? []);
    const flowStatus = (scene.root?.list.find((child) => child.name === 'combat-flow-status') as Phaser.GameObjects.Text | undefined)?.text ?? '';
    const firstCombatGuideCard = scene.firstCombatGuideCard();
    const firstCombatGuideTarget = scene.firstCombatGuideTarget(firstCombatGuideCard);
    const retention = scene.retentionPlan();
    const presentationDebugState = scene.battleDebugStateModule?.buildBattlePresentationDebugState({
      scene: scene,
      roots: {
        backdrop: scene.backdropLayer,
        battle: scene.root,
        hand: scene.handLayer,
        fx: scene.fxLayer,
        system: scene.systemOverlayLayer
      },
      counters: scene as unknown as Record<string, unknown>
    }) ?? {};
    return {
      flyway: { ...normalizeFlyway(scene.flyway), combat: scene.flightCombat,
        pacing: (scene as unknown as {identityPacing?:unknown}).identityPacing },
      cardContributions: scene.cardContributions.map(row => ({ ...row })),
      cardAction: (() => {
        const actor = scene.fxLayer?.getByName('combat-card-cast-ghost');
        return actor?.active ? { style: actor.getData('actionStyle'), cardId: actor.getData('cardId'), reducedMotion: actor.getData('reducedMotion') } : undefined;
      })(),
      cardPayoff: (() => {
        const payoff = (scene as unknown as { motionPayoff?: { until: number; text: string; cardId: string; results: string[] } }).motionPayoff;
        return payoff && scene.time.now < payoff.until ? { text: payoff.text, cardId: payoff.cardId, results: [...payoff.results] } : undefined;
      })(),
      mode: scene.mode,
      scene: 'BattleScene',
      keywordTooltip: keywordTooltipState(scene),
      practice: memoryStorageSessionActive(),
      assetReadiness: scene.battleAssetReadiness.snapshot(),
      combatAnimationPending: scene.combatAnimationPending,
      playerCardFeedback: {
        active: Boolean(scene.playerCardFxBaseline),
        baselineObjects: scene.playerCardFxBaseline?.size ?? 0,
        transientObjects: scene.playerCardFxTransientCount(),
        lastRetiredObjects: scene.playerCardFxLastRetired,
      },
      combatIntro: {
        active: scene.combatIntroActive,
        dismissQueued: scene.combatIntroDismissQueued,
        dismissed: scene.combatIntroDismissed,
        minimumReadableMs: textPacingState().minimumReadableMs,
        elapsedMs: scene.combatIntroActive
          ? Math.max(0, Math.round(scene.time.now - scene.combatIntroStartedAtMs))
          : scene.combatIntroElapsedMs,
        binding: controlBindingLabel('confirm'),
      },
      combatEnemyTurnBeat: scene.combatEnemyTurnBeat,
      combatEnemyTurnMove: scene.combatEnemyTurnMove,
      combatEnemyTurnProgress: scene.enemyTurnBeatProgress(),
      combatEnemyTurnAcceleration: scene.combatFxModule?.enemyTurnAccelerationState(scene),
      difficulty: {
        ...difficultyMods(scene.runDifficulty),
        label: difficultyLabel(scene.runDifficulty),
      },
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
        atmosphereStrips: countTextureInGameObjects(scene.backdropLayer?.list ?? [], COMBAT_ATMOSPHERE_TEXTURE),
        activeParticleBursts: scene.activeFxParticleBursts,
        particleBurstCap: graphicsQualityState().particleBurstCap,
      },
      battleFxPresenter: {
        ready: scene.battleFxPresenterReady,
        loaded: Boolean(scene.battleFxPresenterModule),
      },
      combatRender: {
        requests: scene.battleRenderRequests,
        passes: scene.battleRenderPasses,
        coalesced: scene.battleRenderCoalesced,
        queued: scene.battleRenderQueued,
        lastMs: Number(scene.battleRenderLastMs.toFixed(2)),
        maxMs: Number(scene.battleRenderMaxMs.toFixed(2)),
        totalMs: Number(scene.battleRenderTotalMs.toFixed(2)),
        backdropBuilds: scene.battleBackdropBuilds,
        backdropReuses: scene.battleBackdropReuses,
        handBuilds: scene.battleHandBuilds,
        handReuses: scene.battleHandReuses,
        backdropObjects: scene.backdropLayer?.list.length ?? 0,
        uiObjects: (scene.root?.list.length ?? 0) + (scene.handLayer?.list.length ?? 0),
      },
      battleDebugState: {
        ready: scene.battleDebugStateReady,
        loaded: Boolean(scene.battleDebugStateModule)
      },
      battleBackdropRenderer: {
        ready: scene.battleBackdropRendererReady,
        loaded: Boolean(scene.battleBackdropRendererModule)
      },
      battleForegroundRenderer: {
        ready: scene.battleForegroundRendererReady,
        loaded: Boolean(scene.battleForegroundRendererModule)
      },
      battleHudRenderer: {
        ready: scene.battleHudRendererReady,
        loaded: Boolean(scene.battleHudRendererModule)
      },
      battleHandRenderer: {
        ready: scene.battleHandRendererReady,
        loaded: Boolean(scene.battleHandRendererModule)
      },
      battleRewardRenderer: {
        requested: scene.battleRewardRendererLoading || Boolean(scene.battleRewardRendererModule) || scene.battleRewardRendererFailed,
        ready: scene.rewardPresentationReady(),
        loaded: Boolean(scene.battleRewardRendererModule),
        failed: scene.battleRewardRendererFailed
      },
      battleInspectRenderer: {
        requested: scene.battleInspectRendererLoading || Boolean(scene.battleInspectRendererModule) || scene.battleInspectRendererFailed,
        loaded: Boolean(scene.battleInspectRendererModule),
        failed: scene.battleInspectRendererFailed
      },
      openingDraw: { ...scene.openingDraw },
      ...presentationDebugState,
      audioToggleWaveBurst: audioToggleWaveBurstState(scene, scene.children.list),
      paused: scene.pauseOverlayOpen,
      pauseSaveFailed: scene.pauseOverlayOpen && scene.pauseSaveFailed,
      settingsOverlayOpen: scene.settingsOverlayOpen,
      settingsFocus: settingsFocusState(scene, scene.settingsOverlayOpen),
      controls: controlsTextState(scene, scene.settingsOverlayOpen),
      unlockHighlights: {
        iconLoaded: scene.textures.exists(uiIconAssets['unlock-badge'].key),
        flourishLoaded: scene.textures.exists(uiIconAssets['progression-unlock-flourish'].key),
        items: scene.outcomeUnlockHighlights()
      },
      defeatReview: scene.mode === 'defeat'
        ? scene.bossDossierModule?.buildDefeatReview(window.__birdSquadLastRun)
        : undefined,
      outcomeFlightDetails: isRunOutcome(scene.mode)
        ? {
            open: scene.outcomeDetailsOpen,
            details: scene.outcomeDetailsOpen ? scene.outcomeFlightDetails() : undefined,
          }
        : undefined,
      encounter: scene.encounter,
      encounterObjective: scene.encounterObjectiveTextState(),
      encounterObjectiveFeedback: {
        status: scene.encounterObjectiveFeedbackStatus,
        bursts: scene.encounterObjectiveFeedbackBursts,
        rendered: scene.fxLayer?.list.some((child) => child.name === 'combat-objective-feedback') ?? false,
      },
      combatMoltPower: {
        total: scene.activeMoltPower(),
        bursts: scene.combatMoltPowerBursts,
        rendered: scene.fxLayer?.list.some((child) => child.name === 'combat-molt-power') ?? false,
      },
      turn: scene.turn,
      energy: scene.energy,
      resonance: scene.spark,
      flow: scene.flock.flow,
      flowMax: scene.flock.flowMax,
      flowPreview: scene.getSelectedCard() && scene.cardBuildsFlow(scene.getSelectedCard()!) && scene.flock.flow < scene.flock.flowMax ? 1 : 0,
      flowRail: {
        rendered: scene.root?.list.some((child) => child.name === 'combat-flow-rail') ?? false,
        previewPips: scene.root?.list.filter((child) => child.name === 'combat-flow-preview-pip').length ?? 0,
        status: flowStatus,
        breakPreview: flowStatus === 'FLOW BREAKS',
        holdPreview: flowStatus === 'FLOW HOLDS',
      },
      firstCombatGuidance: {
        active: scene.isGuidedFirstCombat() || Boolean(scene.firstMoltGuideCard()),
        rendered: scene.root?.list.some((child) => child.name === 'first-combat-guidance' && (child as Phaser.GameObjects.Text).visible) ?? false,
        cardName: firstCombatGuideCard ? displayName(firstCombatGuideCard) : undefined,
        cost: firstCombatGuideCard ? scene.effectiveCost(firstCombatGuideCard) : undefined,
        target: firstCombatGuideTarget?.name,
      },
      practiceLesson: scene.registry.get('birdsquad.practiceLesson'),
      firstFlightGuide: firstFlightGuideState(),
      firstMoltGuide: {
        ...firstMoltGuideState(Boolean(scene.hand.find((card) => card.runtime.kind === 'molt'))),
        cardId: scene.firstMoltGuideCard()?.id,
        cardName: scene.firstMoltGuideCard() ? displayName(scene.firstMoltGuideCard()!) : undefined,
        rendered: scene.handLayer?.list.some((child) => child.name === 'combat-molt-guide-tag') ?? false,
      },
      overextension: {
        cardsPlayedThisTurn: scene.cardsPlayedThisTurn,
        threshold: scene.flyway.condition === 'scaffold' ? 3 : OVEREXTENSION_CARD_THRESHOLD,
        safeCardsRemaining: Math.max(0, OVEREXTENSION_CARD_THRESHOLD - 1 - scene.cardsPlayedThisTurn),
        currentlyExposed: scene.flock.exposed
      },
      combatInputFocus: scene.combatInputFocusState(),
      combatCardDetail: scene.combatCardDetail?.active ? {
        kind: scene.combatCardDetail.getData('kind'),
        card: scene.combatCardDetail.getData('cardName'),
        page: scene.combatCardDetail.getData('page') + 1,
        pageCount: scene.combatCardDetail.getData('pageCount'),
        heading: scene.combatCardDetail.getData('heading'),
        body: scene.combatCardDetail.getData('body'),
        controls: `${controlBindingLabel('previous')} / ${controlBindingLabel('next')} or controller Left / Right to read pages. ${controlBindingLabel('back')} or controller B to close.`,
      } : undefined,
      selectedCard: scene.selectedInstanceId,
      selectedCardOutcome: scene.selectedCardOutcomePreview(),
      discardChoice: scene.discardChoice && scene.discardChoiceModule
        ? scene.discardChoiceModule.discardChoiceTextState(
            scene.discardChoice,
            scene.hand.map((card) => ({ instanceId: card.instanceId, id: card.id, name: displayName(card) })),
            {
              choose: `${controlBindingLabel('previous')} / ${controlBindingLabel('next')} / D-pad`,
              toggle: `${controlBindingLabel('confirm')} / A / pointer`,
              confirm: `${controlBindingLabel('roost')} / Y / pointer`,
              cancel: scene.discardChoice.optional ? `${controlBindingLabel('back')} / B keeps the hand` : 'Mandatory choice',
            },
          )
        : undefined,
      returnChoice: scene.returnChoice && scene.returnChoiceModule
        ? scene.returnChoiceModule.returnChoiceTextState(
            scene.returnChoice,
            scene.discardPile.map((card) => {
              const contract = scene.activeCardContract(card);
              return {
                instanceId: card.instanceId,
                id: card.id,
                name: displayName(card),
                cost: scene.effectiveCost(card),
                role: contract.role,
                summary: formatEffects(contract.effects),
              };
            }),
            {
              choose: `${controlBindingLabel('previous')} / ${controlBindingLabel('next')} / D-pad / tap a card to read`,
              confirm: `${controlBindingLabel('confirm')} / A / Return selected card button`,
              cancel: 'Mandatory choice; Back / B does not cancel',
            },
          )
        : undefined,
      retentionPlan: retention.count > 0
        ? {
            count: retention.count,
            cards: retention.cards.map((card, index) => ({
              instanceId: card.instanceId,
              id: card.id,
              name: displayName(card),
              order: index + 1,
            })),
            selectedPriority: retention.selectedPriority,
            rule: RETAIN_PRIORITY_RULE,
          }
        : undefined,
      inspectedCard: scene.getInspectedCardPayload(),
      cardInspectFocus: scene.cardInspectFocusState(),
      selectedEnemy: scene.selectedEnemyId,
      deckIds: scene.allDeckCards().map((card) => card.id),
      drawPile: scene.drawPile.length,
      discardPile: scene.discardPile.length,
      clearedPile: scene.clearedPile.length,
      deckSize: scene.allDeckCards().length,
      flock: {
        hp: scene.flock.hp,
        maxHp: scene.flock.maxHp,
        block: scene.flock.block,
        fouled: scene.flock.fouled,
        incoming: scene.incomingFlockDamagePreview(),
        statuses: flockStatuses(scene.flock)
      },
      hand: scene.hand.map((card) => {
        const contract = scene.activeCardContract(card);
        const retainIndex = retention.cards.findIndex((candidate) => candidate.instanceId === card.instanceId);
        return {
          instanceId: card.instanceId,
          id: card.id,
          name: displayName(card),
          bird: card.bird,
          cost: scene.effectiveCost(card),
          type: card.type,
          role: card.role,
          target: card.target,
          activeTarget: contract.target,
          activeRole: contract.role,
          activeText: contract.text,
          usesMolt: contract.usesMolt,
          retainOrder: retainIndex >= 0 ? retainIndex + 1 : undefined,
          discardSelectable: scene.discardChoice?.candidateIds.includes(card.instanceId),
          discardSelected: scene.discardChoice?.selectedIds.includes(card.instanceId),
          discardOrder: scene.discardChoice ? (() => {
            const index = scene.discardChoice!.selectedIds.indexOf(card.instanceId);
            return index >= 0 ? index + 1 : undefined;
          })() : undefined,
        };
      }),
      waymarkChoices: scene.waymarkChoices.map((mark) => ({
        id: mark.id,
        name: mark.name,
        family: mark.family,
        rarity: mark.rarity,
        source: mark.source,
        description: mark.description,
        tags: waymarkSynergyTags(mark),
        observations: scene.waymarkRewardBuildObservations[mark.id] ?? []
      })),
      rewardChoices: scene.rewardChoices.map((card) => ({
        id: card.id,
        name: displayName(card),
        bird: card.bird,
        cost: card.cost,
        type: card.type,
        target: card.target,
        observations: scene.rewardObservations(card),
        collection: {
          firstClaim: !cardCollection[card.id],
          timesClaimed: cardCollection[card.id]?.timesClaimed ?? 0,
          targeted: collectionTargets.has(card.id),
          runCopyTemporary: true as const,
        }
      })),
      rewardDistrictLean: scene.mode === 'cardReward' ? scene.districtLeans() : [],
      upgradeChoices: scene.upgradeChoices.map((card) => ({
        id: card.id,
        name: displayName(card),
        bird: card.bird,
        cost: card.cost,
        type: card.type,
        target: card.target
      })),
      rewardDecisionDeltas: scene.root?.list
        .filter((child): child is Phaser.GameObjects.Text => ['reward-decision-delta', 'reward-preen-change'].includes(child.name) && child instanceof Phaser.GameObjects.Text)
        .map((child) => child.text) ?? [],
      enemies: scene.enemies.map((enemy) => ({
        id: enemy.id,
        name: enemy.name,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        block: enemy.block,
        weak: enemy.weak,
        roles: enemy.roles,
        solo: enemy.solo,
        damageBonus: enemy.damageBonus,
        intent: currentMove(enemy).label,
        intentIndex: enemy.intentIndex,
        phase: enemy.phase,
        phaseName: enemy.runtime.phaseTwoName,
        phaseThreshold: enemy.runtime.type === 'boss' ? Math.ceil(enemy.maxHp / 2) : undefined,
        phaseTwoMoveIds: enemy.runtime.phaseTwoMoveIds ? [...enemy.runtime.phaseTwoMoveIds] : undefined,
      })),
      route: {
        mapId: currentMap().id,
        mapName: currentMap().name,
        currentNodeId: currentCombatNodes()[scene.currentRouteIndex]?.id ?? '',
        currentPayloadId: currentCombatNodes()[scene.currentRouteIndex]?.payloadId ?? '',
        completedNodeIds: [...scene.completedRouteNodeIds],
        scrap: scene.scrap,
        routeMarks: [...scene.routeMarks],
        supplies: [...scene.runSupplies],
        battlefieldAssetKey: battlefield.key,
        battlefieldVariant: battlefield.key !== districtBattlefield.key,
        battlefieldMood: scene.battlefieldMood()
      },
      inspectOverlay: scene.inspectOverlay,
      waymarkDrawerOpen: scene.waymarkDrawerOpen,
      waymarkReview: scene.waymarkReviewModule?.battleWaymarkReading(scene),
      waymarkReaderNotice: scene.waymarkDrawerOpen ? (scene.root.getByName('battle-waymark-loading') as Phaser.GameObjects.Text)?.text : undefined,
      supplyDrawerOpen: scene.supplyDrawerOpen,
      waymarkFeedback: [...scene.waymarkFeedback],
      supplyFeedback: [...scene.supplyFeedback],
      piles: {
        deck: scene.allDeckCards().length,
        draw: scene.drawPile.length,
        hand: scene.hand.length,
        discard: scene.discardPile.length,
        cleared: scene.clearedPile.length
      },
      flockStats: scene.flockStatRows().map((row) => ({
        label: row.label,
        base: row.base,
        flock: row.bonus,
        current: row.total
      })),
      log: scene.log.slice(-5)
    };
  }
