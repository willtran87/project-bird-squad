import Phaser from 'phaser';
import {
  addRewardRevealHaloFx,
  addUiIconImage,
  displayName,
  routeEffectTokens,
  routeNodeTypeLabel,
  UI_BOLD,
  UI_CYAN,
  UI_FIELD,
  UI_FONT,
  UI_GOLD,
  UI_SOFT,
} from '../main';
import { MIN_SUPPORTED_TOUCH_TARGET } from './theme';

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
}

export function bindMarketInputs(scene: any) {
  const targets = marketInputTargets(scene);
  if (!targets.some((target: any) => target.getData('marketFocusId') === scene.marketFocusId)) {
    scene.marketFocusId = targets[0]?.getData('marketFocusId');
    scene.marketFocusArmedId = undefined;
  }
  targets.forEach((target: any) => {
    const id = target.getData('marketFocusId');
    target.on('pointerover', () => {
      if (scene.marketFocusId === id) return;
      scene.marketFocusId = id;
      scene.marketFocusArmedId = undefined;
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
    .find((candidate: any) => candidate.getData('marketFocusId') === scene.marketFocusId)
    ?? marketInputTargets(scene)[0];
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
  const armed = owner.marketFocusArmedId === owner.marketFocusId;
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
  if (index >= 0) {
    if (scene.routeRewardArmedCardId !== cardId) scene.routeRewardArmedCardId = undefined;
    scene.routeRewardChoiceIndex = index;
  }
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
  scene.routeRewardChoiceIndex = index;
  scene.routeRewardArmedCardId = undefined;
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

export function renderCombatRewardFallback(scene: any) {
  const waymark = scene.mode === 'waymarkReward';
  const choices = waymark ? scene.waymarkChoices : scene.mode === 'cardReward' ? scene.rewardChoices : scene.upgradeChoices;
  const target = scene.root as Phaser.GameObjects.Container;
  target.add(scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.9));
  target.add(scene.add.text(640, 90, waymark ? 'Claim a Waymark' : scene.mode === 'upgradeReward' ? 'Preen a Card' : 'Add to the Flock', {
    fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#ffe08a'
  }).setOrigin(0.5));
  choices.forEach((choice: any, index: number) => {
    const x = 336 + index * 304;
    const view = waymark ? scene.rewardWaymarkView(choice, index) : scene.rewardCardView(choice, index);
    const hit = scene.add.rectangle(x, 390, 248, 300, 0x07101c, 0.98)
      .setStrokeStyle(view.focused ? 5 : 3, view.armed ? 0xffcf6b : view.focused ? 0x8df4ff : view.accent, 0.95)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => scene.requestRewardChoice(view.id));
    target.add(hit);
    if (view.focused) target.add(scene.add.rectangle(x, 390, 278, 336, 0x000000, 0)
      .setStrokeStyle(4, view.armed ? 0xffcf6b : 0x8df4ff, 1).setName('reward-input-focus-ring'));
    target.add(scene.add.text(x, 342, `${view.armed ? 'CONFIRM / ' : ''}${view.name}`, {
      fontFamily: 'Arial', fontSize: '21px', fontStyle: 'bold', color: '#ffe08a',
      align: 'center', wordWrap: { width: 210 }
    }).setOrigin(0.5));
    target.add(scene.add.text(x, 420, waymark ? view.description : view.summary, {
      fontFamily: 'Arial', fontSize: '14px', color: '#dce8f2',
      align: 'center', wordWrap: { width: 206 }, maxLines: 4
    }).setOrigin(0.5));
    if (!waymark) renderRewardInspectButton({
      scene,
      target,
      x,
      y: 574,
      accent: view.accent,
      focused: view.focused,
      fontFamily: 'Arial',
      boldFontStyle: 'bold',
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
    } else if (scene.pendingRouteReward) scene.cancelRouteCardReward();
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
