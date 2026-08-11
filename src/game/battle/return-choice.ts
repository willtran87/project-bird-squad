import Phaser from 'phaser';

export interface ReturnChoiceState {
  source: string;
  filter: string;
  drawAfter: number;
  candidateIds: string[];
  focusIndex: number;
  onResolve: (returned: number) => void;
}

export interface ReturnChoiceCardView {
  instanceId: string;
  id: string;
  name: string;
  cost: number;
  role: string;
  summary: string;
}

export function returnChoiceTextState(
  choice: ReturnChoiceState,
  cards: ReturnChoiceCardView[],
  input: { choose: string; confirm: string; cancel: string },
) {
  const focusedId = choice.candidateIds[choice.focusIndex];
  return {
    source: choice.source,
    filter: choice.filter,
    drawAfter: choice.drawAfter,
    required: 1,
    canCancel: false,
    focusIndex: choice.focusIndex,
    focusedId,
    candidates: choice.candidateIds.flatMap((instanceId, index) => {
      const card = cards.find((candidate) => candidate.instanceId === instanceId);
      return card ? [{ ...card, focused: index === choice.focusIndex, discardOrder: index + 1 }] : [];
    }),
    input,
  };
}

export function renderReturnChoiceOverlay(options: {
  scene: Phaser.Scene;
  target: Phaser.GameObjects.Container;
  gameWidth: number;
  gameHeight: number;
  fontFamily: string;
  boldFontStyle: string;
  gold: number;
  cyan: number;
  choice: ReturnChoiceState;
  cards: ReturnChoiceCardView[];
  onFocus: (instanceId: string) => void;
  onChoose: (instanceId: string) => void;
}) {
  const { scene, target, gameWidth, gameHeight, fontFamily, boldFontStyle, gold, cyan, choice } = options;
  const visibleRows = Math.min(5, Math.max(1, choice.candidateIds.length));
  const rowHeight = 58;
  const rowStep = 60;
  const panelX = gameWidth / 2;
  const panelY = 335;
  const panelWidth = 820;
  const panelHeight = 124 + visibleRows * rowStep;
  const panelTop = panelY - panelHeight / 2;
  const panelBottom = panelY + panelHeight / 2;
  const maxStart = Math.max(0, choice.candidateIds.length - visibleRows);
  const start = Phaser.Math.Clamp(choice.focusIndex - Math.floor(visibleRows / 2), 0, maxStart);
  const visibleIds = choice.candidateIds.slice(start, start + visibleRows);

  target.add(scene.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, 0x02050b, 0.62)
    .setName('combat-return-choice-scrim'));
  target.add(scene.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x07101c, 0.99)
    .setStrokeStyle(3, gold, 0.96)
    .setName('combat-return-choice-panel'));
  target.add(scene.add.text(panelX, panelTop + 28, 'RETURN A CARD FROM DISCARD', {
    fontFamily, fontSize: '21px', fontStyle: boldFontStyle, color: '#fff0b8',
  }).setOrigin(0.5).setName('combat-return-choice-title'));
  target.add(scene.add.text(panelX, panelTop + 55, `${choice.source} pauses until one eligible card returns${choice.drawAfter > 0 ? `, then draws ${choice.drawAfter}` : ''}.`, {
    fontFamily, fontSize: '12px', color: '#cfe7ee', fixedWidth: panelWidth - 56, align: 'center', maxLines: 1,
  }).setOrigin(0.5).setName('combat-return-choice-source'));

  visibleIds.forEach((instanceId, visibleIndex) => {
    const absoluteIndex = start + visibleIndex;
    const card = options.cards.find((candidate) => candidate.instanceId === instanceId);
    if (!card) return;
    const focused = absoluteIndex === choice.focusIndex;
    const y = panelTop + 100 + visibleIndex * rowStep;
    const hit = scene.add.rectangle(panelX, y, panelWidth - 48, rowHeight, focused ? 0x28311f : 0x0d1926, 0.98)
      .setStrokeStyle(focused ? 3 : 1, focused ? gold : cyan, focused ? 1 : 0.5)
      .setInteractive({ useHandCursor: true })
      .setName('combat-return-choice-row')
      .setData('instanceId', card.instanceId)
      .setData('focused', focused);
    hit.on('pointerover', () => options.onFocus(card.instanceId));
    hit.on('pointerdown', () => options.onChoose(card.instanceId));
    target.add(hit);
    target.add(scene.add.text(panelX - panelWidth / 2 + 40, y, `${absoluteIndex + 1}`, {
      fontFamily, fontSize: '14px', fontStyle: boldFontStyle, color: focused ? '#fff0b8' : '#8fb3bf', fixedWidth: 28, align: 'center',
    }).setOrigin(0.5).setName('combat-return-choice-index'));
    target.add(scene.add.text(panelX - panelWidth / 2 + 78, y - 10, card.name, {
      fontFamily, fontSize: '14px', fontStyle: boldFontStyle, color: focused ? '#fff0b8' : '#f4fdff', fixedWidth: 210, maxLines: 1,
    }).setOrigin(0, 0.5).setName('combat-return-choice-name'));
    target.add(scene.add.text(panelX - panelWidth / 2 + 78, y + 11, `${card.cost} Wingbeat  |  ${card.role.toUpperCase()}`, {
      fontFamily, fontSize: '10px', color: '#9fc3cf', fixedWidth: 210, maxLines: 1,
    }).setOrigin(0, 0.5).setName('combat-return-choice-meta'));
    target.add(scene.add.text(panelX - 72, y, card.summary, {
      fontFamily, fontSize: '11px', color: '#dcecf0', fixedWidth: 430, wordWrap: { width: 430 }, maxLines: 2,
    }).setOrigin(0, 0.5).setName('combat-return-choice-summary'));
  });

  const focusedPosition = choice.candidateIds.length > 0 ? choice.focusIndex + 1 : 0;
  target.add(scene.add.text(panelX, panelBottom - 22, `${focusedPosition} / ${choice.candidateIds.length}   |   PREVIOUS / NEXT CHOOSE   |   ENTER / A / TAP RETURN   |   B CANNOT CANCEL`, {
    fontFamily, fontSize: '12px', fontStyle: boldFontStyle, color: '#f4fdff', fixedWidth: panelWidth - 36, align: 'center', maxLines: 1,
  }).setOrigin(0.5).setName('combat-return-choice-hint'));
}

export function beginReturnChoice(
  host: any,
  source: string,
  filter: string,
  drawAfter: number,
  onResolve: (returned: number) => void,
) {
  const normalizedFilter = (filter || 'nonMolt').trim();
  const allowMolt = normalizedFilter === 'any' || normalizedFilter === 'all';
  const candidateIds = [...host.discardPile]
    .reverse()
    .filter((card: any) => allowMolt || card.type !== 'molt')
    .map((card: any) => card.instanceId);
  if (candidateIds.length === 0) {
    host.logEvent('No route memory is ready to return.');
    onResolve(0);
    return;
  }
  host.selectedInstanceId = undefined;
  host.returnChoice = {
    source,
    filter: normalizedFilter,
    drawAfter: Math.max(0, Math.floor(drawAfter)),
    candidateIds,
    focusIndex: 0,
    onResolve,
  } satisfies ReturnChoiceState;
  host.controllerChoiceIndex = 0;
  host.battleInputActive = true;
  host.hideCardPreview();
  host.hideDiscardChoiceTooltip();
  host.announceDiscardChoice(`Choose one of ${candidateIds.length} eligible discard card${candidateIds.length === 1 ? '' : 's'} to return for ${source}.`);
  host.requestBattleRender();
}

export function focusReturnChoice(host: any, instanceId: string, feedback = false) {
  const choice: ReturnChoiceState | undefined = host.returnChoice;
  if (!choice) return;
  const index = choice.candidateIds.indexOf(instanceId);
  if (index < 0 || index === choice.focusIndex) return;
  choice.focusIndex = index;
  host.controllerChoiceIndex = index;
  host.battleInputActive = true;
  if (feedback) host.playDiscardChoiceSound('confirm');
  host.requestBattleRender();
}

export function moveReturnChoice(host: any, direction: -1 | 1) {
  const choice: ReturnChoiceState | undefined = host.returnChoice;
  if (!choice || choice.candidateIds.length === 0) return;
  choice.focusIndex = (choice.focusIndex + direction + choice.candidateIds.length) % choice.candidateIds.length;
  host.controllerChoiceIndex = choice.focusIndex;
  host.battleInputActive = true;
  host.playDiscardChoiceSound('confirm');
  host.requestBattleRender();
}

export function chooseReturnCard(host: any, instanceId?: string) {
  const choice: ReturnChoiceState | undefined = host.returnChoice;
  if (!choice) return;
  const wantedId = instanceId ?? choice.candidateIds[choice.focusIndex];
  if (!wantedId || !choice.candidateIds.includes(wantedId)) {
    host.playDiscardChoiceSound('locked');
    return;
  }
  const pileIndex = host.discardPile.findIndex((card: any) => card.instanceId === wantedId);
  if (pileIndex < 0) {
    host.playDiscardChoiceSound('locked');
    host.announceDiscardChoice('That card is no longer in discard. Choose another card.');
    return;
  }
  const [card] = host.discardPile.splice(pileIndex, 1);
  host.hand.push(card);
  const name = host.returnChoiceCardName(card);
  host.logEvent(`${name} returns from discard.`);
  const drawAfter = choice.drawAfter;
  host.returnChoice = undefined;
  if (drawAfter > 0) {
    host.drawCards(drawAfter);
    host.logEvent(`Route memory draws ${drawAfter}.`);
  }
  host.playDiscardChoiceSound('confirm');
  host.announceDiscardChoice(`${name} returned from discard. ${choice.source} continues.`);
  choice.onResolve(1);
  host.requestBattleRender();
}
