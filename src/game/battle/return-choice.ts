import Phaser from 'phaser';
import { bindChoiceHint } from '../choice-input-hints';
import { controlBindingLabel } from '../input-bindings';
import { fitTextExcerpt } from '../text-excerpt';

export interface ReturnChoiceState {
  source: string;
  filter: string;
  drawAfter: number;
  candidateIds: string[];
  focusIndex: number;
  rulesPage?: number;
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
  const visibleRows = Math.min(5, choice.candidateIds.length);
  const rowHeight = 70;
  const rowStep = 70;
  const panelX = gameWidth / 2;
  const panelY = gameHeight / 2;
  const panelWidth = 1060;
  const panelHeight = 600;
  const panelTop = panelY - panelHeight / 2;
  const panelBottom = panelY + panelHeight / 2;
  const maxStart = Math.max(0, choice.candidateIds.length - visibleRows);
  const start = Phaser.Math.Clamp(choice.focusIndex - Math.floor(visibleRows / 2), 0, maxStart);
  const visibleIds = choice.candidateIds.slice(start, start + visibleRows);
  const label = (x: number, y: number, copy: string, size: number, color: string, name = '') =>
    scene.add.text(x, y, copy, { fontFamily, fontSize: `${size}px`, color })
      .setOrigin(0.5).setName(`combat-return-choice-${name}`);

  target.add(scene.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, 0x02050b, 0.9)
    .setInteractive().setName('combat-return-choice-scrim'));
  target.add(scene.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x07101c, 0.99)
    .setStrokeStyle(1, gold, 0.65)
    .setName('combat-return-choice-panel'));
  target.add(label(panelX, panelTop + 34, 'Return a card', 26, '#fff0b8', 'title').setFontStyle(boldFontStyle));
  target.add(label(panelX, panelTop + 70, `Choose one from discard${choice.drawAfter > 0 ? `, then draw ${choice.drawAfter}` : ''}. This choice is required.`, 17, '#cfe7ee', 'source'));

  visibleIds.forEach((instanceId, visibleIndex) => {
    const absoluteIndex = start + visibleIndex;
    const card = options.cards.find((candidate) => candidate.instanceId === instanceId);
    if (!card) return;
    const focused = absoluteIndex === choice.focusIndex;
    const y = panelTop + 151 + visibleIndex * rowStep;
    const hit = scene.add.rectangle(panelX - 278, y, 448, rowHeight, focused ? 0x23312c : 0x0d1926, 0.98)
      .setStrokeStyle(focused ? 2 : 1, focused ? gold : cyan, focused ? 0.9 : 0.2)
      .setInteractive({ useHandCursor: true })
      .setName('combat-return-choice-row')
      .setData('instanceId', card.instanceId)
      .setData('focused', focused);
    // Read before committing, including on touch. Hover must not move the
    // scrolling window underneath the pointer or replace its pending click.
    hit.on('pointerdown', () => options.onFocus(card.instanceId));
    target.add(hit);
    target.add(label(panelX - 477, y, `${absoluteIndex + 1}`, 16, focused ? '#fff0b8' : '#8fb3bf', 'index'));
    target.add(fitTextExcerpt(scene.add.text(panelX - 446, y - 12, '', {
      fontFamily, fontSize: '20px', fontStyle: boldFontStyle, color: focused ? '#fff0b8' : '#f4fdff', wordWrap: { width: 370, useAdvancedWrap: true },
    }).setOrigin(0, 0.5).setName('combat-return-choice-name'), card.name, 1));
    target.add(fitTextExcerpt(scene.add.text(panelX - 446, y + 15, '', {
      fontFamily, fontSize: '16px', color: '#9fc3cf', wordWrap: { width: 370, useAdvancedWrap: true },
    }).setOrigin(0, 0.5).setName('combat-return-choice-meta'), `${card.cost} Wingbeat${card.cost === 1 ? '' : 's'} · ${card.role}`, 1));
  });

  const focusedPosition = choice.focusIndex + 1;
  const button = (x: number, y: number, width: number, copy: string, name: string, action: () => void) => {
    const hit = scene.add.rectangle(x, y, width, 58, 0x19312f).setStrokeStyle(1, gold, 0.65)
      .setInteractive({ useHandCursor: true }).setName(name);
    hit.on('pointerdown', action);
    target.add([hit, label(x, y, copy, 18, '#fff0b8')]);
    return hit;
  };
  if (choice.candidateIds.length > visibleRows) {
    const move = (step: number) => options.onFocus(choice.candidateIds[(choice.focusIndex + step + choice.candidateIds.length) % choice.candidateIds.length]);
    button(panelX - 413, panelBottom - 86, 150, 'Previous', 'combat-return-choice-previous', () => move(-1));
    button(panelX - 143, panelBottom - 86, 150, 'Next', 'combat-return-choice-next', () => move(1));
  }
  target.add(label(panelX - 278, panelBottom - 86, `${focusedPosition} / ${choice.candidateIds.length}`, 16, '#cfe7ee', 'position'));

  const card = options.cards.find(candidate => candidate.instanceId === choice.candidateIds[choice.focusIndex]);
  let hasRulePages = false;
  if (card) {
    // A dedicated reader retains the entire source. Long rules are paginated,
    // never silently clipped to the old two-line, 11px row summary.
    const text = scene.add.text(panelX + 4, panelTop + 118, '', {
      fontFamily, fontSize: '22px', color: '#e4eff2', wordWrap: { width: 486, useAdvancedWrap: true }, lineSpacing: 5,
    }).setName('combat-return-choice-summary');
    const source = `${card.name}\n${card.cost} Wingbeat${card.cost === 1 ? '' : 's'} · ${card.role}\n\n${card.summary}`;
    const lines = text.getWrappedText(source);
    const pageSize = 10;
    const pages = Math.max(1, Math.ceil(lines.length / pageSize));
    let page = Phaser.Math.Clamp(choice.rulesPage ?? 0, 0, pages - 1);
    const showPage = () => text.setText(lines.slice(page * pageSize, (page + 1) * pageSize).join('\n'))
      .setData({ fullText: source, page, pages });
    showPage();
    target.add(text);
    if (pages > 1) {
      hasRulePages = true;
      const counter = label(panelX + 247, panelBottom - 146, '', 16, '#cfe7ee');
      const update = (step: number) => { page = (page + step + pages) % pages; choice.rulesPage = page; showPage(); counter.setText(`Rules ${page + 1}/${pages}`); };
      text.setData('turnPage', update);
      button(panelX + 74, panelBottom - 146, 140, 'Earlier rules', 'combat-return-rules-previous', () => update(-1));
      button(panelX + 420, panelBottom - 146, 140, 'More rules', 'combat-return-rules-next', () => update(1));
      target.add(counter);
      update(0);
    }
    button(panelX + 247, panelBottom - 86, 486, 'Return selected card', 'combat-return-choice-confirm', () => options.onChoose(choice.candidateIds[choice.focusIndex]));
  }
  const hint = label(panelX, panelBottom - 30, '', 16, '#b6cdd4', 'hint');
  target.add(bindChoiceHint(scene, hint, mode => mode === 'pointer'
    ? 'Select a card to read · Return selected card to continue'
    : `${mode === 'controller' ? 'D-pad' : `${controlBindingLabel('previous')}/${controlBindingLabel('next')}`}: choose · ${mode === 'controller' ? 'A' : controlBindingLabel('confirm')}: return selected card${hasRulePages ? ` · ${mode === 'controller' ? 'LB/RB' : 'Tab/Shift+Tab'}: rules` : ''}`));
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
  choice.rulesPage = 0;
  host.controllerChoiceIndex = index;
  host.battleInputActive = true;
  if (feedback) host.playDiscardChoiceSound('confirm');
  host.requestBattleRender();
}

export function moveReturnChoice(host: any, direction: -1 | 1) {
  const choice: ReturnChoiceState | undefined = host.returnChoice;
  if (!choice || choice.candidateIds.length === 0) return;
  const index = (choice.focusIndex + direction + choice.candidateIds.length) % choice.candidateIds.length;
  focusReturnChoice(host, choice.candidateIds[index], true);
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
  host.animateReturnCard(card.instanceId);
  host.playDiscardChoiceSound('confirm');
  host.announceDiscardChoice(`${name} returned from discard. ${choice.source} continues.`);
  choice.onResolve(1);
  host.requestBattleRender();
}
