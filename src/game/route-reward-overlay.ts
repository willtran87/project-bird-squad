import Phaser from 'phaser';
import {
  addRewardRevealHaloFx,
  compactSentenceText,
  controlBindingLabel,
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
  UI_SOFT,
} from '../main';
import { MIN_SUPPORTED_TOUCH_TARGET } from './theme';

export {
  cardPickerDecisionDelta,
  closeRouteRewardInspection,
  cycleRouteRewardChoice,
  focusedRouteRewardCard,
  handleRouteRewardAction,
  openRouteRewardInspection,
  requestCardPick,
  requestRouteRewardCard,
  setRouteRewardChoice,
  updateRouteRewardGamepad,
} from './reward-card-inspection';

export function renderRouteRewardOverlay(scene: any) {
  const pending = scene.pendingRouteReward;
  if (!pending) return;
  const node = currentMap().nodes.find((candidate) => candidate.id === pending.nodeId);
  const accent = pending.accent;
  const hasCardChoices = scene.routeCardRewardChoices.length > 0;
  const isDecline = pending.effects.length === 0;
  if (hasCardChoices || (pending.previewCards?.length ?? 0) > 0) scene.queueRouteRewardCardArtLoad();
  if (pending.previewItem) scene.queueRouteRewardItemArtLoad();
  scene.renderRouteEventBackdrop(node, 0.86);
  if (node) scene.renderRouteEventAtmosphere(node, accent);
  const profile = ROUTE_SET_PIECE_PROFILES[pending.nodeType as keyof typeof ROUTE_SET_PIECE_PROFILES];
  const confirmName = profile?.residentName?.split(' ')[0] ?? routeNodeTypeLabel(pending.nodeType);
  const frame = renderFieldPanel(scene, () => {}, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8, 940, 558, {
    eyebrow: node ? routeNodeTypeLabel(node.type) : 'Route Reward',
    title: hasCardChoices ? 'Choose a Reward' : isDecline ? `Leave ${routeNodeTypeLabel(pending.nodeType)}` : pending.nodeType === 'cache' ? 'Open This Drawer' : 'Review This Choice',
    subtitle: hasCardChoices
      ? `Pick one card from this ${routeNodeTypeLabel(pending.nodeType).toLowerCase()}, inspect before claiming, or cancel back to ${confirmName}.`
      : isDecline
        ? `Leave without taking a reward, or cancel back to ${confirmName}.`
        : `Confirm this choice, or cancel back to ${confirmName}.`,
    accent,
    fill: 0x07101a
  });
  scene.add.rectangle(frame.cx, frame.cy, frame.w - 36, frame.h - 36, 0x020409, 0.16);
  scene.add.text(frame.left + 54, frame.top + 112, compactSentenceText(pending.choiceText, 58, 1), {
    fontFamily: UI_FONT,
    fontSize: '16px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
    fixedWidth: 360,
    fixedHeight: 42,
    wordWrap: { width: 360 },
    maxLines: 2
  });
  scene.add.text(frame.left + 54, frame.top + 164, compactSentenceText(pending.effectText || 'No reward will be taken.', 104, 1), {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: UI_SOFT,
    fixedWidth: 360,
    fixedHeight: 38,
    wordWrap: { width: 360 },
    maxLines: 2
  });
  const decisionPreview = pending.decisionPreview ?? ['NO STATE CHANGE'];
  scene.add.text(frame.left + 54, frame.top + 214, 'DECISION', {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: UI_CYAN,
    letterSpacing: 1.2,
  });
  decisionPreview.slice(0, 7).forEach((row: string, index: number) => {
    const rowY = frame.top + 244 + index * 38;
    scene.renderRouteChoicePreviewRowFrame(frame.left + 220, rowY, 342, 31, 0.7);
    scene.add.text(frame.left + 66, rowY - 8, compactSentenceText(row, 46, 1), {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: row.startsWith('NEXT FIGHT') || row.startsWith('ENEMY COVER') ? '#ffd5cc' : '#e8f4ff',
      fixedWidth: 308,
      maxLines: 1,
    });
  });
  scene.add.rectangle(frame.left + 408, frame.cy + 14, 2, 396, accent, 0.36);
  if (!hasCardChoices) {
    const panelX = frame.left + 672;
    const panelY = frame.top + 326;
    if (!pending.previewItem || !scene.renderRouteRewardItemShowcase(pending.previewItem, panelX, panelY, 410, 238, pending.previewCards ?? [])) {
      scene.renderRouteRewardEffectShowcase(pending, panelX, panelY, 410, 238);
    }
    const claim = scene.add.rectangle(frame.right - 158, frame.bottom - 48, 180, 38, 0x102235, 0.98)
      .setStrokeStyle(2, accent, 0.92);
    const claimHit = scene.add.rectangle(frame.right - 158, frame.bottom - 48, 180, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('route-reward-claim-hit');
    claimHit.on('pointerover', () => claim.setFillStyle(0x18314a, 1));
    claimHit.on('pointerout', () => claim.setFillStyle(0x102235, 0.98));
    claimHit.on('pointerdown', () => {
      playUiSound('confirm');
      scene.claimRouteReward();
    });
    const claimLabel = isDecline ? 'Leave' : pending.nodeType === 'cache' ? 'Claim' : 'Confirm';
    scene.add.text(frame.right - 158, frame.bottom - 60, claimLabel, {
      fontFamily: UI_FONT,
      fontSize: '15px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      align: 'center',
      fixedWidth: 150
    }).setOrigin(0.5, 0);
  }
  scene.routeCardRewardChoices.forEach((card: any, index: number) => {
    const cardW = 148;
    const cardH = Math.round(cardW * 1.5);
    const x = frame.left + 540 + index * 190;
    const y = frame.top + 312;
    const armed = scene.routeRewardArmedCardId === card.id;
    const accentColor = card.type === 'major' ? UI_FIELD.gold : card.type === 'molt' ? 0xc56cff : suitAccentColor(card);
    addRewardRevealHaloFx(scene, x, y, cardW + 68, cardH + 98, 0.18);
    scene.renderRouteRewardCardOption(card, x, y, cardW, cardH, accentColor);
    if (index === scene.routeRewardChoiceIndex) {
      scene.add.rectangle(x, y + 8, cardW + 30, cardH + 88, 0x000000, 0)
        .setStrokeStyle(4, armed ? UI_FIELD.gold : UI_FIELD.cyan, 1)
        .setName('route-reward-input-focus-ring');
    }
    scene.add.rectangle(x, y + cardH / 2 + 24, cardW + 16, 34, 0x020409, 0.94)
      .setStrokeStyle(1, accentColor, 0.72);
    scene.add.text(x, y + cardH / 2 + 12, armed ? 'CONFIRM PICK\nBACK CANCELS' : displayName(card), {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      align: 'center',
      fixedWidth: cardW,
      fixedHeight: 28,
      wordWrap: { width: cardW },
      maxLines: 2
    }).setOrigin(0.5, 0);
    const hit = scene.add.rectangle(x, y + 8, cardW + 18, cardH + 76, 0x000000, 0.01)
      .setInteractive({ useHandCursor: true })
      .setName('route-reward-card-hit');
    hit.on('pointerdown', () => scene.requestRouteRewardCard(card.id));
    hit.on('pointerover', () => {
      scene.setRouteRewardChoice(card.id);
      if (scene.routeRewardArmedCardId !== card.id) scene.showHoverCardDetail(card, 'Cache reward', card.cost, x, y);
    });
    hit.on('pointerout', () => scene.hideHoverCardDetail());
    const inspectY = frame.bottom - 48;
    const inspect = scene.add.rectangle(x, inspectY, 126, MIN_SUPPORTED_TOUCH_TARGET, 0x102534, 0.99)
      .setStrokeStyle(2, armed ? UI_FIELD.gold : index === scene.routeRewardChoiceIndex ? UI_FIELD.cyan : accentColor, 0.94)
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
    inspect.on('pointerout', () => inspect.setFillStyle(0x102534, 0.99));
    scene.add.text(x, inspectY, 'INSPECT', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: '#dffbff',
    }).setOrigin(0.5).setName('route-reward-card-inspect-label');
  });
  scene.renderRouteEventCancelButton(frame.left + 126, frame.bottom - 48, 166, 38, 'Cancel', () => scene.cancelRouteCardReward());
  if (hasCardChoices) {
    const hintX = frame.left + 672;
    const hintY = frame.top + 116;
    scene.add.rectangle(hintX, hintY, 500, 42, 0x020711, 0.86)
      .setStrokeStyle(1, UI_FIELD.cyan, 0.55);
    const hintText = `ARROWS / D-PAD  CHOOSE   |   ENTER / A  ${scene.routeRewardArmedCardId ? 'CONFIRM' : 'SELECT'}\nR / Y  INSPECT   |   ESC / B  BACK`;
    scene.add.text(hintX, hintY, hintText, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: '#bfe8f4',
      fixedWidth: 476,
      align: 'center',
    }).setOrigin(0.5).setResolution(2).setName('route-reward-input-hint');
  }
  renderRouteRewardInspection(scene);
}

function renderRouteRewardInspection(scene: any) {
  if (!scene.routeRewardInspectionCardId) return;
  const card = scene.routeCardRewardChoices.find((candidate: any) => (
    candidate.id === scene.routeRewardInspectionCardId
  ));
  if (!card) {
    scene.routeRewardInspectionCardId = undefined;
    return;
  }
  const scrim = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.86)
    .setInteractive({ useHandCursor: true })
    .setDepth(23010)
    .setName('route-reward-inspection-scrim');
  scrim.on('pointerdown', () => scene.closeRouteRewardInspection());
  scene.add.text(GAME_WIDTH / 2, 38, 'FULL CARD INSPECTION', {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: '#ffe08a',
    letterSpacing: 1.4,
  }).setOrigin(0.5).setDepth(23030);
  scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 34, `${controlBindingLabel('back')} / B / TAP OUTSIDE  RETURN TO THIS CHOICE`, {
    fontFamily: UI_FONT,
    fontSize: '12px',
    fontStyle: UI_BOLD,
    color: '#dffbff',
  }).setOrigin(0.5).setDepth(23030);
  scene.showHoverCardDetail(card, 'Route reward inspection', card.cost, GAME_WIDTH / 2, GAME_HEIGHT / 2);
}
