import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, memoryStorageSessionActive, TOKEN_DISPLAY_FONT, UI_BOLD, currentMap, fitTextExcerpt, UI_FONT, UI_SOFT, uiIconAssets, activeSeed, runMapIndices, runDistrictOrdinal, activeMapIndex, UI_MUTED, prefersReducedMotion, UI_FIELD, addUiIconImage, UiIconId, UI_GOLD, leaderMastery, loadAccount, defaultLeaderId, getLeader, difficultyLabel } from '../../main';
import type { BattleScene, RenderPayload } from '../../main';

// Typed access contract for the scene's deferred presentation adapter.
type SceneAccess = Phaser.Scene & {
  queueBattleRewardUiLoad: BattleScene['queueBattleRewardUiLoad'];
  mode: BattleScene['mode'];
  bossDossierModule: BattleScene['bossDossierModule'];
  enemies: BattleScene['enemies'];
  root: BattleScene['root'];
  add: BattleScene['add'];
  outcomeUnlockHighlights: BattleScene['outcomeUnlockHighlights'];
  textures: BattleScene['textures'];
  runMode: BattleScene['runMode'];
  battleInputActive: BattleScene['battleInputActive'];
  outcomeDetailsOpen: BattleScene['outcomeDetailsOpen'];
  outcomeInputActions: BattleScene['outcomeInputActions'];
  controllerChoiceIndex: BattleScene['controllerChoiceIndex'];
  statTaken: BattleScene['statTaken'];
  statDealt: BattleScene['statDealt'];
  runCombatResults: BattleScene['runCombatResults'];
  completedRouteNodeIds: BattleScene['completedRouteNodeIds'];
  outcomeActions: BattleScene['outcomeActions'];
  normalizeCombatChoiceIndex: BattleScene['normalizeCombatChoiceIndex'];
  lastRunRewards: BattleScene['lastRunRewards'];
  runLeaderId: BattleScene['runLeaderId'];
  outcomeBossDossierGoal: BattleScene['outcomeBossDossierGoal'];
  outcomeCardDiscoveryGoal: BattleScene['outcomeCardDiscoveryGoal'];
  outcomeFxPlayed: BattleScene['outcomeFxPlayed'];
  pulseRing: BattleScene['pulseRing'];
  fxMoteBurst: BattleScene['fxMoteBurst'];
  playFxAnimation: BattleScene['playFxAnimation'];
  outcomeFlightDetails: BattleScene['outcomeFlightDetails'];
  closeOutcomeFlightDetails: BattleScene['closeOutcomeFlightDetails'];
};

export function renderOutcomeScene(raw: BattleScene) {
    const scene = raw as unknown as SceneAccess;
    scene.queueBattleRewardUiLoad();
    const win = scene.mode === 'runComplete';
    const summary = window.__birdSquadLastRun;
    const defeatReview = win ? undefined : scene.bossDossierModule?.buildDefeatReview(summary);
    const killedBy = win
      ? ''
      : defeatReview?.fatalMove ?? summary?.killedBy ?? scene.enemies.find((enemy) => enemy.hp > 0)?.name ?? '';
    const cx = GAME_WIDTH / 2;
    const accent = win ? 0xe8b830 : 0xff7a6e;
    const softAccent = win ? 0x8df4ff : 0xff9d6b;
    const panelW = 760;
    const panelH = 570;
    const panelY = 382;
    const panelLeft = cx - panelW / 2;
    const panelTop = panelY - panelH / 2;
    const statLabelX = cx - 88;
    const statValueX = cx + 330;
    scene.root.add(scene.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.82));
    const reportFrameLoaded = false;
    scene.root.add(scene.add.rectangle(cx, panelY, panelW, panelH, 0x0d1420, 0.98)
      .setStrokeStyle(1, 0x7795ab, 0.28).setName('run-outcome-surface'));
    scene.root.add(scene.add.rectangle(cx, panelTop + 24, panelW - 64, 2, accent, 0.65));
    const unlockHighlights = scene.outcomeUnlockHighlights();
    const hasUnlocks = unlockHighlights.length > 0;
    scene.root.add(scene.add.text(cx, 170, memoryStorageSessionActive() ? 'Practice Complete' : win ? 'Run Complete' : 'Flock Scattered', {
      fontFamily: TOKEN_DISPLAY_FONT, fontSize: '36px', fontStyle: UI_BOLD,
      color: win ? '#ffe1a3' : '#ffb2a4'
    }).setOrigin(0.5).setResolution(2));
    const outcomeSubtitle = memoryStorageSessionActive()
      ? 'Nothing saved. Your active flight, collection, and records are unchanged.' : win
      ? 'The flyway is restored - every district answers to the flock.'
      : `Scattered at ${currentMap().name}${killedBy ? `. Last hit: ${killedBy}` : ''}.`;
    scene.root.add(fitTextExcerpt(scene.add.text(cx, 212, '', {
      fontFamily: UI_FONT, fontSize: '18px', color: UI_SOFT, align: 'center', wordWrap: { width: 680, useAdvancedWrap: true }
    }).setOrigin(0.5).setName('run-outcome-subtitle'), outcomeSubtitle, 2));

    const crestKey = uiIconAssets['run-outcome-crest'].key;
    if (scene.textures.exists(crestKey)) {
      const crest = scene.add.image(panelLeft + 126, 342, crestKey)
        .setDisplaySize(144, 144)
        .setAlpha(win ? 0.98 : 0.78);
      if (!win) crest.setTint(0xffb2a4);
      scene.root.add(crest);
    }

    scene.bossDossierModule?.renderOutcomeFlightSummary(scene, scene.root, {
      x: panelLeft + 126,
      win,
      review: defeatReview,
      seed: activeSeed,
      runMode: scene.runMode,
      reportFrameLoaded,
      softAccent,
      fontFamily: UI_FONT,
      boldStyle: UI_BOLD,
      softColor: UI_SOFT,
      focused: scene.battleInputActive && !scene.outcomeDetailsOpen
        && scene.outcomeInputActions()[scene.controllerChoiceIndex]?.id === 'copy',
    });

    // Recap stats, drawn from the same run state RunSummary captures.
    const runDistrictCount = runMapIndices(scene.runMode).length;
    const districts = win ? runDistrictCount : runDistrictOrdinal(scene.runMode, activeMapIndex);
    const totalTaken = summary?.combatResults.reduce((sum, combat) => sum + combat.cohesionLost, 0) ?? scene.statTaken;
    const totalDealt = summary?.combatResults.reduce((sum, combat) => sum + combat.damageDealt, 0) ?? scene.statDealt;
    const stats: Array<[string, string]> = [
      ['Districts', `${districts} / ${runDistrictCount}`],
      ['Encounters cleared', `${(summary?.combatResults ?? scene.runCombatResults).filter(combat => scene.completedRouteNodeIds.includes(combat.nodeId)).length}`],
      ['Damage dealt / taken', `${totalDealt} / ${totalTaken}`],
    ];
    const statFrameKey = uiIconAssets['run-outcome-stat-row-frame'].key;
    scene.bossDossierModule?.renderOutcomeStats(scene, scene.root, stats, {
      labelX: statLabelX,
      valueX: statValueX,
      hasUnlocks,
      reportFrameLoaded,
      softAccent,
      win,
      rowFrameKey: statFrameKey,
      fontFamily: UI_FONT,
      boldStyle: UI_BOLD,
      mutedColor: UI_MUTED
    });


    if (hasUnlocks) scene.bossDossierModule?.renderOutcomeUnlockStrip(
      scene,
      scene.root,
      unlockHighlights,
      panelLeft + 286,
      270,
      438,
      win,
      {
        flourishKey: uiIconAssets['progression-unlock-flourish'].key,
        reducedMotion: prefersReducedMotion(),
        fontFamily: UI_FONT,
        boldStyle: UI_BOLD,
        brass: UI_FIELD.brass,
        cyan: UI_FIELD.cyan,
        addIcon: (x, y) => addUiIconImage(scene, 'unlock-badge', x, y, 42)
      }
    );

    const commandFrameKey = uiIconAssets['run-outcome-command-frame'].key;
    const addCommandIcon = (id: string, x: number, y: number) => addUiIconImage(scene, id as UiIconId, x, y, 18);
    const outcomeActions = scene.outcomeActions();
    const outcomeIndex = scene.normalizeCombatChoiceIndex();
    const compactCommands = outcomeActions.length > 2;
    const commandSpacing = outcomeActions.length > 4 ? 184 : outcomeActions.length > 3 ? 214 : compactCommands ? 232 : 280;
    const commandWidth = outcomeActions.length > 4 ? 174 : outcomeActions.length > 3 ? 190 : compactCommands ? 210 : 256;
    outcomeActions.forEach((action, index) => {
      const x = cx + (index - (outcomeActions.length - 1) / 2) * commandSpacing;
      const style = action.id === 'replay'
        ? {
            labelColor: UI_GOLD,
            iconId: 'route-pin',
            baseFill: 0x122235,
            hoverFill: 0x183451,
            stroke: 0xd8a840,
            frameTint: win ? undefined : 0xffb195,
          }
        : action.id === 'details'
          ? {
              labelColor: '#dffbff',
              iconId: 'release-card',
              baseFill: 0x0b2530,
              hoverFill: 0x123b4b,
              stroke: 0x8df4ff,
              frameTint: 0xcfefff,
            }
        : action.id === 'rate'
          ? {
              labelColor: '#dffbff',
              iconId: 'unlock-badge',
              baseFill: 0x0d2730,
              hoverFill: 0x164251,
              stroke: 0x8df4ff,
              frameTint: 0xcfefff,
            }
          : {
              labelColor: '#dbe6f0',
              iconId: 'back-chevron',
              baseFill: 0x141d2b,
              hoverFill: 0x1b2d42,
              stroke: 0x7ab8d6,
              frameTint: win ? 0xcfefff : 0xffb195,
            };
      scene.bossDossierModule?.renderOutcomeCommand(scene, scene.root, {
        x,
        textX: x + (compactCommands ? 14 : 22),
        label: action.label,
        labelColor: style.labelColor,
        iconId: style.iconId,
        iconX: x - commandWidth / 2 + (compactCommands ? 34 : 32),
        baseFill: style.baseFill,
        hoverFill: style.hoverFill,
        stroke: style.stroke,
        frameTint: style.frameTint,
        frameKey: commandFrameKey,
        fontFamily: UI_FONT,
        boldStyle: UI_BOLD,
        width: commandWidth,
        fontSize: outcomeActions.length > 3 ? 15 : compactCommands ? 17 : 20,
        focused: scene.battleInputActive && outcomeIndex === index,
        onActivate: action.activate,
        addIcon: addCommandIcon,
      });
    });

    const mastery = leaderMastery(scene.lastRunRewards?.account ?? loadAccount(), scene.runLeaderId ?? defaultLeaderId);
    const dossierGoal = scene.outcomeBossDossierGoal();
    const collectionGoal = scene.outcomeCardDiscoveryGoal();
    const nextFlightGoal = dossierGoal
      ? `${dossierGoal.name} DOSSIER  /  Witness ${dossierGoal.remaining} more tactic${dossierGoal.remaining === 1 ? '' : 's'}`
      : collectionGoal
        ? collectionGoal.label
      : `${mastery.title}  /  ${mastery.nextGoal} (${mastery.current}/${mastery.target})`;
    scene.bossDossierModule?.renderOutcomeNextGoal(scene, scene.root, nextFlightGoal, UI_FONT);

    if (scene.outcomeFxPlayed !== scene.mode && scene.bossDossierModule) {
      scene.outcomeFxPlayed = scene.mode;
      scene.bossDossierModule?.playOutcomeRevealFx({
        win,
        color: softAccent,
        hasUnlocks,
        reducedMotion: prefersReducedMotion(),
        pulseRing: (x, y, fxColor, radius, duration) => scene.pulseRing(x, y, fxColor, radius, duration),
        moteBurst: (x, y, fxColor, config) => scene.fxMoteBurst(x, y, fxColor, config as Parameters<typeof scene.fxMoteBurst>[3]),
        playAnimation: (key, x, y, config) => scene.playFxAnimation(key, x, y, config as Parameters<typeof scene.playFxAnimation>[3])
      });
    }
    const flightDetails = scene.outcomeDetailsOpen ? scene.outcomeFlightDetails() : undefined;
    if (flightDetails && scene.bossDossierModule) {
      scene.bossDossierModule.renderOutcomeFlightDetails(scene, scene.root, flightDetails, {
        title: 'Flight Details',
        identity: summary ?? flightDetails,
        subtitle: `${summary?.result === 'win' ? 'Completed' : 'Scattered'} flight ${summary?.seed ?? activeSeed} · ${getLeader(summary?.leaderId).name} · ${difficultyLabel(summary?.difficulty ?? 0)}`,
        fontFamily: UI_FONT,
        boldStyle: UI_BOLD,
        focused: scene.battleInputActive,
        onClose: () => scene.closeOutcomeFlightDetails(),
      });
    }
  }
