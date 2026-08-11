import Phaser from 'phaser';
import {
  addRewardRevealHaloFx,
  addSupplyArtImage,
  addUiIconImage,
  compactEffectSummary,
  controlBindingLabel,
  displayName,
  GAME_HEIGHT,
  GAME_WIDTH,
  routeEffectTokens,
  routeMarkFamilyLabel,
  routeNodeTypeLabel,
  supplyAccent,
  supplyCategoryLabel,
  supplyCompactArtAssets,
  suitAccentColor,
  UI_BOLD,
  UI_CYAN,
  UI_FIELD,
  UI_FONT,
  UI_GOLD,
  UI_SOFT,
} from '../main';
import { alphaSupplyLibrary } from './runtime-data';
import { MIN_SUPPORTED_TOUCH_TARGET } from './theme';
import { waymarkBuildRead } from './waymark-build-read';

export function routeRewardInputHint(armed: boolean) {
  return armed
    ? 'CONFIRM PICK   |   ENTER / A / TAP CARD AGAIN\nESC / B  CLEAR PICK   |   R / Y  INSPECT'
    : 'ARROWS / D-PAD  CHOOSE   |   ENTER / A  SELECT\nR / Y  INSPECT   |   ESC / B  BACK';
}

export function renderRouteSupplyRewardChoices(scene: any, x: number, y: number) {
  const choices = scene.routeSupplyRewardChoices.flatMap((id: string) => {
    const supply = alphaSupplyLibrary.get(id);
    return supply ? [supply] : [];
  });
  choices.forEach((supply: any, index: number) => {
    const cx = x + (index - (choices.length - 1) / 2) * 224;
    const focused = index === scene.routeSupplyRewardChoiceIndex;
    const armed = scene.routeSupplyRewardArmedId === supply.id;
    const accent = supplyAccent(supply);
    const key = supplyCompactArtAssets[supply.id]?.key;
    scene.add.rectangle(cx + 5, y + 7, 206, 276, 0x020409, 0.64);
    scene.add.rectangle(cx, y, 206, 276, 0x06101a, 0.96)
      .setStrokeStyle(focused ? 3 : 1.5, armed ? UI_FIELD.gold : focused ? UI_FIELD.cyan : accent, focused ? 1 : 0.7)
      .setName(focused ? 'route-supply-reward-focus-ring' : 'route-supply-reward-card');
    addRewardRevealHaloFx(scene, cx, y - 58, 154, 154, focused ? 0.24 : 0.14);
    scene.add.rectangle(cx, y - 58, 118, 118, 0x020409, 0.62).setStrokeStyle(1, accent, 0.62);
    if (key && scene.textures.exists(key)) {
      addSupplyArtImage(scene, cx, y - 58, key).setDisplaySize(106, 106);
    } else {
      scene.add.text(cx, y - 75, scene.supplyGlyph(supply), {
        fontFamily: UI_FONT,
        fontSize: '32px',
        fontStyle: UI_BOLD,
        color: '#ffe7c9',
        stroke: '#020409',
        strokeThickness: 2,
      }).setOrigin(0.5, 0);
    }
    scene.add.text(cx, y + 10, supply.name, {
      fontFamily: UI_FONT,
      fontSize: '15px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      align: 'center',
      fixedWidth: 186,
      maxLines: 1,
    }).setOrigin(0.5, 0);
    scene.add.text(cx, y + 38, `${supply.rarity.toUpperCase()} / ${supplyCategoryLabel(supply).toUpperCase()} / ${supply.timing.toUpperCase()}`, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: UI_CYAN,
      align: 'center',
      fixedWidth: 188,
      maxLines: 1,
    }).setOrigin(0.5, 0);
    scene.add.text(cx, y + 60, compactEffectSummary(supply.effects, 78), {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_SOFT,
      align: 'center',
      fixedWidth: 182,
      wordWrap: { width: 182 },
      maxLines: 3,
    }).setOrigin(0.5, 0);
    scene.add.text(cx, y + 113, armed ? 'CONFIRM THIS SUPPLY' : focused ? 'SELECTED / CONFIRM TO ARM' : 'CHOOSE', {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: armed ? UI_GOLD : focused ? '#dffbff' : '#a9bbc8',
      align: 'center',
      fixedWidth: 188,
      maxLines: 1,
    }).setOrigin(0.5, 0).setName('route-supply-reward-state');
    const hit = scene.add.rectangle(cx, y, 214, 284, 0x000000, 0.01)
      .setInteractive({ useHandCursor: true })
      .setName('route-supply-reward-hit')
      .setData('supplyId', supply.id);
    hit.on('pointerover', () => {
      if (!scene.routeSupplyRewardArmedId) scene.routeSupplyRewardChoiceIndex = index;
      scene.showRewardSupplyDetail(supply, cx, y);
    });
    hit.on('pointerout', () => scene.hideMarketItemDetail());
    hit.on('pointerdown', () => scene.requestRouteSupplyReward(supply.id));
  });
}

export function routeRewardChoiceDebugState(scene: any) {
  const supplyChoices = scene.routeSupplyRewardChoices.map((id: string) => {
    const supply = alphaSupplyLibrary.get(id);
    return supply ? {
      id,
      name: supply.name,
      rarity: supply.rarity,
      category: supply.category,
      timing: supply.timing,
      description: supply.description,
    } : { id };
  });
  const card = scene.pendingRouteReward ? scene.focusedRouteRewardCard() : undefined;
  const cardChoices = scene.routeCardRewardChoices.map((choice: any) => choice.id);
  if (cardChoices.length) {
    return {
      cardChoices,
      supplyChoices,
      inputFocus: {
        index: scene.routeRewardChoiceIndex,
        cardId: card?.id,
        cardName: card?.name,
        observations: scene.routeRewardCardObservations(card),
        armed: Boolean(scene.routeRewardArmedCardId),
        armedCardId: scene.routeRewardArmedCardId,
        commitBlockedUntilSelected: !scene.routeRewardArmedCardId,
        visible: scene.children.list.some((child: any) => child.name === 'route-reward-input-focus-ring'),
        controls: {
          choose: 'Arrow keys / D-pad',
          claim: scene.routeRewardArmedCardId ? 'Confirm / A commits' : 'Confirm / A selects',
          inspect: 'Roost / Y',
          back: 'Back / B',
        },
      },
    };
  }
  if (supplyChoices.length < 2) return { cardChoices, supplyChoices, inputFocus: undefined };
  const supply = scene.focusedRouteSupplyReward();
  return {
    cardChoices,
    supplyChoices,
    inputFocus: {
      kind: 'supply',
      index: scene.routeSupplyRewardChoiceIndex,
      supplyId: supply?.id,
      supplyName: supply?.name,
      description: supply?.description,
      timing: supply?.timing,
      armed: Boolean(scene.routeSupplyRewardArmedId),
      armedSupplyId: scene.routeSupplyRewardArmedId,
      commitBlockedUntilSelected: !scene.routeSupplyRewardArmedId,
      visible: scene.children.list.some((child: any) => child.name === 'route-supply-reward-focus-ring'),
      controls: {
        choose: 'Arrow keys / D-pad',
        claim: scene.routeSupplyRewardArmedId ? 'Confirm / A commits' : 'Confirm / A selects',
        back: 'Back / B',
      },
    },
  };
}

export function renderRouteRewardInspection(scene: any) {
  if (!scene.routeRewardInspectionCardId) return;
  const card = scene.routeCardRewardChoices.find((candidate: any) => candidate.id === scene.routeRewardInspectionCardId);
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
  const returnLabel = scene.routeRewardArmedCardId ? 'RETURN TO CONFIRM PICK' : 'RETURN TO THIS CHOICE';
  scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 34, `${controlBindingLabel('back')} / B / TAP OUTSIDE  ${returnLabel}`, {
    fontFamily: UI_FONT,
    fontSize: '12px',
    fontStyle: UI_BOLD,
    color: '#dffbff',
  }).setOrigin(0.5).setDepth(23030);
  scene.showHoverCardDetail(card, 'Route reward inspection', card.cost, GAME_WIDTH / 2, GAME_HEIGHT / 2);
}

export function renderRouteRewardBuildRead(scene: any, frame: any) {
  if (!scene.routeCardRewardChoices.length) return;
  scene.add.text(frame.left + 54, frame.bottom - 226, 'BUILD READ', {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: UI_CYAN,
    letterSpacing: 1.2,
  }).setName('route-reward-build-read-title');
  scene.routeCardRewardChoices.forEach((card: any, index: number) => {
    const observations = scene.routeRewardCardObservations(card).slice(0, 2);
    const rowY = frame.bottom - 184 + index * 58;
    const accent = card.type === 'major' ? UI_FIELD.gold : card.type === 'molt' ? 0xc56cff : suitAccentColor(card);
    scene.add.rectangle(frame.left + 220, rowY, 342, 48, 0x071522, 0.76)
      .setStrokeStyle(1, accent, 0.5)
      .setName('route-reward-build-read-row');
    scene.add.text(frame.left + 66, rowY - 17, displayName(card), {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      fixedWidth: 308,
      maxLines: 1,
    }).setName('route-reward-build-card-name');
    scene.add.text(frame.left + 66, rowY, observations.join('  /  '), {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: observations.some((observation: string) => observation.startsWith('!')) ? '#ffd0b3' : '#dffbff',
      fixedWidth: 308,
      maxLines: 1,
    }).setName('route-reward-build-observation');
  });
}

export function renderMarketCardBuildRead(scene: Phaser.Scene, observations: string[]) {
  const panel = scene.add.container(995, 606).setName('market-card-build-read');
  panel.add(scene.add.rectangle(0, 0, 270, 48, 0x05080e, 0.97)
    .setOrigin(0, 0)
    .setStrokeStyle(2, UI_FIELD.gold, 0.8)
    .setName('market-card-build-read-frame'));
  panel.add(scene.add.text(14, 8, 'BUILD READ', {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: UI_CYAN,
    letterSpacing: 1.2,
  }).setName('market-card-build-read-title'));
  observations.slice(0, 2).forEach((observation, index) => {
    panel.add(scene.add.text(14, 21 + index * 13, observation, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: observation.startsWith('!') ? '#ffd0b3' : '#dffbff',
      fixedWidth: 242,
      maxLines: 1,
    }).setName('market-card-build-observation'));
  });
  return panel;
}

export function renderRouteRewardEffectShowcase(scene: any, pending: any, x: number, y: number, w: number, h: number) {
  const accent = pending.accent;
  const previewCards = pending.previewCards ?? [];
  scene.add.rectangle(x, y, w, h, 0x06101a, 0.9)
    .setStrokeStyle(2, accent, 0.76)
    .setName('route-reward-effect-showcase');
  scene.add.rectangle(x, y - h / 2 + 16, w - 28, 3, accent, 0.72);

  if (previewCards.length > 0) {
    const cardSlots = previewCards.slice(0, 2);
    const compactCards = cardSlots.length > 1;
    cardSlots.forEach((card: any, index: number) => {
      const cardX = compactCards ? x + 48 + index * 116 : x + 102;
      const cardW = compactCards ? 86 : 108;
      const cardH = Math.round(cardW * 1.5);
      const cardY = compactCards ? y - 10 : y - 4;
      const cardKindLabel = card.runtime.kind === 'snag' ? 'SNAG CARD' : `${card.runtime.rarity.toUpperCase()} CARD`;
      const cardAccent = card.runtime.kind === 'snag' ? UI_FIELD.danger : UI_FIELD.gold;
      const cardTextColor = card.runtime.kind === 'snag' ? '#ffd5cc' : UI_GOLD;
      addRewardRevealHaloFx(scene, cardX, cardY, cardW + 54, cardH + 70, card.runtime.kind === 'snag' ? 0.14 : 0.18);
      scene.add.text(cardX, y - 100, cardKindLabel, {
        fontFamily: UI_FONT,
        fontSize: compactCards ? '9px' : '10px',
        fontStyle: UI_BOLD,
        color: card.runtime.kind === 'snag' ? '#ffd5cc' : UI_CYAN,
        align: 'center',
        wordWrap: { width: compactCards ? 104 : 150 },
        maxLines: 1,
      }).setOrigin(0.5, 0);
      scene.renderRouteRewardCardOption(card, cardX, cardY, cardW, cardH, cardAccent);
      scene.add.rectangle(cardX, y + 93, compactCards ? 104 : 138, 28, 0x020409, 0.94)
        .setStrokeStyle(1, cardAccent, 0.72);
      scene.add.text(cardX, y + 83, displayName(card), {
        fontFamily: UI_FONT,
        fontSize: compactCards ? '10px' : '11px',
        fontStyle: UI_BOLD,
        color: cardTextColor,
        align: 'center',
        wordWrap: { width: compactCards ? 96 : 126 },
        maxLines: 2,
      }).setOrigin(0.5, 0);
      const cardHit = scene.add.rectangle(cardX, cardY, cardW + 18, cardH + 76, 0x000000, 0.01)
        .setInteractive({ useHandCursor: true });
      cardHit.on('pointerover', () => scene.showHoverCardDetail(card, `${routeNodeTypeLabel(pending.nodeType)} preview`, card.cost, cardX, cardY));
      cardHit.on('pointerout', () => scene.hideHoverCardDetail());
    });
    scene.add.rectangle(x, y + 2, 1, h - 44, accent, 0.36);
  }

  const tokens = routeEffectTokens(pending.effects);
  const rows = scene.routeChoicePreviewRows({
    key: pending.choiceKey,
    text: pending.choiceText,
    effects: pending.effects,
    locked: false,
  });
  const leftX = previewCards.length > 0 ? x - 116 : x;
  const tileW = previewCards.length > 0 ? 146 : 332;
  const tileH = 56;
  const positiveTokens = tokens.filter((token) => token.color !== UI_FIELD.danger);
  const riskTokens = tokens.filter((token) => token.color === UI_FIELD.danger);
  const visualTokens = tokens.length <= 3
    ? tokens
    : [...positiveTokens.slice(0, Math.max(1, 3 - Math.min(2, riskTokens.length))), ...riskTokens.slice(0, 2)].slice(0, 3);
  const listTop = y - (visualTokens.length - 1) * 32;
  if (visualTokens.length > 0) {
    addRewardRevealHaloFx(scene, leftX, y, tileW + 28, Math.min(h - 32, 94 + (visualTokens.length - 1) * 64), 0.12);
  }
  if (visualTokens.length === 0) {
    scene.add.text(leftX, y - 12, 'No reward will be taken.', {
      fontFamily: UI_FONT,
      fontSize: '15px',
      fontStyle: UI_BOLD,
      color: UI_SOFT,
      align: 'center',
      wordWrap: { width: tileW - 20 },
      maxLines: 2,
    }).setOrigin(0.5, 0);
  } else {
    visualTokens.forEach((token, index) => {
      const ty = listTop + index * 64;
      scene.add.rectangle(leftX, ty, tileW, tileH, 0x020409, 0.68)
        .setStrokeStyle(1, token.color, 0.68)
        .setName('route-reward-effect-token-frame')
        .setData('index', index)
        .setData('count', visualTokens.length);
      const compactTokenRow = tileW < 160;
      const iconX = leftX - tileW / 2 + (compactTokenRow ? 25 : 34);
      const labelX = leftX - tileW / 2 + (compactTokenRow ? 52 : 78);
      if (token.scrap) {
        addUiIconImage(scene, token.icon ?? 'scrap-gear', iconX, ty, compactTokenRow ? 16 : 18)?.setAlpha(0.94);
      } else if (token.icon) {
        addUiIconImage(scene, token.icon, iconX, ty, compactTokenRow ? 16 : 18)?.setAlpha(0.92);
      }
      scene.add.text(labelX, ty, token.label, {
        fontFamily: UI_FONT,
        fontSize: compactTokenRow ? '12px' : '14px',
        fontStyle: UI_BOLD,
        color: token.textColor,
        wordWrap: { width: tileW - (compactTokenRow ? 62 : 94) },
        maxLines: 1,
      }).setOrigin(0, 0.5);
    });
  }
  if (rows.length > 0 && visualTokens.length === 0) {
    const summary = rows.slice(0, 3).map((row: any) => `${row.label} ${scene.routeChoiceChangeAmountText(row)}`).join(' / ');
    scene.add.text(leftX, y + 80, summary, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: UI_SOFT,
      align: 'center',
      wordWrap: { width: tileW },
      maxLines: 2,
    }).setOrigin(0.5, 0);
  }
}

function cardPickerEntries(scene: any) {
  return scene.cardPickerMode ? scene.pickerEligibleCards(scene.cardPickerMode) : [];
}

export function requestCardPick(scene: any, index: number, playConfirm: () => void) {
  const mode = scene.cardPickerMode;
  if (!mode || scene.cardPickerInspectionOpen) return;
  const entries = cardPickerEntries(scene);
  const focusIndex = entries.findIndex((entry: any) => entry.index === index);
  const entry = entries[focusIndex];
  if (!entry || (scene.cardPickerContext === 'market' && scene.runState.scrap < entry.cost)) return;
  scene.cardPickerFocusIndex = focusIndex;
  if (scene.cardPickerArmedIndex !== index) {
    scene.cardPickerArmedIndex = index;
    scene.hideHoverCardDetail();
    playConfirm();
    scene.renderAll();
    return;
  }
  scene.cardPickerArmedIndex = undefined;
  playConfirm();
  scene.applyCardPick(index);
}

function compactCardPickerDeltaPart(text: string, max = 16) {
  const value = text.replace(/\s+/g, ' ').replace(/[.]$/, '').trim();
  return value.length <= max ? value : `${value.slice(0, max - 3).trimEnd()}...`;
}

export function renderCardPickerConfirmationRail(
  scene: any,
  frame: { left: number; bottom: number },
  view: { mode: 'preen' | 'release'; name: string; cost: number; delta: string; isMarketPicker: boolean },
) {
  const railX = frame.left + 720;
  const railY = frame.bottom - 48;
  scene.add.rectangle(railX, railY, 560, 42, 0x06111a, 0.97)
    .setStrokeStyle(2, UI_FIELD.gold, 0.88)
    .setName('card-picker-confirmation-rail');
  scene.add.text(railX - 258, railY - 8, `${view.mode === 'preen' ? 'PREEN' : 'RELEASE'}  ${compactCardPickerDeltaPart(view.name, 30)}`, {
    fontFamily: UI_FONT,
    fontSize: '12px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
    fixedWidth: 350,
    maxLines: 1,
  }).setResolution(2).setOrigin(0, 0.5).setName('card-picker-confirmation-title');
  const delta = compactCardPickerDeltaPart(view.delta.replace(/\s*\n\s*/g, ' '), 40);
  scene.add.text(railX - 258, railY + 9, `${view.isMarketPicker ? `${view.cost} SCRAP  •  ` : ''}${delta}`, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: '#c7d4df',
    fixedWidth: 350,
    maxLines: 1,
  }).setResolution(2).setOrigin(0, 0.5).setName('card-picker-confirmation-summary');
  scene.add.rectangle(railX + 205, railY, 126, 24, 0x102534, 0.98)
    .setStrokeStyle(1, UI_FIELD.gold, 0.76)
    .setName('card-picker-confirmation-command-frame');
  scene.add.text(railX + 205, railY, 'CONFIRM', {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: '#dffbff',
  }).setResolution(2).setOrigin(0.5).setName('card-picker-confirmation-command');
}

function compactCardPickerDeltaPair(before: string, after: string): [string, string] {
  if (!before) return ['NEW EFFECT', compactCardPickerDeltaPart(after)];
  if (!after) return [compactCardPickerDeltaPart(before), 'REMOVED'];
  const beforeWords = before.split(/\s+/);
  const afterWords = after.split(/\s+/);
  let prefix = 0;
  while (prefix < beforeWords.length && prefix < afterWords.length && beforeWords[prefix] === afterWords[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < beforeWords.length - prefix
    && suffix < afterWords.length - prefix
    && beforeWords[beforeWords.length - 1 - suffix] === afterWords[afterWords.length - 1 - suffix]
  ) suffix += 1;
  const beforeChanged = beforeWords.slice(prefix, beforeWords.length - suffix);
  const afterChanged = afterWords.slice(prefix, afterWords.length - suffix);
  if (beforeChanged.length > 0 && afterChanged.length > 0) {
    const context = prefix > 0 ? beforeWords[prefix - 1].replace(/[,:]$/, '') : '';
    const tail = suffix > 0 ? beforeWords[beforeWords.length - suffix].replace(/[.,:]$/, '') : '';
    return [
      compactCardPickerDeltaPart([context, ...beforeChanged, tail].filter(Boolean).join(' ')),
      compactCardPickerDeltaPart([context, ...afterChanged, tail].filter(Boolean).join(' ')),
    ];
  }
  return [compactCardPickerDeltaPart(before), compactCardPickerDeltaPart(after)];
}

export function cardPickerDecisionDelta(
  deckLength: number,
  mode: string,
  card: any,
  statEntries: (card: any) => Array<{ key: string; value: number }>,
  statLabel: (key: string) => string,
) {
  if (mode === 'release') return `DECK ${deckLength} > ${Math.max(0, deckLength - 1)}`;
  const split = (text: string) => text.split(/[.;]\s+/).map((part) => part.replace(/[.;]$/, '').trim()).filter(Boolean);
  const align = (before: string[], after: string[]) => Array.from(
    { length: Math.max(before.length, after.length) },
    (_, index) => [before[index] ?? '', after[index] ?? ''] as [string, string]
  );
  const pairs = [
    ...align(split(card.text), split(card.upgradedText)),
    ...align(split(card.moltText), split(card.moltTextUpgraded)),
  ];
  const changed = pairs.find(([before, after]) => after && before !== after);
  if (changed) {
    const [before, after] = compactCardPickerDeltaPair(changed[0], changed[1]);
    return `${before}\n> ${after}`;
  }
  const totals = (upgraded: boolean) => statEntries({ ...card, upgraded }).reduce<Record<string, number>>((result, entry) => {
    result[entry.key] = (result[entry.key] ?? 0) + entry.value;
    return result;
  }, {});
  const beforeStats = totals(false);
  const afterStats = totals(true);
  const statKey = Object.keys(afterStats).find((key) => (afterStats[key] ?? 0) !== (beforeStats[key] ?? 0));
  return statKey
    ? `${statLabel(statKey)} ${beforeStats[statKey] ?? 0}\n> ${afterStats[statKey] ?? 0}`
    : 'ABILITY\n> IMPROVED';
}

function marketInputTargets(scene: any) {
  return scene.children.list.filter((child: any) => (
    child.input?.enabled
    && typeof child.getData?.('marketFocusId') === 'string'
  ));
}

function marketTargetPrice(scene: any, id: string) {
  const [kind, rawIndex] = String(id ?? '').split(':');
  const index = Number(rawIndex);
  if (kind === 'card') return scene.marketCardShelf[index]?.price;
  if (kind === 'waymark') return scene.marketWaymarkShelf[index]?.price;
  if (kind === 'utility') return scene.marketUtilityShelf[index]?.price;
  return kind === 'refresh' ? scene.marketRefreshCost() : undefined;
}

function marketTargetLabel(scene: any, target: any) {
  const label = target?.getData('label') ?? 'Offer';
  const price = marketTargetPrice(scene, target?.getData('marketFocusId'));
  return price === undefined ? label : `${label}, ${price} Scrap`;
}

export function marketWaymarkBuildObservations(scene: any, mark: any) {
  const deck = scene.allMapDeckCards().map(({ card }: any) => card);
  const familyCount = scene.runState.routeMarks.filter((id: string) => scene.marketWaymark(id)?.family === mark.family).length;
  return waymarkBuildRead(
    { trigger: mark.trigger, familyLabel: routeMarkFamilyLabel(mark.family) },
    deck,
    scene.runState.supplies.length,
    familyCount,
  ).notes;
}

export function marketUtilityBuildObservations(scene: any, listing: any) {
  const supply = scene.marketSupply(listing.supplyId);
  if (supply) {
    const observations: string[] = [];
    const supplyMarks = scene.runState.routeMarks.filter((id: string) => scene.marketWaymark(id)?.trigger === 'onSupplyUsed').length;
    if (supplyMarks > 0) observations.push(`+ Triggers ${supplyMarks} carried Supply Waymark${supplyMarks === 1 ? '' : 's'}`);
    const effects = supply.effects.join(' ');
    const healing = effects.match(/healCohesion\((\d+)\)/);
    if (healing) {
      const missing = Math.max(0, scene.runMaxHp() - scene.runState.currentHp);
      observations.push(missing > 0
        ? `+ Restores up to ${Math.min(missing, Number(healing[1]))} missing Cohesion`
        : '! Healing value is low at full Cohesion');
    } else if (/removeCover|damagePierce/.test(effects)) {
      observations.push('+ Adds a one-use anti-Cover answer');
    } else if (supply.timing === 'route') {
      observations.push('+ Adds a route-time planning option');
    } else if (/retainHand|draw\(|gainWingbeat/.test(effects)) {
      observations.push('+ Supports card setup and sequencing');
    } else if (/gainCover|gainOpenSkyGuard|reduceNextOpenSky/.test(effects)) {
      observations.push('+ Adds emergency formation safety');
    } else {
      observations.push('+ Adds a one-use tactical answer');
    }
    return observations.slice(0, 2);
  }
  if (listing.id === 'preen') {
    const count = scene.pickerEligibleCards('preen', 'market').length;
    return [`+ ${count} card${count === 1 ? '' : 's'} offer meaningful upgrades`, '+ Exact change shown before purchase'];
  }
  if (listing.id === 'release') {
    return [`+ Can trim the ${scene.runState.deck.length}-card deck`, '+ Exact card and final cost chosen next'];
  }
  if (listing.id === 'boss_guard') {
    return ['+ Adds boss-burst protection', '+ Stacks with existing next-fight prep'];
  }
  return ['+ Reduces next-fight Open Sky risk', '+ Makes the next route step safer'];
}

export function marketFocusBuildObservations(scene: any) {
  const [kind, rawIndex] = String(scene.marketFocusId ?? '').split(':');
  const index = Number(rawIndex);
  if (kind === 'card') {
    const offer = scene.marketCardOffers()[index];
    return offer && !offer.sold ? scene.routeRewardCardObservations(offer.card).slice(0, 2) : [];
  }
  if (kind === 'waymark') {
    const listing = scene.marketWaymarkShelf[index];
    const mark = listing && !listing.sold ? scene.marketWaymark(listing.id) : undefined;
    return mark ? marketWaymarkBuildObservations(scene, mark) : [];
  }
  if (kind === 'utility') {
    const listing = scene.marketUtilityShelf[index];
    return listing && !listing.sold ? marketUtilityBuildObservations(scene, listing) : [];
  }
  return kind === 'refresh'
    ? ['+ Rerolls every unbought offer', `! Costs rise after refresh ${scene.marketRefreshCount + 1}`]
    : [];
}

export function marketPreview(scene: any, listing: any, preview?: string[]) {
  if (scene.runState.scrap < listing.price) {
    return [`NEED ${listing.price - scene.runState.scrap} MORE SCRAP`];
  }
  if (preview) return preview;
  if (scene.marketUtilityEnabled(listing)) return scene.marketUtilityDecisionPreview(listing);
  return [listing.supplyId ? 'SUPPLY POUCH FULL' : 'NO ELIGIBLE CARD'];
}

export function marketUnavailableOffers(scene: any) {
  if (scene.marketCategory === 'cards') {
    return scene.marketCardOffers()
      .filter((offer: any) => offer.sold || scene.runState.scrap < offer.price)
      .map((offer: any) => ({
        label: displayName(offer.card),
        reason: offer.sold ? 'SOLD OUT' : marketPreview(scene, offer)[0],
      }));
  }
  if (scene.marketCategory === 'waymarks') {
    return scene.marketRouteMarkOffers()
      .filter((offer: any) => offer.sold || scene.runState.scrap < offer.price)
      .map((offer: any) => ({
        label: offer.name,
        reason: offer.sold ? 'SOLD OUT' : marketPreview(scene, offer)[0],
      }));
  }
  const offers = scene.marketUtilityShelf
    .filter((offer: any) => scene.marketCategory === 'supplies' ? offer.id === 'supply' : offer.id !== 'supply')
    .filter((offer: any) => offer.sold || !scene.marketUtilityEnabled(offer))
    .map((offer: any) => ({
      label: scene.marketUtilityLabel(offer),
      reason: offer.sold ? 'SOLD OUT' : marketPreview(scene, offer)[0],
    }));
  if (scene.marketCategory === 'services' && scene.runState.scrap < scene.marketRefreshCost()) {
    offers.push({
      label: 'Refresh stock',
      reason: `NEED ${scene.marketRefreshCost() - scene.runState.scrap} MORE SCRAP`,
    });
  }
  return offers;
}

function activateMarketTarget(scene: any, target: any) {
  const [kind, rawIndex] = String(target?.getData('marketFocusId') ?? '').split(':');
  const index = Number(rawIndex);
  if (kind === 'card') scene.buyMarketCard(index);
  else if (kind === 'waymark') scene.buyMarketRouteMark(index);
  else if (kind === 'utility') scene.buyMarketUtility(index);
  else if (kind === 'refresh') scene.refreshMarket();
  else return false;
  return true;
}

export function resetMarketFocus(scene: any) {
  scene.marketFocusId = undefined;
  scene.marketFocusArmedId = undefined;
  scene.marketBuildObservations = [];
}

export function bindMarketInputs(scene: any) {
  const targets = marketInputTargets(scene);
  const unavailableTargets = scene.children.list.filter((child: any) => (
    child.input?.enabled && child.getData?.('marketFocusId') === 0
  ));
  if (!targets.some((target: any) => target.getData('marketFocusId') === scene.marketFocusId)) {
    scene.marketFocusId = targets[0]?.getData('marketFocusId');
    scene.marketFocusArmedId = undefined;
  }
  scene.marketBuildObservations = marketFocusBuildObservations(scene);
  unavailableTargets.forEach((target: any) => {
    target.on('pointerover', () => {
      if (scene.marketFocusArmedId) {
        scene.hideHoverCardDetail();
        scene.hideMarketItemDetail();
        return;
      }
      scene.children.list.find((child: any) => child.name === 'market-input-focus-ring')
        ?.setVisible(false);
      scene.updateTextState();
    });
    target.on('pointerout', () => {
      scene.children.list.find((child: any) => child.name === 'market-input-focus-ring')
        ?.setVisible(Boolean(scene.marketFocusId));
      scene.updateTextState();
    });
    target.on('pointerdown', (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event?: Phaser.Types.Input.EventData,
    ) => {
      event?.stopPropagation();
      resetMarketFocus(scene);
      scene.children.list.find((child: any) => child.name === 'market-input-focus-ring')
        ?.setVisible(false);
      scene.updateTextState();
    });
  });
  targets.forEach((target: any) => {
    const id = target.getData('marketFocusId');
    target.on('pointerover', () => {
      if (scene.marketFocusArmedId) {
        if (scene.marketFocusId !== id) scene.hideHoverCardDetail();
        return;
      }
      if (scene.marketFocusId === id) return;
      scene.marketFocusId = id;
      scene.marketBuildObservations = marketFocusBuildObservations(scene);
      scene.children.list.find((child: any) => child.name === 'market-input-focus-ring')
        ?.setPosition(target.x, target.y)
        .setDisplaySize(target.displayWidth + 8, target.displayHeight + 8)
        .setStrokeStyle(3, 0x8df4ff, 1);
      scene.updateTextState();
    });
    target.on('pointerdown', (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event?: Phaser.Types.Input.EventData,
    ) => {
      event?.stopPropagation();
      if (scene.marketFocusArmedId === id) {
        resetMarketFocus(scene);
        activateMarketTarget(scene, target);
        return;
      }
      scene.marketFocusId = id;
      scene.marketFocusArmedId = id;
      scene.renderAll();
    });
    if (scene.marketFocusId === id) {
      scene.add.rectangle(target.x, target.y, target.displayWidth + 8, target.displayHeight + 8, 0x000000, 0)
        .setStrokeStyle(3, scene.marketFocusArmedId === id ? 0xffcf70 : 0x8df4ff, 1)
        .setName('market-input-focus-ring');
    }
  });
}

export function cycleMarketFocus(scene: any, direction: -1 | 1) {
  const targets = marketInputTargets(scene);
  if (targets.length === 0) return false;
  const current = targets.findIndex((target: any) => target.getData('marketFocusId') === scene.marketFocusId);
  const next = current < 0 ? 0 : (current + direction + targets.length) % targets.length;
  scene.marketFocusId = targets[next].getData('marketFocusId');
  scene.marketFocusArmedId = undefined;
  scene.renderAll();
  return true;
}

export function activateMarketFocus(scene: any) {
  const target = marketInputTargets(scene)
    .find((candidate: any) => candidate.getData('marketFocusId') === scene.marketFocusId);
  if (!target) return false;
  resetMarketFocus(scene);
  return activateMarketTarget(scene, target);
}

export function cycleMarketCategory(scene: any, direction: -1 | 1) {
  const categories = ['cards', 'waymarks', 'supplies', 'services'];
  const current = Math.max(0, categories.indexOf(scene.marketCategory));
  scene.setMarketCategory(categories[(current + direction + categories.length) % categories.length]);
}

export function renderMarketInputHelp(scene: Phaser.Scene, x: number, y: number) {
  const owner = scene as any;
  const target = marketInputTargets(owner)
    .find((candidate: any) => candidate.getData('marketFocusId') === owner.marketFocusId);
  const armed = !!target && owner.marketFocusArmedId === owner.marketFocusId;
  const label = marketTargetLabel(owner, target);
  scene.add.rectangle(x, y, 760, 32, 0x020409, 0.9)
    .setStrokeStyle(1, armed ? 0xffcf70 : 0x49606d, armed ? 0.9 : 0.5)
    .setDepth(23050)
    .setName('market-input-help');
  scene.add.text(
    x,
    y,
    armed
      ? `CONFIRM ${label.toUpperCase()}   |   ENTER / A / TAP AGAIN   |   BACK  CANCEL`
      : 'LEFT / RIGHT  OFFER   |   ENTER / A  BUY   |   1-4 / LB / RB  SECTION',
    {
      fontFamily: 'Arial',
      fontSize: '12px',
      fontStyle: 'bold',
      color: armed ? '#ffe1a3' : '#dffbff',
      align: 'center',
      fixedWidth: 742,
    },
  ).setOrigin(0.5).setDepth(23051).setName('market-input-help');
}

export function renderMarketCategoryTabs(
  scene: any,
  top: number,
  touchTarget: number,
  accents: number[],
) {
  const tabs = [
    ['cards', 'Crew Cards'],
    ['waymarks', 'Waymarks'],
    ['supplies', 'Supplies'],
    ['services', 'Services'],
  ];
  tabs.forEach(([id, label], index) => {
    const x = 450 + index * 156;
    const selected = scene.marketCategory === id;
    const accent = accents[index];
    const visual = scene.add.rectangle(x, top + 86, 140, 34, selected ? 0x152637 : 0x07101a, 0.94)
      .setStrokeStyle(1, selected ? accent : 0x49606d, selected ? 0.94 : 0.42)
      .setName('market-category-tab');
    scene.add.text(x, top + 86, label, {
      fontFamily: 'Arial',
      fontSize: '12px',
      fontStyle: 'bold',
      color: selected ? '#fff0c7' : '#91a6b8',
    }).setOrigin(0.5).setName('market-category-tab');
    const hit = scene.add.rectangle(x, top + 86, 140, touchTarget, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('market-category-tab-hit')
      .setData('label', label);
    hit.on('pointerover', () => visual.setFillStyle(selected ? 0x1d3349 : 0x10202c, 0.98));
    hit.on('pointerout', () => visual.setFillStyle(selected ? 0x152637 : 0x07101a, 0.94));
    hit.on('pointerdown', () => scene.setMarketCategory(id));
  });
}

export function renderMarketSectionHeader(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  title: string,
  subtitle: string,
  accent: number,
  frameKey: string,
) {
  const hasFrame = scene.textures.exists(frameKey);
  if (hasFrame) {
    scene.textures.get(frameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    scene.add.image(x, y + 20, frameKey)
      .setDisplaySize(width + 42, 60)
      .setAlpha(0.88)
      .setName('market-section-header-frame');
    scene.add.rectangle(x, y + 20, Math.max(96, width - 52), 31, 0x020409, 0.18);
  } else {
    scene.add.rectangle(x, y, width, 1, accent, 0.72);
  }
  scene.add.rectangle(x - width / 2 + 18, y + 20, 4, 28, accent, hasFrame ? 0.86 : 0.78);
  scene.add.text(x - width / 2 + 30, y + 8, title.toUpperCase(), {
    fontFamily: 'Arial',
    fontSize: '10px',
    fontStyle: 'bold',
    color: '#ffe1a3',
  });
  scene.add.text(x - width / 2 + 30, y + 23, subtitle, {
    fontFamily: 'Arial',
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#8fa3b6',
  });
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
  scene.cardPickerArmedIndex = entries[scene.cardPickerFocusIndex]?.index;
  scene.renderAll();
  return true;
}

export function openCardPickerInspection(scene: any, focusIndex = scene.cardPickerFocusIndex) {
  const entries = cardPickerEntries(scene);
  if (entries.length === 0) return undefined;
  scene.cardPickerFocusIndex = Phaser.Math.Clamp(Math.round(focusIndex ?? 0), 0, entries.length - 1);
  scene.cardPickerArmedIndex = undefined;
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
  focusIndex: number,
) {
  const owner = scene as any;
  const focused = (owner.cardPickerFocusIndex ?? 0) === focusIndex;
  const armed = owner.cardPickerArmedIndex === entry.index;
  selection.on('pointerover', () => {
    owner.cardPickerFocusIndex = focusIndex;
    owner.hideHoverCardDetail();
    selection.setStrokeStyle(2, armed ? 0xffcf70 : accent, 0.92);
    owner.updateTextState();
  });
  selection.on('pointerout', () => selection.setStrokeStyle());
  if (focused) {
    scene.add.rectangle(x, y, cardWidth + 16, cardHeight + 16, 0x000000, 0)
      .setStrokeStyle(3, armed ? 0xffcf70 : 0x8df4ff, 1)
      .setName('card-picker-input-focus-ring');
  }
  if (focusIndex === owner.cardPickerScroll * 5) {
    renderCardPickerInspectControl(scene, 342, 301, 224, accent);
  }
}

export function renderCardPickerInspectControl(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  accent: number,
) {
  const owner = scene as any;
  const inspect = scene.add.rectangle(x, y, width, 64, 0x102534, 0.98)
    .setStrokeStyle(2, accent, 0.9)
    .setInteractive({ useHandCursor: true })
    .setName('card-picker-card-inspect-hit');
  inspect.setData('label', 'Inspect focused card');
  inspect.on('pointerover', () => inspect.setFillStyle(0x173a50, 1).setStrokeStyle(2, 0x8df4ff, 1));
  inspect.on('pointerout', () => inspect.setFillStyle(0x102534, 0.98).setStrokeStyle(2, accent, 0.9));
  inspect.on('pointerdown', (
    _pointer: Phaser.Input.Pointer,
    _localX: number,
    _localY: number,
    event?: Phaser.Types.Input.EventData,
  ) => {
    event?.stopPropagation();
    openCardPickerInspection(owner, owner.cardPickerFocusIndex);
  });
  scene.add.text(x, y - 9, 'INSPECT FOCUSED', {
    fontFamily: 'Arial',
    fontSize: '12px',
    fontStyle: 'bold',
    color: '#dffbff',
  }).setOrigin(0.5).setName('card-picker-card-inspect-label');
  scene.add.text(x, y + 12, 'FULL CARD  ·  R / Y', {
    fontFamily: 'Arial',
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#91b9c8',
  }).setOrigin(0.5).setName('card-picker-card-inspect-binding');
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
  scene.routeRewardArmedCardId = scene.routeCardRewardChoices[scene.routeRewardChoiceIndex]?.id;
  scene.renderAll();
  return true;
}

export function setRouteRewardChoice(scene: any, cardId: string) {
  const index = scene.routeCardRewardChoices.findIndex((card: any) => card.id === cardId);
  if (index >= 0 && !scene.routeRewardArmedCardId) scene.routeRewardChoiceIndex = index;
}

export function requestRouteRewardCard(scene: any, cardId: string, onArm: () => void) {
  const index = scene.routeCardRewardChoices.findIndex((card: any) => card.id === cardId);
  if (index < 0) return;
  scene.routeRewardChoiceIndex = index;
  if (scene.routeRewardArmedCardId !== cardId) {
    scene.routeRewardArmedCardId = cardId;
    scene.hideHoverCardDetail();
    onArm();
    scene.renderAll();
    return;
  }
  scene.routeRewardArmedCardId = undefined;
  scene.chooseRouteRewardCard(cardId);
}

export function openRouteRewardInspection(scene: any, cardId: string) {
  const index = scene.routeCardRewardChoices.findIndex((card: any) => card.id === cardId);
  if (index < 0) return undefined;
  const armedReturnIndex = scene.routeRewardArmedCardId
    ? scene.routeCardRewardChoices.findIndex((card: any) => card.id === scene.routeRewardArmedCardId)
    : -1;
  scene.routeRewardChoiceIndex = armedReturnIndex >= 0 ? armedReturnIndex : index;
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

function activeCombatRewards(scene: any): any[] {
  if (scene.mode === 'waymarkReward') return scene.waymarkChoices;
  if (scene.mode === 'cardReward') return scene.rewardChoices;
  if (scene.mode === 'upgradeReward') return scene.upgradeChoices;
  return [];
}

export function armCombatRewardAt(scene: any, index: number) {
  const reward = activeCombatRewards(scene)[index];
  if (reward) scene.rewardChoiceArmedId = reward.id;
}

export function requestCombatReward(scene: any, choiceId: string, onArm: () => void) {
  const choices = activeCombatRewards(scene);
  const index = choices.findIndex((choice: any) => choice.id === choiceId);
  if (index < 0) return false;
  scene.rewardSkipArmed = false;
  scene.battleInputActive = true;
  scene.controllerChoiceIndex = index;
  if (scene.rewardChoiceArmedId !== choiceId) {
    scene.rewardChoiceArmedId = choiceId;
    scene.hideCardPreview();
    onArm();
    scene.requestBattleRender();
    return true;
  }
  scene.rewardChoiceArmedId = undefined;
  if (scene.mode === 'waymarkReward') scene.chooseWaymarkReward(choiceId);
  else if (scene.mode === 'cardReward') scene.chooseRewardCard(choiceId);
  else scene.chooseUpgradeCard(choiceId);
  return true;
}

export function requestCombatRewardAt(scene: any, index: number, onArm: () => void) {
  const reward = activeCombatRewards(scene)[index];
  return reward ? requestCombatReward(scene, reward.id, onArm) : false;
}

export function renderCombatRewardLoading(scene: any) {
  const target = scene.root as Phaser.GameObjects.Container;
  const waymark = scene.mode === 'waymarkReward';
  const cardReward = scene.mode === 'cardReward';
  const title = cardReward ? 'Add to the Flock' : scene.mode === 'upgradeReward' ? 'Preen a Card' : 'Claim a Waymark';
  const choiceY = waymark ? 404 : 402;
  const choiceWidth = waymark ? 248 : 228;
  const choiceHeight = waymark ? 306 : 312;
  target.add(scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.9).setName('reward-loading-backdrop'));
  target.add(scene.add.rectangle(640, 98, 612, 114, 0x07101c, 0.82)
    .setStrokeStyle(2, 0xd8a840, 0.46)
    .setName('reward-loading-header'));
  target.add(scene.add.text(640, 64, 'ROOFTOP LANDMARK', {
    fontFamily: UI_FONT, fontSize: '12px', fontStyle: UI_BOLD, color: UI_CYAN
  }).setOrigin(0.5));
  target.add(scene.add.text(640, 91, title, {
    fontFamily: UI_FONT, fontSize: '34px', fontStyle: UI_BOLD, color: UI_GOLD,
    align: 'center', fixedWidth: 1060, fixedHeight: 52, maxLines: 1
  }).setOrigin(0.5).setName('reward-loading-title'));
  target.add(scene.add.text(640, 128, 'Preparing choices · Input unlocks when every option is visible.', {
    fontFamily: UI_FONT, fontSize: '15px', color: UI_SOFT,
    align: 'center', fixedWidth: 1020, fixedHeight: 28, maxLines: 1
  }).setOrigin(0.5).setName('reward-renderer-loading'));
  [336, 640, 944].forEach((x) => {
    target.add(scene.add.rectangle(x, choiceY, choiceWidth, choiceHeight, 0x07101c, 0.86)
      .setStrokeStyle(2, 0x49606d, 0.66)
      .setName('reward-loading-choice-slot'));
    target.add(scene.add.rectangle(x, choiceY - 82, choiceWidth - 34, 118, 0x10202d, 0.72));
    target.add(scene.add.rectangle(x, choiceY + 22, choiceWidth - 58, 12, 0x263847, 0.72));
    target.add(scene.add.rectangle(x, choiceY + 48, choiceWidth - 86, 8, 0x263847, 0.54));
    if (!waymark) target.add(scene.add.rectangle(x, 586, 92, MIN_SUPPORTED_TOUCH_TARGET, 0x102534, 0.58)
      .setStrokeStyle(2, 0x49606d, 0.54)
      .setName('reward-loading-inspect-slot'));
  });
  if (cardReward) target.add(scene.add.rectangle(640, 652, 324, 48, 0x2a2320, 0.58)
    .setStrokeStyle(2, 0xd8a840, 0.46)
    .setName('reward-loading-skip-slot'));
}

export function renderRewardSkipFallback(scene: any) {
  const target = scene.root as Phaser.GameObjects.Container;
  const scrap = scene.currentSkipScrapReward();
  const deckSize = scene.allDeckCards().length;
  const armed = Boolean(scene.rewardSkipArmed);
  const hit = scene.add.rectangle(640, 652, 324, 48, 0x2a2320, 0.96)
    .setStrokeStyle(2, 0xd8a840, 0.9)
    .setInteractive({ useHandCursor: true })
    .setName('reward-skip-hit');
  hit.on('pointerdown', () => scene.requestSkipCardReward());
  target.add(hit);
  if (armed) target.add(scene.add.rectangle(640, 652, 344, 68, 0x000000, 0)
    .setStrokeStyle(3, 0xd8a840, 1)
    .setName('reward-skip-focus-ring'));
  target.add(scene.add.text(640, 646, `Skip  +${scrap} Scrap`, {
    fontFamily: UI_FONT, fontSize: '15px', fontStyle: UI_BOLD, color: UI_GOLD,
  }).setOrigin(0.5).setName('reward-skip-title'));
  target.add(scene.add.text(640, 664, `Deck stays ${deckSize}  /  After: ${scene.scrap + scrap} Scrap`, {
    fontFamily: UI_FONT, fontSize: '10px', color: UI_SOFT,
  }).setOrigin(0.5).setName('reward-skip-summary'));
}

function compactFallbackDecisionPart(text: string, max = 12) {
  const value = text.replace(/\s+/g, ' ').replace(/[.]$/, '').trim();
  return value.length <= max ? value : `${value.slice(0, max - 3).trimEnd()}...`;
}

function fallbackCardDecisionLabel(view: any) {
  const preview = view.decisionPreview;
  if (preview.kind === 'add') return `ADD  /  DECK ${preview.deckBefore} > ${preview.deckBefore + 1}`;
  const beforeParts = preview.before.split(/[.;]\s+/);
  const afterParts = preview.after.split(/[.;]\s+/);
  const moltBeforeParts = preview.moltBefore.split(/[.;]\s+/);
  const moltAfterParts = preview.moltAfter.split(/[.;]\s+/);
  const pairs: Array<[string, string]> = [
    ...beforeParts.map((before: string, index: number) => [before, afterParts[index] ?? ''] as [string, string]),
    ...moltBeforeParts.map((before: string, index: number) => [before, moltAfterParts[index] ?? ''] as [string, string]),
  ];
  const changed = pairs.find(([before, after]) => before !== after && after) ?? pairs.find(([, after]) => after);
  const change = changed
    ? `${compactFallbackDecisionPart(changed[0])} > ${compactFallbackDecisionPart(changed[1])}`
    : preview.statChanges[0] ?? 'Ability improved';
  return `PREEN  /  ${change}`;
}

function fallbackWaymarkContextLabel(view: any) {
  const rarity = view.rarity.toUpperCase();
  const family = view.familyLabel.toUpperCase();
  return rarity === family ? `${rarity} WAYMARK` : `${rarity}  /  ${family}`;
}

export function renderCombatRewardFallback(scene: any) {
  const waymark = scene.mode === 'waymarkReward';
  const choiceY = waymark ? 404 : 402;
  const choices = waymark ? scene.waymarkChoices : scene.mode === 'cardReward' ? scene.rewardChoices : scene.upgradeChoices;
  const target = scene.root as Phaser.GameObjects.Container;
  target.add(scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.9));
  target.add(scene.add.text(640, 90, waymark ? 'Claim a Waymark' : scene.mode === 'upgradeReward' ? 'Preen a Card' : 'Add to the Flock', {
    fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#ffe08a'
  }).setOrigin(0.5));
  choices.forEach((choice: any, index: number) => {
    const x = 336 + index * 304;
    const view = waymark ? scene.rewardWaymarkView(choice, index) : scene.rewardCardView(choice, index);
    const build = waymark
      ? waymarkBuildRead(view, scene.allDeckCards(), scene.runSupplies.length, view.familyCount)
      : undefined;
    if (build) scene.waymarkRewardBuildObservations[view.id] = build.notes;
    const hit = scene.add.rectangle(x, choiceY, 248, 300, 0x07101c, 0.98)
      .setStrokeStyle(2, view.accent, 0.9)
      .setInteractive({ useHandCursor: true })
      .setName('reward-fallback-choice-hit');
    hit.on('pointerdown', () => scene.requestRewardChoice(view.id));
    target.add(hit);
    if (view.focused) target.add(scene.add.rectangle(x, choiceY, 278, 336, 0x000000, 0)
      .setStrokeStyle(3, view.armed ? 0xd8a840 : 0x8df4ff, 1).setName('reward-input-focus-ring'));
    if (waymark || view.focused || view.armed) {
      const contextLabel = waymark
        ? fallbackWaymarkContextLabel(view)
        : fallbackCardDecisionLabel(view);
      target.add(scene.add.rectangle(x, 264, 204, 26, 0x06111a, 0.98)
        .setStrokeStyle(1, view.accent, 0.86)
        .setName('reward-fallback-context-chip'));
      target.add(scene.add.text(x, 264, contextLabel, {
        fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#f4f8fb',
        align: 'center', fixedWidth: 196, maxLines: 1
      }).setOrigin(0.5).setName('reward-fallback-decision-context'));
    }
    target.add(scene.add.text(x, 342, view.name, {
      fontFamily: 'Arial', fontSize: '21px', fontStyle: 'bold', color: '#ffe08a',
      align: 'center', wordWrap: { width: 210 }
    }).setOrigin(0.5).setName('reward-fallback-choice-name'));
    target.add(scene.add.text(x, 420, waymark ? view.description : view.summary, {
      fontFamily: 'Arial', fontSize: '14px', color: '#dce8f2',
      align: 'center', wordWrap: { width: 206 }, maxLines: 4
    }).setOrigin(0.5));
    if (build) {
      target.add(scene.add.text(x, 494, 'BUILD READ', {
        fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#ffcf6b'
      }).setOrigin(0.5).setName('reward-waymark-build-read-title'));
      build.notes.forEach((note, noteIndex) => target.add(scene.add.text(x, 511 + noteIndex * 15, note, {
        fontFamily: 'Arial', fontSize: '9px', fontStyle: 'bold', color: note.startsWith('!') ? '#ffd0b3' : '#dffbff',
        align: 'center', fixedWidth: 214, maxLines: 1
      }).setOrigin(0.5).setName('reward-waymark-build-observation')));
    }
    if (!waymark && scene.mode === 'upgradeReward' && !view.focused) {
      target.add(scene.add.text(x, 516, fallbackCardDecisionLabel(view).slice(10), {
        fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#b8f5ff',
        align: 'center', fixedWidth: 216, maxLines: 1
      }).setOrigin(0.5).setName('reward-preen-change'));
    }
    if (!waymark) renderRewardInspectButton({
      scene,
      target,
      x,
      y: 586,
      accent: view.accent,
      fontFamily: 'Arial',
      boldFontStyle: 'bold',
      enabled: !(scene.mode === 'cardReward' && scene.rewardSkipArmed),
      onInspect: () => scene.openRewardCardInspection(view.id),
    });
  });
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
  if (scene.marketOpen) {
    const controls: Array<[string, boolean, () => void]> = [
      ['market-previous', pad.left || pad.up, () => cycleMarketFocus(scene, -1)],
      ['market-next', pad.right || pad.down, () => cycleMarketFocus(scene, 1)],
      ['market-confirm', pad.A, () => activateMarketFocus(scene)],
    ];
    controls.forEach(([id, pressed, action]) => {
      if (pressed && !buttonsDown.has(id)) action();
      if (pressed) buttonsDown.add(id);
      else buttonsDown.delete(id);
    });
    return true;
  }
  if (!scene.pendingRouteReward || (scene.routeCardRewardChoices.length === 0 && scene.routeSupplyRewardChoices.length < 2)) return false;
  const controls: Array<[string, boolean, () => void]> = [
    ['reward-previous', pad.left || pad.up, () => scene.routeSupplyRewardChoices.length > 1 ? scene.cycleRouteSupplyRewardChoice(-1) : scene.cycleRouteRewardChoice(-1)],
    ['reward-next', pad.right || pad.down, () => scene.routeSupplyRewardChoices.length > 1 ? scene.cycleRouteSupplyRewardChoice(1) : scene.cycleRouteRewardChoice(1)],
    ['reward-confirm', pad.A, () => {
      if (scene.routeRewardInspectionCardId) {
        scene.closeRouteRewardInspection();
        return;
      }
      if (scene.routeSupplyRewardChoices.length > 1) {
        const supply = scene.focusedRouteSupplyReward();
        if (supply) scene.requestRouteSupplyReward(supply.id);
        return;
      }
      const card = scene.focusedRouteRewardCard();
      if (card) scene.requestRouteRewardCard(card.id);
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
      else if (scene.cardPickerArmedIndex !== undefined) {
        scene.cardPickerArmedIndex = undefined;
        scene.renderAll();
      }
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
        scene.requestCardPick(entry.index);
      }
    }
    return true;
  }
  if (scene.marketOpen) {
    if (action === 'previous' || action === 'next') {
      cycleMarketFocus(scene, action === 'previous' ? -1 : 1);
      return true;
    }
    if (action === 'confirm') return activateMarketFocus(scene);
    if (action === 'back' && scene.marketFocusArmedId) {
      scene.marketFocusArmedId = undefined;
      scene.renderAll();
      return true;
    }
    return false;
  }
  if (action === 'back') {
    if (scene.routeRewardInspectionCardId) scene.closeRouteRewardInspection();
    else if (scene.routeRewardArmedCardId) {
      scene.routeRewardArmedCardId = undefined;
      scene.renderAll();
    } else if (scene.routeSupplyRewardArmedId) {
      scene.routeSupplyRewardArmedId = undefined;
      scene.renderAll();
    } else if (scene.pendingRouteReward) scene.cancelRouteCardReward();
    else return false;
    return true;
  }
  if (!scene.pendingRouteReward) return false;
  if (scene.routeSupplyRewardChoices.length > 1) {
    if (action === 'previous' || action === 'next') {
      scene.cycleRouteSupplyRewardChoice(action === 'previous' ? -1 : 1);
    } else if (action === 'confirm') {
      const supply = scene.focusedRouteSupplyReward();
      if (supply) scene.requestRouteSupplyReward(supply.id);
    }
    return true;
  }
  if (scene.routeCardRewardChoices.length === 0) return false;
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
    if (card) scene.requestRouteRewardCard(card.id);
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
  fontFamily: string;
  boldFontStyle: string;
  enabled?: boolean;
  onInspect: () => void;
}) {
  const { scene, target, x, y } = context;
  const enabled = context.enabled !== false;
  const hit = scene.add.rectangle(
    x,
    y,
    132,
    MIN_SUPPORTED_TOUCH_TARGET,
    enabled ? 0x102534 : 0x0a141c,
    enabled ? 0.88 : 0.48,
  )
    .setStrokeStyle(2, enabled ? context.accent : 0x49606d, enabled ? 0.9 : 0.42)
    .setData('disabled', !enabled)
    .setName('reward-card-inspect-hit');
  if (enabled) {
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event?: Phaser.Types.Input.EventData,
    ) => {
      event?.stopPropagation();
      context.onInspect();
    });
    hit.on('pointerover', () => hit.setFillStyle(0x18384b, 1));
    hit.on('pointerout', () => hit.setFillStyle(0x102534, 0.88));
  }
  target.add(hit);
  target.add(scene.add.text(x, y, 'INSPECT', {
    fontFamily: context.fontFamily,
    fontSize: '11px',
    fontStyle: context.boldFontStyle,
    color: enabled ? '#dffbff' : '#667b89',
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
  returnLabel: string;
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
  layer.add(scene.add.text(width / 2, height - 34, `${context.backLabel} / B / TAP OUTSIDE  ${context.returnLabel}`, {
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
  returnLabel: string;
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
