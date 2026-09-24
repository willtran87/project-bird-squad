import Phaser from 'phaser';
import { formatEffects } from '../main';
import { cardPickerDeckImpact } from './reward-card-inspection';
import { memoryStorageSessionActive } from './safe-storage';
import { eventChoiceState } from './route-event-reading';

export type RouteDebugStateDependencies = Record<string, any>;

export function updateRouteDebugState(scene: any, dependencies: RouteDebugStateDependencies) {
  const {
    activeMapIndex,
    advanceGameTime,
    alphaSupplyLibrary,
    animationPacingState,
    audioToggleWaveBurstState,
    birdAudio,
    cardStatRows,
    cardStatTotalRows,
    colorCueState,
    collectionGoalSummary,
    combatPacingState,
    compactEffectGrammar,
    controlBindingLabel,
    controlsTextState,
    countTextureInGameObjects,
    currentFlashEffectsState,
    currentMap,
    currentScreenShakeState,
    displayName,
    firstFlightGuideState,
    firstFlightGuideStep,
    getInspectedEntry,
    graphicsQualityState,
    inspectedCardPayload,
    motionState,
    runDistrictOrdinal,
    runMapIndices,
    runSupplyCapacity,
    screenReaderState,
    settingsFocusState,
    textPacingState,
    uiIconAssets,
    visualContrastState
  } = dependencies;
  const children = scene.children.list;

  const iconState = (id: string) => {
    // Retired decorative assets remain in the snapshot contract, not the load queue.
    const key = uiIconAssets[id]?.key;
    if (!key) return { loaded: false, rendered: false, count: 0 };
    const count = countTextureInGameObjects(children, key);
    return { loaded: scene.textures.exists(key), rendered: count > 0, count };
  };

  const visibleDeckCards = scene.mapDeckCards();
      const selectedDeckEntry = getInspectedEntry(visibleDeckCards, scene.inspectedCardId);
      const deckComparison = scene.deckOverlayOpen
        ? scene.deckReviewComparison(selectedDeckEntry?.card)
        : undefined;
      const inspected = scene.deckOverlayOpen
        ? inspectedCardPayload(selectedDeckEntry, undefined)
        : undefined;
      const marketNode = currentMap().nodes.find((node: any) => node.id === scene.marketNodeId);
      const choiceNode = currentMap().nodes.find((node: any) => node.id === scene.nodeChoiceNodeId);
      const marketBackdrop = scene.routeEventBackdropAsset(marketNode);
      const choiceBackdrop = scene.routeEventBackdropAsset(choiceNode);
      const routeMapBackdrop = scene.routeMapBackdrop;
      const rewardChoices = scene.routeRewardChoiceDebugState();
      const ownedWaymarks = scene.ownedRouteMarkDefs();
      const selectedWaymark = scene.waymarkDrawerOpen ? scene.selectedRouteWaymark() : undefined;
      const pinnedWaymark = scene.waymarkDrawerOpen ? scene.pinnedRouteWaymark() : undefined;
      window.advanceTime = (ms: number) => advanceGameTime(scene.game, ms);
      window.render_game_to_text = () => JSON.stringify({
        mode: 'routeSelection',
        scene: 'RouteScene',
        practice: memoryStorageSessionActive(),
        routeAssetsReady: scene.routeEssentialAssetsReady,
        assetReadiness: scene.routeAssetReadiness.snapshot(),
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
          ambientAnimations: graphicsQualityState().ambientAnimations,
        },
        audioTogglePulseRing: {
          loaded: scene.textures.exists(uiIconAssets['audio-toggle-pulse-ring'].key),
          rendered: countTextureInGameObjects(children, uiIconAssets['audio-toggle-pulse-ring'].key) > 0,
          count: countTextureInGameObjects(children, uiIconAssets['audio-toggle-pulse-ring'].key)
        },
        audioToggleWaveBurst: audioToggleWaveBurstState(scene, children),
        map: {
          id: currentMap().id,
          name: currentMap().name,
          index: currentMap().index,
          entryNodeId: currentMap().entryNodeId,
          bossNodeId: currentMap().bossNodeId
        },
        routeMapBackdrop: {
          assetKey: routeMapBackdrop?.key ?? '',
          loaded: !!routeMapBackdrop && scene.textures.exists(routeMapBackdrop.key),
          rendered: !!routeMapBackdrop && scene.children.list.some((child: any) => child.name === 'route-map-backdrop' && child.texture?.key === routeMapBackdrop.key)
        },
        run: {
          currentNodeId: scene.runState.currentRouteNodeId ?? '',
          completedNodeIds: [...scene.runState.completedRouteNodeIds],
          deckSize: scene.runState.deck.length,
          currentHp: scene.runState.currentHp,
          maxHp: scene.runMaxHp(),
          scrap: scene.runState.scrap,
          routeMarks: [...scene.runState.routeMarks],
          supplies: [...scene.runState.supplies],
          supplySlots: runSupplyCapacity(scene.runState)
        },
        routeStatus: scene.routeStatusSummary(),
        routeCheckpoint: { ...scene.routeCheckpointState },
        routeBossBeaconRing: {
          loaded: scene.textures.exists(uiIconAssets['route-boss-beacon-ring'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['route-boss-beacon-ring'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['route-boss-beacon-ring'].key)
        },
        districtBanner: {
          loaded: scene.textures.exists(uiIconAssets['route-district-banner'].key),
          district: runDistrictOrdinal(scene.runState.runMode, activeMapIndex),
          districtCount: runMapIndices(scene.runState.runMode).length,
          mapName: currentMap().name
        },
        collectionGoal: {
          ...collectionGoalSummary(),
          rendered: scene.children.list.some((child: any) => child.name === 'route-collection-goal-hit'),
          opening: scene.routeCodexOpening,
          newCardId: scene.children.getByName('route-collection-goal-hit')?.getData('newCardId') || undefined,
          destination: scene.children.getByName('route-collection-goal-hit')?.getData('destination') || 'Collection Atlas',
          input: {
            pointer: true,
            keyboard: 'G',
            controller: 'R3',
            destination: 'Collection Atlas',
            returnsTo: 'Route',
          },
        },
        districtAdvanceFlourish: scene.districtAdvanceFlourishState(),
        districtAdvanceTitlePlaque: scene.districtAdvanceTitlePlaqueState(),
        bossPrepDossier: {
          loaded: scene.textures.exists(uiIconAssets['boss-prep-dossier-flourish'].key),
          rendered: scene.children.list.some((child: any) => child.texture?.key === uiIconAssets['boss-prep-dossier-flourish'].key)
        },
        bossPrepReadinessChipFrame: {
          loaded: scene.textures.exists(uiIconAssets['boss-prep-readiness-chip-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['boss-prep-readiness-chip-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['boss-prep-readiness-chip-frame'].key)
        },
        bossPrepPressurePlaque: {
          loaded: scene.textures.exists(uiIconAssets['boss-prep-pressure-plaque'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['boss-prep-pressure-plaque'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['boss-prep-pressure-plaque'].key)
        },
        bossPrepSignalModule: {
          loaded: scene.textures.exists(uiIconAssets['boss-prep-signal-module'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['boss-prep-signal-module'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['boss-prep-signal-module'].key)
        },
        bossPrepRouteForPlate: {
          loaded: scene.textures.exists(uiIconAssets['boss-prep-route-for-plate'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['boss-prep-route-for-plate'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['boss-prep-route-for-plate'].key)
        },
        supplyFeedback: [...scene.supplyFeedback],
        routeSupplyFeedbackFrame: {
          loaded: scene.textures.exists(uiIconAssets['route-supply-feedback-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['route-supply-feedback-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['route-supply-feedback-frame'].key)
        },
        routeMapFrame: {
          loaded: scene.textures.exists(uiIconAssets['route-map-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['route-map-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['route-map-frame'].key)
        },
        routeNodeTooltipFrame: (() => {
          const count = scene.children.list.filter((child: any) => child.name === 'route-node-tooltip').length;
          return { loaded: true, rendered: count > 0, count };
        })(),
        routeRiskMeterFrame: {
          loaded: scene.textures.exists(uiIconAssets['route-risk-meter-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['route-risk-meter-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['route-risk-meter-frame'].key)
        },
        routeCommitTooltipFrame: {
          loaded: scene.textures.exists(uiIconAssets['route-commit-tooltip-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['route-commit-tooltip-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['route-commit-tooltip-frame'].key)
        },
        routeCommitPending: scene.routeCommitPending,
        routeCommitStreak: scene.routeCommitStreakState(),
        routeSelectedNodeRing: {
          loaded: scene.textures.exists(uiIconAssets['route-selected-node-ring'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['route-selected-node-ring'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['route-selected-node-ring'].key)
        },
        cardPickerFrame: {
          ...iconState('card-picker-frame'),
          mode: scene.cardPickerMode ?? '',
          context: scene.cardPickerContext ?? ''
        },
        cardPickerInput: scene.cardPickerMode
          ? (() => {
              const entries = scene.pickerEligibleCards(scene.cardPickerMode);
              const index = Math.max(0, Math.min(
                entries.length - 1,
                Math.round(scene.cardPickerFocusIndex ?? 0),
              ));
              const focused = entries[index];
              return {
                mode: scene.cardPickerMode,
                context: scene.cardPickerContext,
                count: entries.length,
                focusIndex: index,
                cardIndex: focused?.index,
                cardId: focused?.card?.id,
                cardName: focused?.name,
                cost: focused?.cost,
                affordable: scene.cardPickerContext !== 'market' || scene.runState.scrap >= (focused?.cost ?? 0),
                armed: scene.cardPickerArmedIndex === focused?.index,
                armedCardIndex: scene.cardPickerArmedIndex,
                armedCardId: scene.cardPickerArmedIndex === undefined
                  ? undefined
                  : scene.runState.deck[scene.cardPickerArmedIndex]?.id,
                commitBlockedUntilSelected: scene.cardPickerArmedIndex === undefined,
                scrollRow: scene.cardPickerScroll,
                focusVisible: scene.children.list.some((child: any) => child.name === 'card-picker-input-focus-ring'),
                inspectTargets: scene.children.list.filter((child: any) => child.name === 'card-picker-card-inspect-hit').length,
                inspectionOpen: Boolean(scene.cardPickerInspectionOpen),
                reading: scene.cardPickerInspectionOpen ? scene.cardHoverDetailRequest?.inspectionRules : undefined,
                deckImpact: scene.cardPickerInspectionOpen && focused ? cardPickerDeckImpact(scene, focused.index) : undefined,
                returnIndex: index,
                decisionPreserved: true,
                controls: {
                  choose: 'Arrow keys / D-pad',
                  apply: scene.cardPickerArmedIndex === undefined
                    ? 'Confirm / A / pointer selects'
                    : 'Confirm / A / second pointer activation commits',
                  inspect: 'Roost / Y / Inspect',
                  back: scene.cardPickerArmedIndex === undefined ? 'Back / B closes' : 'Back / B cancels selection',
                },
              };
            })()
          : undefined,
        cardPickerScrollButtonFrame: iconState('card-picker-scroll-button-frame'),
        cardPickerCostBadge: iconState('card-picker-cost-badge'),
        cardPickerPageIndicatorFrame: iconState('card-picker-page-indicator-frame'),
        cardPickerNameplateFrame: iconState('card-picker-nameplate-frame'),
        cardPickerContextPlaque: iconState('card-picker-context-plaque'),
        cardPickerDecisionDeltas: scene.children.list
          .filter((child: any) => child.name === 'card-picker-card-hit')
          .map((child: any) => child.getData('decisionDelta')),
        marketEnamelCommandFrame: {
          loaded: scene.textures.exists(uiIconAssets['market-enamel-command-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['market-enamel-command-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['market-enamel-command-frame'].key)
        },
        marketSoldSlatFrame: {
          loaded: scene.textures.exists(uiIconAssets['market-sold-slat-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['market-sold-slat-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['market-sold-slat-frame'].key)
        },
        marketVendorTitlePlaque: scene.marketVendorTitlePlaqueState(),
        routeEventTitlePlaque: scene.routeEventTitlePlaqueState(),
        routeEventCancelCommandFrame: {
          loaded: scene.textures.exists(uiIconAssets['route-event-cancel-command-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['route-event-cancel-command-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['route-event-cancel-command-frame'].key)
        },
        routeChoiceOptionFrame: scene.routeChoiceOptionFrameState(),
        routeChoiceDetailFrame: scene.routeChoiceDetailFrameState(),
        routeChoicePreviewRowFrame: scene.routeChoicePreviewRowFrameState(),
        runKitItemTileFrame: {
          loaded: scene.textures.exists(uiIconAssets['run-kit-item-tile-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['run-kit-item-tile-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['run-kit-item-tile-frame'].key)
        },
        runKitEmptySlotFrame: {
          loaded: scene.textures.exists(uiIconAssets['run-kit-empty-slot-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['run-kit-empty-slot-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['run-kit-empty-slot-frame'].key)
        },
        routeWaymarkScrollRailFrame: {
          loaded: scene.textures.exists(uiIconAssets['route-waymark-scroll-rail-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['route-waymark-scroll-rail-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['route-waymark-scroll-rail-frame'].key)
        },
        confirmExitFrame: {
          loaded: scene.textures.exists(uiIconAssets['confirm-exit-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['confirm-exit-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['confirm-exit-frame'].key)
        },
        confirmExitCommandFrame: {
          loaded: scene.textures.exists(uiIconAssets['confirm-exit-command-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['confirm-exit-command-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['confirm-exit-command-frame'].key)
        },
        systemSettingsRowFrame: {
          loaded: scene.textures.exists(uiIconAssets['system-settings-row-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['system-settings-row-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['system-settings-row-frame'].key)
        },
        systemSettingsToggleFrame: {
          loaded: scene.textures.exists(uiIconAssets['system-settings-toggle-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['system-settings-toggle-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['system-settings-toggle-frame'].key)
        },
        systemSettingsVolumeSliderFrame: {
          loaded: scene.textures.exists(uiIconAssets['system-settings-volume-slider-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['system-settings-volume-slider-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['system-settings-volume-slider-frame'].key)
        },
        systemSettingsMotionSwitchFrame: {
          loaded: scene.textures.exists(uiIconAssets['system-settings-motion-switch-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['system-settings-motion-switch-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['system-settings-motion-switch-frame'].key)
        },
        systemFieldCommandFrame: {
          loaded: scene.textures.exists(uiIconAssets['system-field-command-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['system-field-command-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['system-field-command-frame'].key)
        },
        systemOverlayTitlePlaque: {
          loaded: scene.textures.exists(uiIconAssets['system-overlay-title-plaque'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['system-overlay-title-plaque'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['system-overlay-title-plaque'].key)
        },
        systemPauseDetailRowFrame: {
          loaded: scene.textures.exists(uiIconAssets['system-pause-detail-row-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['system-pause-detail-row-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['system-pause-detail-row-frame'].key)
        },
        deckOverlayOpen: scene.deckOverlayOpen,
        deckReview: {
          open: scene.deckOverlayOpen,
          savedFlights: scene.savedDeckRecordState(),
          browserRenderer: {
            requested: Boolean(scene.routeDeckBrowserModule || scene.routeDeckBrowserLoading || scene.routeDeckBrowserFailed),
            loaded: Boolean(scene.routeDeckBrowserModule),
            failed: scene.routeDeckBrowserFailed,
          },
          total: scene.allMapDeckCards().length,
          visible: visibleDeckCards.length,
          filter: scene.deckReviewFilter,
          filterLabel: scene.deckReviewFilterLabel(),
          sort: scene.deckReviewSort,
          sortLabel: scene.deckReviewSortLabel(),
          query: scene.deckReviewQuery,
          searchActive: scene.deckReviewSearchActive,
          selectedCardId: selectedDeckEntry?.card.id ?? '',
          reading: scene.children.getByName('deck-review-detail-panel')?.getData('reading'),
          scroll: scene.cardReviewScroll,
          comparison: deckComparison
            ? {
                active: deckComparison.active,
                mode: deckComparison.mode,
                summary: deckComparison.summary,
                reading: scene.children.getByName('deck-review-comparison-panel')?.getData('reading'),
                renderer: {
                  requested: Boolean(scene.cardComparisonModule || scene.cardComparisonLoading || scene.cardComparisonFailed),
                  loaded: Boolean(scene.cardComparisonModule),
                  failed: scene.cardComparisonFailed,
                },
                pinned: {
                  id: deckComparison.pinned.id,
                  name: displayName(deckComparison.pinned),
                  cost: deckComparison.pinned.cost,
                  role: deckComparison.pinnedContract.role,
                  target: deckComparison.pinnedContract.target,
                  stats: deckComparison.mode === 'preen'
                    ? cardStatTotalRows(deckComparison.pinned)
                    : cardStatRows(deckComparison.pinned),
                },
                selected: {
                  id: deckComparison.selected.id,
                  name: displayName(deckComparison.selected),
                  cost: deckComparison.selected.cost,
                  role: deckComparison.selectedContract.role,
                  target: deckComparison.selectedContract.target,
                  stats: deckComparison.mode === 'preen'
                    ? cardStatTotalRows(deckComparison.selected)
                    : cardStatRows(deckComparison.selected),
                },
              }
            : {
                active: false,
                renderer: {
                  requested: false,
                  loaded: Boolean(scene.cardComparisonModule),
                  failed: scene.cardComparisonFailed,
                },
                pinned: undefined,
                selected: selectedDeckEntry
                  ? {
                      id: selectedDeckEntry.card.id,
                      name: displayName(selectedDeckEntry.card),
                    }
                  : undefined,
              },
          controls: {
            cards: 'Up / Down',
            filter: `${controlBindingLabel('previous')} / ${controlBindingLabel('next')}`,
            sort: controlBindingLabel('confirm'),
            compare: 'C',
            compareController: 'X',
            compareAction: 'Pin card / pin selected card for Base versus Preened',
            find: '/',
            close: controlBindingLabel('back'),
          },
          cards: visibleDeckCards.map(({ card }: any) => ({
            id: card.id,
            name: displayName(card),
            cost: card.cost,
            suit: card.runtime.suit ?? 'special',
            upgraded: card.upgraded,
          })),
        },
        flockOverlayOpen: scene.flockOverlayOpen,
        flockStatsReading: scene.flockOverlayOpen ? scene.children.getByName('flock-stats-reader')?.getData('summary') : undefined,
        confirmExitOpen: scene.confirmExitOpen,
        flockStatsFlourish: {
          loaded: scene.textures.exists(uiIconAssets['flock-stats-flourish'].key),
          rendered: scene.children.list.some((child: any) => child.texture?.key === uiIconAssets['flock-stats-flourish'].key),
          count: scene.children.list.filter((child: any) => child.texture?.key === uiIconAssets['flock-stats-flourish'].key).length
        },
        flockStatsTitlePlaque: {
          loaded: scene.textures.exists(uiIconAssets['flock-stats-title-plaque'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['flock-stats-title-plaque'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['flock-stats-title-plaque'].key)
        },
        flockStatsCaptionFrame: {
          loaded: scene.textures.exists(uiIconAssets['flock-stats-caption-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['flock-stats-caption-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['flock-stats-caption-frame'].key)
        },
        flockStatsFooterFrame: {
          loaded: scene.textures.exists(uiIconAssets['flock-stats-footer-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['flock-stats-footer-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['flock-stats-footer-frame'].key)
        },
        flockStatsHeaderFrame: {
          loaded: scene.textures.exists(uiIconAssets['flock-stats-header-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['flock-stats-header-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['flock-stats-header-frame'].key)
        },
        flockStatsRowFrame: {
          loaded: scene.textures.exists(uiIconAssets['flock-stats-row-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['flock-stats-row-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['flock-stats-row-frame'].key)
        },
        deckReviewScrollButtonFrame: {
          loaded: scene.textures.exists(uiIconAssets['deck-review-scroll-button-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['deck-review-scroll-button-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['deck-review-scroll-button-frame'].key)
        },
        deckReviewRowFrame: iconState('deck-review-row-frame'),
        deckReviewPageIndicatorFrame: {
          loaded: scene.textures.exists(uiIconAssets['deck-review-page-indicator-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['deck-review-page-indicator-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['deck-review-page-indicator-frame'].key)
        },
        deckReviewTitlePlaque: {
          loaded: scene.textures.exists(uiIconAssets['deck-review-title-plaque'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['deck-review-title-plaque'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['deck-review-title-plaque'].key)
        },
        deckReviewDetailFrame: iconState('deck-review-detail-frame'),
        deckReviewCostBadge: {
          loaded: scene.textures.exists(uiIconAssets['deck-review-cost-badge'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['deck-review-cost-badge'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['deck-review-cost-badge'].key)
        },
        deckReviewMetaChipFrame: iconState('deck-review-meta-chip-frame'),
        deckReviewSectionTabFrame: {
          loaded: scene.textures.exists(uiIconAssets['deck-review-section-tab-frame'].key),
          rendered: countTextureInGameObjects(scene.children.list, uiIconAssets['deck-review-section-tab-frame'].key) > 0,
          count: countTextureInGameObjects(scene.children.list, uiIconAssets['deck-review-section-tab-frame'].key)
        },
        cardHoverDossierFrame: {
          loaded: scene.textures.exists(uiIconAssets['card-hover-dossier-frame'].key),
          rendered: countTextureInGameObjects(scene.hoverCardDetail?.list ?? [], uiIconAssets['card-hover-dossier-frame'].key) > 0,
          count: countTextureInGameObjects(scene.hoverCardDetail?.list ?? [], uiIconAssets['card-hover-dossier-frame'].key)
        },
        cardHoverStatChipFrame: {
          loaded: scene.textures.exists(uiIconAssets['card-hover-stat-chip-frame'].key),
          rendered: countTextureInGameObjects(scene.hoverCardDetail?.list ?? [], uiIconAssets['card-hover-stat-chip-frame'].key) > 0,
          count: countTextureInGameObjects(scene.hoverCardDetail?.list ?? [], uiIconAssets['card-hover-stat-chip-frame'].key)
        },
        marketItemDetailFrame: {
          loaded: scene.textures.exists(uiIconAssets['market-detail-dossier-frame'].key),
          rendered: countTextureInGameObjects(scene.marketItemHover?.list ?? [], uiIconAssets['market-detail-dossier-frame'].key) > 0,
          count: countTextureInGameObjects(scene.marketItemHover?.list ?? [], uiIconAssets['market-detail-dossier-frame'].key)
        },
        waymarkDrawerOpen: scene.waymarkDrawerOpen,
          waymarkReview: {
            reading: scene.children.getByName('route-waymark-review-panel')?.getData('reading'),
          open: scene.waymarkDrawerOpen,
          count: ownedWaymarks.length,
          selectedIndex: selectedWaymark
            ? Math.max(0, ownedWaymarks.findIndex((mark: any) => mark.id === selectedWaymark.id))
            : -1,
          scrollRow: scene.routeWaymarkScroll,
          comparing: Boolean(selectedWaymark && pinnedWaymark && selectedWaymark.id !== pinnedWaymark.id),
          selected: selectedWaymark ? scene.routeWaymarkTextEntry(selectedWaymark) : undefined,
          pinned: pinnedWaymark ? scene.routeWaymarkTextEntry(pinnedWaymark) : undefined,
          renderer: {
            requested: Boolean(scene.waymarkReviewModule || scene.waymarkReviewLoading || scene.waymarkReviewFailed),
            loaded: Boolean(scene.waymarkReviewModule),
            failed: scene.waymarkReviewFailed,
          },
          controls: {
            select: 'Arrow keys / Tab / pointer',
              pin: controlBindingLabel('roost'),
            pinController: 'X',
            close: controlBindingLabel('back'),
          },
        },
        supplyDrawerOpen: scene.supplyDrawerOpen,
        supplyDrawer: {
          open: scene.supplyDrawerOpen,
          reading: scene.supplyDrawerOpen ? scene.routeSupplyDrawerModule?.supplyDrawerReading(scene) : undefined,
          focusIndex: scene.supplyDrawerFocusIndex,
          inputActive: scene.supplyDrawerInputActive,
          armedIndex: scene.supplyDrawerArmedIndex,
          entries: Array.from({ length: runSupplyCapacity(scene.runState) }, (_entry, index) => {
            const supply = alphaSupplyLibrary.get(scene.runState.supplies[index] ?? '');
            return supply
              ? {
                  id: supply.id,
                  name: supply.name,
                  description: supply.description,
                    summary: compactEffectGrammar(supply.effects, 96, 3),
                    rules: formatEffects(supply.effects),
                  timing: supply.timing,
                  usable: supply.timing !== 'combat',
                }
              : { empty: true, usable: false };
          }),
          renderer: {
            requested: Boolean(scene.routeSupplyDrawerModule || scene.routeSupplyDrawerLoading || scene.routeSupplyDrawerFailed),
            loaded: Boolean(scene.routeSupplyDrawerModule),
            failed: scene.routeSupplyDrawerFailed,
          },
          controls: {
            open: `${controlBindingLabel('skipReward')} / controller X`,
            select: 'Previous / Next / Arrow keys / Tab / D-pad / pointer',
            confirm: `${controlBindingLabel('confirm')} / controller A / second tap`,
            read: `${controlBindingLabel('roost')} / controller Y / Read more`,
            close: `${controlBindingLabel('back')} / controller B`,
          },
        },
        routeRewardRenderer: {
          requested: Boolean(scene.routeRewardOverlayModule || scene.routeRewardOverlayLoading || scene.routeRewardOverlayFailed),
          loaded: Boolean(scene.routeRewardOverlayModule),
          failed: scene.routeRewardOverlayFailed,
        },
        marketOpen: scene.marketOpen,
        pauseOverlayOpen: scene.pauseOverlayOpen,
        settingsOverlayOpen: scene.settingsOverlayOpen,
        settingsFocus: settingsFocusState(scene, scene.settingsOverlayOpen),
        controls: controlsTextState(scene, scene.settingsOverlayOpen),
        market: scene.marketOpen
          ? {
              category: scene.marketCategory,
              scrap: scene.runState.scrap,
              cardOffer: scene.marketCardOffer()?.id ?? '',
              cardOffers: scene.marketCardShelf.map((offer: any) => ({ id: offer.id, price: offer.price, sold: !!offer.sold })),
              routeMarkOffer: scene.marketRouteMarkOffer()?.id ?? '',
              routeMarkOffers: scene.marketWaymarkShelf.map((offer: any) => ({ id: offer.id, price: offer.price, sold: !!offer.sold })),
              preenOffer: scene.marketPreenCandidate()?.id ?? '',
              utilityOffers: scene.marketUtilityShelf.map((offer: any) => ({
                id: offer.id,
                price: offer.price,
                supplyId: offer.supplyId ?? '',
                sold: !!offer.sold
              })),
              refreshCost: scene.marketRefreshCost(),
              refreshCount: scene.marketRefreshCount,
              unavailableOffers: scene.cardHoverDetailModule?.marketUnavailableOffers(scene) ?? [],
              decisionPreview: [...scene.marketDecisionPreview],
              previewCard: scene.cardHoverDetailRequest?.marketCardId ? scene.cardHoverDetailRequest.name : undefined,
              rules: scene.cardHoverDetailRequest?.marketRules ?? scene.marketItemHover?.getData('reading'),
              message: scene.marketMessage,
              input: (() => {
                const targets = scene.children.list.filter((child: any) => (
                  child.input?.enabled && typeof child.getData?.('marketFocusId') === 'string'
                ));
                const focused = targets.find((child: any) => (
                  child.getData('marketFocusId') === scene.marketFocusId
                ));
                return {
                  focusId: focused?.getData('marketFocusId') ?? '',
                  label: focused?.getData('label') ?? '',
                  index: focused ? targets.indexOf(focused) : -1,
                  count: targets.length,
                  available: !!focused && focused.getData('marketAvailable') !== false,
                  armed: !!focused && scene.marketFocusArmedId === focused.getData('marketFocusId'),
                  observations: scene.marketBuildObservations,
                  focusVisible: scene.children.list.some((child: any) => (
                    child.name === 'market-input-focus-ring' && child.visible
                  )),
                  routeCommitBlocked: true,
                  controls: {
                    choose: 'Previous / Next / D-pad / tap',
                    buy: 'Confirm / A / second activation',
                    categories: '1-4 / LB / RB / pointer',
                    close: 'Back / B / pointer',
                  },
                };
              })(),
              offerTray: scene.marketOfferTrayState(),
              priceChipFrame: scene.marketPriceChipFrameState(),
              serviceButtonFrame: scene.marketServiceButtonFrameState(),
              itemLabelFrame: scene.marketItemLabelFrameState(),
              cardPriceTagFrame: scene.marketCardPriceTagFrameState(),
              objectBackplateFrame: scene.marketObjectBackplateFrameState(),
              sectionHeaderFrame: scene.marketSectionHeaderFrameState(),
              purchaseFlourish: scene.marketPurchaseFlourishState(),
              backdropAssetKey: marketBackdrop?.key ?? ''
          }
          : undefined,
        nodeChoice: scene.nodeChoiceOpen && choiceNode
          ? {
              nodeId: choiceNode.id,
              focus: { ...eventChoiceState(scene) },
              choices: scene.eventChoices().map((choice: any) => ({ ...choice,
                summary: scene.eventChoiceSections(choice)[0]?.text })),
              type: choiceNode.type,
              backdropAssetKey: choiceBackdrop?.key ?? '',
              titlePlaque: scene.routeEventTitlePlaqueState(),
              choiceFrame: scene.routeChoiceDecisionFrameState(),
              optionFrame: scene.routeChoiceOptionFrameState(),
              detailFrame: scene.routeChoiceDetailFrameState(),
              previewRowFrame: scene.routeChoicePreviewRowFrameState()
          }
          : undefined,
        routeReward: scene.pendingRouteReward
          ? {
              nodeId: scene.pendingRouteReward.nodeId,
              nodeType: scene.pendingRouteReward.nodeType,
              choiceKey: scene.pendingRouteReward.choiceKey,
              renderer: {
                requested: scene.routeRewardOverlayLoading || Boolean(scene.routeRewardOverlayModule) || scene.routeRewardOverlayFailed,
                loaded: Boolean(scene.routeRewardOverlayModule),
                failed: scene.routeRewardOverlayFailed,
              },
              decisionPreview: [...(scene.pendingRouteReward.decisionPreview ?? [])],
              ...rewardChoices,
              inspection: {
                open: Boolean(scene.routeRewardInspectionCardId),
                reading: scene.routeRewardInspectionCardId ? scene.cardHoverDetailRequest?.inspectionRules : undefined,
                cardId: scene.routeRewardInspectionCardId,
                cardName: scene.routeRewardInspectionCardId
                  ? scene.routeCardRewardChoices.find((card: any) => card.id === scene.routeRewardInspectionCardId)?.name
                  : undefined,
                cost: scene.routeRewardInspectionCardId
                  ? scene.routeCardRewardChoices.find((card: any) => card.id === scene.routeRewardInspectionCardId)?.cost
                  : undefined,
                returnIndex: scene.routeRewardChoiceIndex,
                returnArmed: Boolean(scene.routeRewardArmedCardId),
                returnChoiceId: scene.routeRewardArmedCardId,
                selectActionPreserved: true,
              },
              previewItem: scene.pendingRouteReward.previewItem ? { ...scene.pendingRouteReward.previewItem } : undefined,
              previewCards: (scene.pendingRouteReward.previewCards ?? []).map((card: any) => card.id),
            }
          : undefined,
        bossPrep: scene.bossPrepReadiness(),
        districtContract: scene.districtContractProgress(),
        districtContractCelebration: scene.districtContractCelebration
          ? {
              id: scene.districtContractCelebration.id,
              name: scene.districtContractCelebration.name,
              rewardScrap: scene.districtContractCelebration.rewardScrap,
              remainingMs: Math.max(0, scene.districtContractCelebration.expiresAt - Date.now()),
              rendered: scene.children.list.some((child: any) => child.name === 'district-contract-celebration'),
            }
          : undefined,
        districtContractChoice: scene.shouldChooseDistrictContract()
          ? { open: true, options: scene.districtContractChoices().map((choice: any) => ({ ...choice })) }
          : { open: false, options: [] },
        flywayRestoration: {
          ...scene.flywayRestorationProgress(),
          rendered: scene.children.list.some((child: any) => child.name === 'flyway-restoration')
        },
        firstRouteGuidance: {
          active: scene.isFirstRouteDecision() || firstFlightGuideStep() === 'route',
          rendered: scene.children.list.some((child: any) => child.name === 'first-route-guidance')
        },
        firstFlightGuide: firstFlightGuideState(),
        selectedNodeId: scene.selectedNodeId ?? '',
        inspectedCard: inspected,
        selectableNodeIds: [...scene.selectableNodeIds],
        nodes: currentMap().nodes.map((node: any) => ({
          position: scene.nodePosition(node),
          visualBounds: scene.nodeVisualBounds(node),
          id: node.id,
          label: node.label,
          type: node.type,
          risk: node.risk,
          column: node.column,
          lane: node.lane,
          completed: scene.runState.completedRouteNodeIds.includes(node.id),
          current: scene.runState.currentRouteNodeId === node.id,
          selectable: scene.selectableNodeIds.has(node.id),
          decision: scene.nodeDecisionSummary(node),
          rewardBadges: scene.routeRewardBadges(node).map((badge: any) => badge.id)
        })),
        log: scene.runState.routeLog.slice(-5)
      });
}
