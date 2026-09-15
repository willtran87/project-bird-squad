import Phaser from 'phaser';
import {
  currentMap,
  displayName,
  GAME_HEIGHT,
  GAME_WIDTH,
  playUiSound,
  renderFieldPanel,
  ROUTE_SET_PIECE_PROFILES,
  routeNodeTypeLabel,
  suitAccentColor,
  UI_BOLD,
  UI_CYAN,
  UI_FIELD,
  UI_FONT,
  UI_GOLD,
} from '../main';
import { DECISION_UI, MIN_SUPPORTED_TOUCH_TARGET } from './theme';
import { decisionButton, decisionExcerpt, decisionText } from './decision-surface';
import { openOutcomeInspection, renderOutcomeInspectButton, renderOutcomeShowcase, renderSupplyInspection, supplyInspectionState } from './route-supply-reader';
import { renderRouteRewardBuildRead, renderRouteRewardEffectShowcase, renderRouteRewardInspection, renderRouteSupplyRewardChoices } from './reward-card-inspection';
import { bindChoiceHint, choiceInputHint } from './choice-input-hints';

export {
  cardPickerDecisionDelta,
  closeRouteRewardInspection,
  cycleRouteRewardChoice,
  focusedRouteRewardCard,
  handleRouteRewardAction,
  openRouteRewardInspection,
  requestCardPick,
  requestRouteRewardCard,
  routeRewardChoiceDebugState,
  setRouteRewardChoice,
  updateRouteRewardGamepad,
} from './reward-card-inspection';

export function renderRouteRewardOverlay(scene: any) {
  const pending = scene.pendingRouteReward;
  if (!pending) return;
  const node = currentMap().nodes.find((candidate) => candidate.id === pending.nodeId);
  const accent = pending.accent;
  const hasCardChoices = scene.routeCardRewardChoices.length > 0;
  const hasSupplyChoices = scene.routeSupplyRewardChoices.length > 1;
  const isDecline = pending.effects.length === 0;
  if (hasCardChoices || pending.previewCards?.length) scene.queueRouteRewardCardArtLoad();
  if (pending.previewItem) scene.queueRouteRewardItemArtLoad();
  scene.renderRouteEventBackdrop(node, 0.86);
  if (node) scene.renderRouteEventAtmosphere(node, accent);
  const profile = ROUTE_SET_PIECE_PROFILES[pending.nodeType as keyof typeof ROUTE_SET_PIECE_PROFILES];
  const confirmName = profile?.residentName?.split(' ')[0] ?? routeNodeTypeLabel(pending.nodeType);
  const frame = renderFieldPanel(scene, () => {}, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8, 940, 558, {
    eyebrow: node ? routeNodeTypeLabel(node.type) : 'Route Reward',
    title: hasCardChoices ? 'Choose a Reward' : hasSupplyChoices ? 'Choose a Supply' : isDecline ? `Leave ${routeNodeTypeLabel(pending.nodeType)}` : pending.nodeType === 'cache' ? 'Open This Drawer' : 'Review This Choice',
    subtitle: hasCardChoices
      ? `Pick one card from this ${routeNodeTypeLabel(pending.nodeType).toLowerCase()}, inspect before claiming, or cancel back to ${confirmName}.`
      : hasSupplyChoices
        ? `Pack one of these two Supplies. Select it, confirm again to commit, or cancel back to ${confirmName}.`
      : isDecline
        ? `Leave without taking a reward, or cancel back to ${confirmName}.`
        : `Confirm this choice, or cancel back to ${confirmName}.`,
    accent,
    fill: 0x07101a
  });
  const left = frame.left + 54;
  decisionExcerpt(decisionText(scene, left, frame.top + 112, pending.choiceText, 326, 20, UI_GOLD), 52).setName('route-decision-choice');
  decisionExcerpt(decisionText(scene, left, frame.top + 175, pending.effectText || 'No reward will be taken.', 326, 18), 68).setName('route-decision-summary');
  decisionText(scene, left, frame.top + 254, 'PROJECTED CHANGES', 326, 16, DECISION_UI.secondary);
  const rows = pending.decisionPreview?.length ? pending.decisionPreview : ['No state change'];
  const visibleCount = hasCardChoices ? 1 : 4;
  rows.slice(0, visibleCount).forEach((row: string, index: number) => {
    const y = frame.top + 285 + index * 44;
    decisionExcerpt(decisionText(scene, left, y, row.replace(/ > /g, ' → '), 326, 18), hasCardChoices ? 24 : 40).setName('route-decision-row');
    scene.add.rectangle(left + 163, y + (hasCardChoices ? 26 : 41), 326, 1, DECISION_UI.border, 0.4).setName('route-decision-divider');
  });
  if (rows.length > visibleCount) decisionText(scene, left, frame.top + (hasCardChoices ? 312 : 455), `+${rows.length - visibleCount} more in ${hasCardChoices || hasSupplyChoices ? 'Details' : 'Inspect outcome'}`, 326, 16, DECISION_UI.secondary);
  renderRouteRewardBuildRead(scene, frame);
  if (hasCardChoices || hasSupplyChoices) decisionButton(scene, frame.left + 304, frame.bottom - 48, 166, 'Details', 'route-decision-inspect-hit', () => openOutcomeInspection(scene, true));
  scene.add.rectangle(frame.left + 408, frame.cy + 14, 2, 396, accent, 0.36);
  if (!hasCardChoices) {
    const panelX = frame.left + 672;
    const panelY = frame.top + 326;
    if (hasSupplyChoices) {
      renderRouteSupplyRewardChoices(scene, panelX, panelY + 2);
    } else if (!pending.previewItem || !renderOutcomeShowcase(scene, panelX, panelY)) {
      renderRouteRewardEffectShowcase(scene, pending, panelX, panelY, 410, 238);
    }
    if (!hasSupplyChoices) {
      renderOutcomeInspectButton(scene, panelX, panelY);
      const claim = scene.add.rectangle(frame.right - 158, frame.bottom - 48, 180, MIN_SUPPORTED_TOUCH_TARGET, DECISION_UI.raised, 1)
      .setStrokeStyle(2, accent, 0.92);
      const claimHit = scene.add.rectangle(frame.right - 158, frame.bottom - 48, 180, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('route-reward-claim-hit');
      claimHit.on('pointerover', () => claim.setFillStyle(0x18314a, 1));
      claimHit.on('pointerout', () => claim.setFillStyle(0x102235, 0.98));
      claimHit.on('pointerdown', () => {
        if (supplyInspectionState(scene) || scene.pauseOverlayOpen || scene.settingsOverlayOpen) return;
        playUiSound('confirm');
        scene.claimRouteReward();
      });
      const claimLabel = isDecline ? 'Leave' : pending.nodeType === 'cache' ? 'Claim' : 'Confirm';
      scene.add.text(frame.right - 158, frame.bottom - 60, claimLabel, {
        fontFamily: UI_FONT,
        fontSize: '18px',
        fontStyle: UI_BOLD,
        color: UI_GOLD,
        align: 'center',
        fixedWidth: 150
      }).setOrigin(0.5, 0).setResolution(2);
    }
  }
  scene.routeCardRewardChoices.forEach((card: any, index: number) => {
    const cardW = 148;
    const cardH = 222;
    const x = frame.left + 540 + index * 190;
    const y = frame.top + 312;
    const armed = scene.routeRewardArmedCardId === card.id;
    const accentColor = card.type === 'major' ? UI_FIELD.gold : card.type === 'molt' ? 0xc56cff : suitAccentColor(card);
    scene.renderRouteRewardCardOption(card, x, y, cardW, cardH, accentColor);
    if (index === scene.routeRewardChoiceIndex) {
      scene.add.rectangle(x, y + 8, cardW + 30, cardH + 88, 0x000000, 0)
        .setStrokeStyle(4, armed ? UI_FIELD.gold : UI_FIELD.cyan, 1)
        .setName('route-reward-input-focus-ring');
    }
    scene.add.rectangle(x, y + cardH / 2 + 27, cardW + 16, 48, 0x020409, 0.94)
      .setStrokeStyle(1, accentColor, 0.72);
    decisionExcerpt(decisionText(scene, x, y + cardH / 2 + 5, displayName(card), cardW, 18, UI_GOLD)
      .setOrigin(0.5, 0).setAlign('center'), 44).setName('route-reward-card-name');
    const hit = scene.add.rectangle(x, y + 8, cardW + 18, cardH + 76, 0x000000, 0.01)
      .setInteractive({ useHandCursor: true })
      .setName('route-reward-card-hit');
    hit.on('pointerdown', () => scene.requestRouteRewardCard(card.id));
    hit.on('pointerover', () => {
      if (scene.routeRewardArmedCardId) {
        scene.hideHoverCardDetail();
        return;
      }
      scene.setRouteRewardChoice(card.id);
      scene.showHoverCardDetail(card, 'Cache reward', card.cost, x, y);
    });
    hit.on('pointerout', () => scene.hideHoverCardDetail());
    const inspectY = frame.bottom - 48;
    const inspect = scene.add.rectangle(x, inspectY, 126, MIN_SUPPORTED_TOUCH_TARGET, 0x102534, 0.88)
      .setStrokeStyle(2, accentColor, 0.9)
      .setInteractive({ useHandCursor: true })
      .setName('route-reward-card-inspect-hit');
    inspect.on('pointerdown', (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event?: Phaser.Types.Input.EventData,
    ) => {
      event?.stopPropagation();
      scene.openRouteRewardInspection(card.id);
    });
    inspect.on('pointerover', () => inspect.setFillStyle(0x18384b, 1));
    inspect.on('pointerout', () => inspect.setFillStyle(0x102534, 0.88));
    scene.add.text(x, inspectY, 'INSPECT', {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: '#dffbff',
    }).setOrigin(0.5).setResolution(2).setName('route-reward-card-inspect-label');
  });
  const cancelLabel = scene.routeRewardArmedCardId || scene.routeSupplyRewardArmedId ? 'Clear pick' : 'Cancel';
  const [cancelHit] = decisionButton(scene, frame.left + 126, frame.bottom - 48, 166, cancelLabel, 'route-event-cancel-hit', () => {
    if (supplyInspectionState(scene) || scene.routeRewardInspectionCardId || scene.pauseOverlayOpen || scene.settingsOverlayOpen) return;
    playUiSound('close');
    scene.cancelRouteCardReward();
  });
  cancelHit.setData('label', cancelLabel);
  if (hasCardChoices) {
    const hintX = frame.left + 672;
    const hintY = frame.top + 116;
    const armed = !!scene.routeRewardArmedCardId;
    scene.add.rectangle(hintX, hintY, 500, 42, 0x020711, 0.86)
      .setStrokeStyle(1, armed ? UI_FIELD.gold : UI_FIELD.cyan, armed ? 0.92 : 0.55);
    bindChoiceHint(scene, scene.add.text(hintX, hintY, '', {
      fontFamily: UI_FONT,
      fontSize: '16px',
      fontStyle: UI_BOLD,
      color: armed ? '#ffe08a' : '#bfe8f4',
      fixedWidth: 476,
      align: 'center',
    }).setOrigin(0.5).setResolution(2).setName('route-reward-input-hint'), mode => choiceInputHint(mode, armed, true));
  }
  if (hasSupplyChoices) {
    bindChoiceHint(scene, scene.add.text(frame.left + 672, frame.top + 116, '', {
      fontFamily: UI_FONT,
      fontSize: '16px',
      fontStyle: UI_BOLD,
      color: scene.routeSupplyRewardArmedId ? '#ffe08a' : '#bfe8f4',
      align: 'center',
      fixedWidth: 490,
    }).setOrigin(0.5).setResolution(2).setName('route-supply-reward-input-hint'), mode => choiceInputHint(mode, Boolean(scene.routeSupplyRewardArmedId), true));
  }
  renderRouteRewardInspection(scene);
  renderSupplyInspection(scene);
}
