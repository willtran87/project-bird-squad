import Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET } from './theme';

function cardPickerEntries(scene: any) {
  return scene.cardPickerMode ? scene.pickerEligibleCards(scene.cardPickerMode) : [];
}

export function focusedCardPickerEntry(scene: any) {
  const entries = cardPickerEntries(scene);
  if (entries.length === 0) return undefined;
  scene.cardPickerFocusIndex = Phaser.Math.Clamp(
    Math.round(scene.cardPickerFocusIndex ?? 0),
    0,
    entries.length - 1,
  );
  return entries[scene.cardPickerFocusIndex];
}

export function cycleCardPickerFocus(scene: any, delta: number) {
  const entries = cardPickerEntries(scene);
  if (scene.cardPickerInspectionOpen || entries.length === 0) return false;
  scene.cardPickerFocusIndex = (
    (scene.cardPickerFocusIndex ?? 0) + delta + entries.length
  ) % entries.length;
  const columns = 5;
  const visibleCount = 10;
  const firstVisible = scene.cardPickerScroll * columns;
  if (scene.cardPickerFocusIndex < firstVisible) {
    scene.cardPickerScroll = Math.floor(scene.cardPickerFocusIndex / columns);
  } else if (scene.cardPickerFocusIndex >= firstVisible + visibleCount) {
    scene.cardPickerScroll = Math.max(0, Math.floor(scene.cardPickerFocusIndex / columns) - 1);
  }
  scene.renderAll();
  return true;
}

export function openCardPickerInspection(scene: any, focusIndex = scene.cardPickerFocusIndex) {
  const entries = cardPickerEntries(scene);
  if (entries.length === 0) return undefined;
  scene.cardPickerFocusIndex = Phaser.Math.Clamp(Math.round(focusIndex ?? 0), 0, entries.length - 1);
  scene.cardPickerInspectionOpen = true;
  scene.hideHoverCardDetail();
  scene.renderAll();
  return entries[scene.cardPickerFocusIndex];
}

export function closeCardPickerInspection(scene: any) {
  if (!scene.cardPickerInspectionOpen) return false;
  scene.cardPickerInspectionOpen = false;
  scene.hideHoverCardDetail();
  scene.renderAll();
  return true;
}

export function renderCardPickerInput(
  scene: Phaser.Scene,
  selection: Phaser.GameObjects.Rectangle,
  entry: any,
  x: number,
  y: number,
  cardWidth: number,
  cardHeight: number,
  accent: number,
  affordable: boolean,
  focusIndex: number,
) {
  const owner = scene as any;
  const focused = (owner.cardPickerFocusIndex ?? 0) === focusIndex;
  selection.on('pointerover', () => {
    owner.cardPickerFocusIndex = focusIndex;
    owner.showHoverCardDetail(
      entry.card,
      owner.cardPickerMode === 'preen' ? 'Preen candidate' : 'Remove candidate',
      entry.cost,
      x,
      y,
    );
  });
  selection.on('pointerout', () => owner.hideHoverCardDetail());
  if (focused) {
    scene.add.rectangle(x, y, cardWidth + 16, cardHeight + 16, 0x000000, 0)
      .setStrokeStyle(3, 0x8df4ff, 1)
      .setName('card-picker-input-focus-ring');
  }
  const inspectY = y + cardHeight / 2 + 25;
  const inspect = scene.add.rectangle(
    x,
    inspectY,
    cardWidth,
    MIN_SUPPORTED_TOUCH_TARGET,
    focused ? 0x12324a : 0x102534,
    0.99,
  )
    .setStrokeStyle(2, focused ? 0x8df4ff : accent, affordable ? 0.96 : 0.72)
    .setInteractive({ useHandCursor: true })
    .setName('card-picker-card-inspect-hit');
  inspect.on('pointerdown', (
    _pointer: Phaser.Input.Pointer,
    _localX: number,
    _localY: number,
    event?: Phaser.Types.Input.EventData,
  ) => {
    event?.stopPropagation();
    openCardPickerInspection(owner, focusIndex);
  });
  scene.add.text(x, inspectY, 'INSPECT', {
    fontFamily: 'Arial',
    fontSize: '10px',
    fontStyle: 'bold',
    color: focused ? '#ffffff' : '#dffbff',
  }).setOrigin(0.5).setName('card-picker-card-inspect-label');
}

export function renderCardPickerInspection(
  scene: any,
  width: number,
  height: number,
  backLabel: string,
) {
  if (!scene.cardPickerInspectionOpen) return;
  const entry = focusedCardPickerEntry(scene);
  if (!entry) {
    scene.cardPickerInspectionOpen = false;
    return;
  }
  const scrim = scene.add.rectangle(
    width / 2,
    height / 2,
    width,
    height,
    0x020409,
    0.88,
  )
    .setDepth(23010)
    .setInteractive({ useHandCursor: true })
    .setName('card-picker-inspection-scrim');
  scrim.on('pointerdown', () => closeCardPickerInspection(scene));
  scene.add.text(74, 38, `FULL CARD INSPECTION · ${scene.cardPickerMode === 'preen' ? 'PREEN' : 'RELEASE'}`, {
    fontFamily: 'Arial',
    fontSize: '13px',
    fontStyle: 'bold',
    color: '#ffe08a',
    letterSpacing: 1.2,
  }).setOrigin(0, 0.5).setDepth(23012).setName('card-picker-inspection-title');
  scene.add.text(
    width / 2,
    height - 34,
    `${backLabel} / B / CONFIRM / A / TAP OUTSIDE  RETURN WITHOUT APPLYING`,
    {
      fontFamily: 'Arial',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#dffbff',
    },
  ).setOrigin(0.5).setDepth(23012).setName('card-picker-inspection-return');
  scene.showHoverCardDetail(
    entry.card,
    scene.cardPickerMode === 'preen' ? 'Preen candidate' : 'Release candidate',
    entry.cost,
    width / 2,
    height / 2,
  );
}

export function focusedRouteRewardCard(scene: any) {
  if (scene.routeCardRewardChoices.length === 0) return undefined;
  scene.routeRewardChoiceIndex = Phaser.Math.Clamp(
    Math.round(scene.routeRewardChoiceIndex),
    0,
    scene.routeCardRewardChoices.length - 1,
  );
  return scene.routeCardRewardChoices[scene.routeRewardChoiceIndex];
}

export function cycleRouteRewardChoice(scene: any, direction: -1 | 1) {
  if (scene.routeRewardInspectionCardId || scene.routeCardRewardChoices.length === 0) return false;
  scene.routeRewardChoiceIndex = (
    scene.routeRewardChoiceIndex + direction + scene.routeCardRewardChoices.length
  ) % scene.routeCardRewardChoices.length;
  scene.renderAll();
  return true;
}

export function setRouteRewardChoice(scene: any, cardId: string) {
  const index = scene.routeCardRewardChoices.findIndex((card: any) => card.id === cardId);
  if (index >= 0) scene.routeRewardChoiceIndex = index;
}

export function openRouteRewardInspection(scene: any, cardId: string) {
  const index = scene.routeCardRewardChoices.findIndex((card: any) => card.id === cardId);
  if (index < 0) return undefined;
  scene.routeRewardChoiceIndex = index;
  scene.routeRewardInspectionCardId = cardId;
  scene.renderAll();
  return scene.routeCardRewardChoices[index];
}

export function closeRouteRewardInspection(scene: any) {
  if (!scene.routeRewardInspectionCardId) return false;
  scene.routeRewardInspectionCardId = undefined;
  scene.hideHoverCardDetail();
  scene.renderAll();
  return true;
}

export function updateRouteRewardGamepad(
  scene: any,
  pad: Phaser.Input.Gamepad.Gamepad,
  buttonsDown: Set<string>,
) {
  if (scene.cardPickerMode) {
    const controls: Array<[string, boolean, () => void]> = [
      ['picker-left', pad.left, () => cycleCardPickerFocus(scene, -1)],
      ['picker-right', pad.right, () => cycleCardPickerFocus(scene, 1)],
      ['picker-up', pad.up, () => cycleCardPickerFocus(scene, -5)],
      ['picker-down', pad.down, () => cycleCardPickerFocus(scene, 5)],
      ['picker-confirm', pad.A, () => handleRouteRewardAction(scene, 'confirm')],
    ];
    controls.forEach(([id, pressed, action]) => {
      if (pressed && !buttonsDown.has(id)) action();
      if (pressed) buttonsDown.add(id);
      else buttonsDown.delete(id);
    });
    return true;
  }
  if (!scene.pendingRouteReward || scene.routeCardRewardChoices.length === 0) return false;
  const controls: Array<[string, boolean, () => void]> = [
    ['reward-previous', pad.left || pad.up, () => scene.cycleRouteRewardChoice(-1)],
    ['reward-next', pad.right || pad.down, () => scene.cycleRouteRewardChoice(1)],
    ['reward-confirm', pad.A, () => {
      if (scene.routeRewardInspectionCardId) {
        scene.closeRouteRewardInspection();
        return;
      }
      const card = scene.focusedRouteRewardCard();
      if (card) scene.chooseRouteRewardCard(card.id);
    }],
  ];
  controls.forEach(([id, pressed, action]) => {
    if (pressed && !buttonsDown.has(id)) action();
    if (pressed) buttonsDown.add(id);
    else buttonsDown.delete(id);
  });
  return true;
}

export function handleRouteRewardAction(
  scene: any,
  action: 'confirm' | 'previous' | 'next' | 'inspect' | 'back',
) {
  if (scene.cardPickerMode) {
    if (action === 'back') {
      if (scene.cardPickerInspectionOpen) closeCardPickerInspection(scene);
      else if (scene.cardPickerContext === 'market') scene.cancelMarketCardPicker();
      else scene.cancelRouteCardPicker();
      return true;
    }
    if (scene.cardPickerInspectionOpen) {
      if (action === 'confirm' || action === 'inspect') closeCardPickerInspection(scene);
      return true;
    }
    if (action === 'previous' || action === 'next') {
      cycleCardPickerFocus(scene, action === 'previous' ? -1 : 1);
    } else if (action === 'inspect') {
      openCardPickerInspection(scene);
    } else {
      const entry = focusedCardPickerEntry(scene);
      if (entry && (scene.cardPickerContext !== 'market' || scene.runState.scrap >= entry.cost)) {
        scene.applyCardPick(entry.index);
      }
    }
    return true;
  }
  if (action === 'back') {
    if (scene.routeRewardInspectionCardId) scene.closeRouteRewardInspection();
    else if (scene.pendingRouteReward) scene.cancelRouteCardReward();
    else return false;
    return true;
  }
  if (!scene.pendingRouteReward || scene.routeCardRewardChoices.length === 0) return false;
  if (scene.routeRewardInspectionCardId) {
    if (action === 'confirm' || action === 'inspect') scene.closeRouteRewardInspection();
    return true;
  }
  if (action === 'previous' || action === 'next') {
    scene.cycleRouteRewardChoice(action === 'previous' ? -1 : 1);
  } else if (action === 'inspect') {
    scene.toggleFocusedRouteRewardInspection();
  } else {
    const card = scene.focusedRouteRewardCard();
    if (card) scene.chooseRouteRewardCard(card.id);
  }
  return true;
}

export function focusedRewardCard(scene: any) {
  const cards = scene.mode === 'cardReward'
    ? scene.rewardChoices
    : scene.mode === 'upgradeReward'
      ? scene.upgradeChoices
      : [];
  return cards[scene.normalizeCombatChoiceIndex()];
}

export function openRewardCardInspection(scene: any, cardId: string) {
  const cards = scene.mode === 'cardReward' ? scene.rewardChoices : scene.upgradeChoices;
  const index = cards.findIndex((card: any) => card.id === cardId);
  if (index < 0) return undefined;
  scene.controllerChoiceIndex = index;
  scene.battleInputActive = true;
  scene.rewardInspectionCardId = cardId;
  scene.requestBattleRender();
  return cards[index];
}

export function closeRewardCardInspection(scene: any) {
  if (!scene.rewardInspectionCardId) return false;
  scene.rewardInspectionCardId = undefined;
  scene.rewardInspectionLayer?.destroy(true);
  scene.rewardInspectionLayer = undefined;
  scene.hideCardPreview();
  scene.requestBattleRender();
  return true;
}

export function renderRewardInspectButton(context: {
  scene: Phaser.Scene;
  target: Phaser.GameObjects.Container;
  x: number;
  y: number;
  accent: number;
  focused: boolean;
  fontFamily: string;
  boldFontStyle: string;
  onInspect: () => void;
}) {
  const { scene, target, x, y } = context;
  const hit = scene.add.rectangle(x, y, 132, MIN_SUPPORTED_TOUCH_TARGET, 0x102534, 0.99)
    .setStrokeStyle(2, context.focused ? 0x8df4ff : context.accent, 0.94)
    .setInteractive({ useHandCursor: true })
    .setName('reward-card-inspect-hit');
  hit.on('pointerdown', (
    _pointer: Phaser.Input.Pointer,
    _localX: number,
    _localY: number,
    event?: Phaser.Types.Input.EventData,
  ) => {
    event?.stopPropagation();
    context.onInspect();
  });
  target.add(hit);
  target.add(scene.add.text(x, y, 'INSPECT', {
    fontFamily: context.fontFamily,
    fontSize: '11px',
    fontStyle: context.boldFontStyle,
    color: '#dffbff',
  }).setOrigin(0.5).setName('reward-card-inspect-label'));
}

export function renderRewardInspectionChrome(context: {
  scene: Phaser.Scene;
  target: Phaser.GameObjects.Container;
  width: number;
  height: number;
  fontFamily: string;
  boldFontStyle: string;
  backLabel: string;
  onClose: () => void;
}) {
  const { scene, target, width, height, fontFamily, boldFontStyle } = context;
  const layer = scene.add.container(0, 0).setDepth(900).setName('reward-card-inspection');
  const scrim = scene.add.rectangle(width / 2, height / 2, width, height, 0x020409, 0.86)
    .setInteractive({ useHandCursor: true })
    .setName('reward-card-inspection-scrim');
  scrim.on('pointerdown', context.onClose);
  layer.add(scrim);
  layer.add(scene.add.text(74, 38, 'FULL CARD INSPECTION', {
    fontFamily,
    fontSize: '13px',
    fontStyle: boldFontStyle,
    color: '#ffe08a',
    letterSpacing: 1.4,
  }).setOrigin(0, 0.5));
  layer.add(scene.add.text(width / 2, height - 34, `${context.backLabel} / B / TAP OUTSIDE  RETURN TO THIS CHOICE`, {
    fontFamily,
    fontSize: '12px',
    fontStyle: boldFontStyle,
    color: '#dffbff',
  }).setOrigin(0.5));
  target.add(layer);
  return layer;
}

export function syncRewardCardInspection(scene: any, chrome: {
  target: Phaser.GameObjects.Container;
  width: number;
  height: number;
  fontFamily: string;
  boldFontStyle: string;
  backLabel: string;
  onClose: () => void;
}) {
  scene.rewardInspectionLayer?.destroy(true);
  scene.rewardInspectionLayer = undefined;
  if (!scene.rewardInspectionCardId) return;
  const cards = scene.mode === 'cardReward' ? scene.rewardChoices : scene.upgradeChoices;
  const card = cards.find((candidate: any) => candidate.id === scene.rewardInspectionCardId);
  if (!card) {
    scene.rewardInspectionCardId = undefined;
    scene.hideCardPreview();
    return;
  }
  scene.hideCardPreview();
  scene.rewardInspectionLayer = renderRewardInspectionChrome({ scene, ...chrome });
  scene.showCardPreview(card, chrome.width / 2);
  scene.cardPreview?.setDepth(910);
}
