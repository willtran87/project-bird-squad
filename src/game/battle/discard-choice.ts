import Phaser from 'phaser';
import { bindChoiceHint } from '../choice-input-hints';
import { controlBindingLabel } from '../input-bindings';

export interface DiscardChoiceState {
  source: string;
  max: number;
  optional: boolean;
  candidateIds: string[];
  selectedIds: string[];
  onResolve: (discarded: number) => void;
}

export interface DiscardChoiceCardView {
  instanceId: string;
  id: string;
  name: string;
}

export type InterruptibleDecision =
  | { kind: 'discard'; amount: number; optional: boolean }
  | { kind: 'return'; filter: string; drawAfter: number };

export function candidateHandIndices(candidateIds: string[], handIds: string[]) {
  return candidateIds.map((id) => handIds.indexOf(id)).filter((index) => index >= 0);
}

export function toggleDiscardSelection(choice: DiscardChoiceState, instanceId: string) {
  if (!choice.candidateIds.includes(instanceId)) return 'invalid' as const;
  const selectedIndex = choice.selectedIds.indexOf(instanceId);
  if (selectedIndex >= 0) {
    choice.selectedIds.splice(selectedIndex, 1);
    return 'deselected' as const;
  }
  if (choice.selectedIds.length >= choice.max) return 'full' as const;
  choice.selectedIds.push(instanceId);
  return 'selected' as const;
}

export function discardChoiceTextState(
  choice: DiscardChoiceState,
  cards: DiscardChoiceCardView[],
  input: { choose: string; toggle: string; confirm: string; cancel: string },
) {
  return {
    source: choice.source,
    optional: choice.optional,
    max: choice.max,
    required: choice.optional ? 0 : choice.max,
    selectedCount: choice.selectedIds.length,
    canConfirm: choice.optional || choice.selectedIds.length === choice.max,
    candidates: choice.candidateIds.flatMap((instanceId) => {
      const card = cards.find((candidate) => candidate.instanceId === instanceId);
      if (!card) return [];
      const order = choice.selectedIds.indexOf(instanceId);
      return [{ ...card, selected: order >= 0, order: order >= 0 ? order + 1 : undefined }];
    }),
    input,
  };
}

export function runInterruptibleSequence<T>(options: {
  items: T[];
  detect: (item: T) => InterruptibleDecision | undefined;
  apply: (item: T) => void;
  choose: (decision: InterruptibleDecision, resume: (resolved: number) => void) => void;
  onResolved?: (decision: InterruptibleDecision, resolved: number) => void;
  onComplete: () => void;
}) {
  const advance = (index: number) => {
    for (let i = index; i < options.items.length; i += 1) {
      const decision = options.detect(options.items[i]);
      if (decision) {
        options.choose(decision, (count) => {
          options.onResolved?.(decision, count);
          advance(i + 1);
        });
        return;
      }
      options.apply(options.items[i]);
    }
    options.onComplete();
  };
  advance(0);
}

export function renderDiscardChoiceRail(options: {
  scene: Phaser.Scene;
  target: Phaser.GameObjects.Container;
  gameWidth: number;
  fontFamily: string;
  boldFontStyle: string;
  gold: number;
  danger: number;
  choice: Pick<DiscardChoiceState, 'max' | 'optional' | 'selectedIds'>;
  onConfirm: () => void;
}) {
  const { scene, target, gameWidth, fontFamily, boldFontStyle, gold, danger, choice } = options;
  const selected = choice.selectedIds.length;
  const ready = choice.optional || selected === choice.max;
  const prompt = choice.optional ? `Discard up to ${choice.max}` : `Discard ${choice.max}`;
  const y = 414;
  const buttonX = gameWidth - 152;
  target.add(scene.add.rectangle(gameWidth / 2 + 160, y, 880, 84, 0x020711, 0.98)
    .setStrokeStyle(1, gold, 0.55)
    .setName('combat-discard-choice-rail'));
  target.add(scene.add.text(382, y - 18, `${prompt} · ${selected} selected${choice.optional ? '' : ' · Required'}`, {
    fontFamily, fontSize: '20px', fontStyle: boldFontStyle, color: '#f4fdff',
  }).setOrigin(0, 0.5).setName('combat-discard-choice-prompt'));
  const hint = scene.add.text(382, y + 17, '', {
    fontFamily, fontSize: '18px', color: '#bed5df',
  }).setOrigin(0, 0.5).setName('combat-discard-choice-hint');
  target.add(bindChoiceHint(scene, hint, mode => mode === 'pointer'
    ? 'Tap cards to toggle · Confirm when ready'
    : `${mode === 'controller' ? 'D-pad' : `${controlBindingLabel('previous')}/${controlBindingLabel('next')}`}: choose · ${mode === 'controller' ? 'A' : controlBindingLabel('confirm')}: toggle · ${mode === 'controller' ? 'Y' : controlBindingLabel('roost')}: confirm${choice.optional ? ` · ${mode === 'controller' ? 'B' : controlBindingLabel('back')}: keep hand` : ''}`));
  const confirm = scene.add.rectangle(buttonX, y, 208, 58, ready ? 0x26392c : 0x14212a, 0.98)
    .setStrokeStyle(1, ready ? gold : danger, ready ? 0.8 : 0.35)
    .setInteractive({ useHandCursor: ready })
    .setName('combat-discard-confirm');
  confirm.on('pointerdown', options.onConfirm);
  target.add(confirm);
  target.add(scene.add.text(buttonX, y, ready && choice.optional && selected === 0 ? 'Keep hand' : ready ? `Discard ${selected}` : `Choose ${choice.max - selected} more`, {
    fontFamily, fontSize: '18px', fontStyle: boldFontStyle, color: ready ? '#fff0b8' : '#b2c1cb',
  }).setOrigin(0.5).setName('combat-discard-confirm-label'));
}

export function renderDiscardChoiceTag(options: {
  scene: Phaser.Scene;
  target: Phaser.GameObjects.Container;
  x: number;
  y: number;
  selected: boolean;
  order?: number;
  fontFamily: string;
  boldFontStyle: string;
}) {
  const { scene, target, x, y, selected, order, fontFamily, boldFontStyle } = options;
  if (!selected) return; // The command lane already teaches how to choose.
  // Keep the selection marker on the exposed left side of overlapping cards.
  target.add(scene.add.rectangle(x - 82, y, 64, 28, 0x401219, 0.98)
    .setStrokeStyle(1, 0xff6b57, 0.96)
    .setName('combat-discard-choice-tag')
    .setData('order', order ?? 0));
  target.add(scene.add.text(x - 82, y, `Drop ${order}`, {
    fontFamily, fontSize: '16px', fontStyle: boldFontStyle, color: '#ffd9d4', align: 'center',
  }).setOrigin(0.5).setName('combat-discard-choice-tag').setData('order', order ?? 0));
}

export function beginDiscardChoice(
  host: any,
  source: string,
  count: number,
  optional: boolean,
  onResolve: (discarded: number) => void,
  excludedInstanceId?: string,
) {
  const candidateIds = host.hand
    .filter((card: any) => card.instanceId !== excludedInstanceId)
    .map((card: any) => card.instanceId);
  const max = Math.min(Math.max(0, Math.floor(count)), candidateIds.length);
  if (max === 0) {
    onResolve(0);
    return;
  }
  host.selectedInstanceId = undefined;
  host.discardChoice = { source, max, optional, candidateIds, selectedIds: [], onResolve };
  host.controllerChoiceIndex = Math.max(0, host.hand.findIndex((card: any) => card.instanceId === candidateIds[0]));
  host.battleInputActive = true;
  host.hideCardPreview();
  host.hideDiscardChoiceTooltip();
  host.announceDiscardChoice(optional
    ? `Choose up to ${max} card${max === 1 ? '' : 's'} to discard for ${source}, or press Back to keep the hand.`
    : `Choose ${max} card${max === 1 ? '' : 's'} to discard for ${source}.`);
  host.requestBattleRender();
}

export function toggleDiscardChoice(host: any, instanceId: string) {
  const choice: DiscardChoiceState | undefined = host.discardChoice;
  if (!choice) return;
  const result = toggleDiscardSelection(choice, instanceId);
  if (result === 'invalid') {
    host.playDiscardChoiceSound('locked');
    return;
  }
  if (result === 'full') {
    host.playDiscardChoiceSound('locked');
    host.announceDiscardChoice(`At most ${choice.max} card${choice.max === 1 ? '' : 's'} may be discarded.`);
    return;
  }
  host.controllerChoiceIndex = Math.max(0, host.hand.findIndex((card: any) => card.instanceId === instanceId));
  host.playDiscardChoiceSound('confirm');
  host.requestBattleRender();
}

export function confirmDiscardChoice(host: any, skip = false) {
  const choice: DiscardChoiceState | undefined = host.discardChoice;
  if (!choice) return;
  const selectedIds = skip && choice.optional ? [] : [...choice.selectedIds];
  if (!choice.optional && selectedIds.length !== choice.max) {
    host.playDiscardChoiceSound('locked');
    const remaining = choice.max - selectedIds.length;
    host.announceDiscardChoice(`Choose ${remaining} more card${remaining === 1 ? '' : 's'} before confirming.`);
    return;
  }
  const selected = new Set(selectedIds);
  const discarded = host.hand.filter((card: any) => selected.has(card.instanceId));
  host.hand = host.hand.filter((card: any) => !selected.has(card.instanceId));
  discarded.forEach((card: any) => {
    if (!host.discardPile.some((candidate: any) => candidate.instanceId === card.instanceId)) host.discardPile.push(card);
    host.logEvent(`${card.upgraded ? `${card.name}+` : card.name} discarded.`);
  });
  if (discarded.length > 0) host.animateDiscard(discarded.length);
  host.discardChoice = undefined;
  host.announceDiscardChoice(discarded.length > 0
    ? `${discarded.length} card${discarded.length === 1 ? '' : 's'} discarded. ${choice.source} continues.`
    : `No cards discarded. ${choice.source} continues.`);
  choice.onResolve(discarded.length);
  host.requestBattleRender();
}

export function resolveHeldDiscardCards(host: any, heldCards: any[], onComplete: () => void) {
  const advance = (index: number) => {
    const card = heldCards[index];
    if (!card) {
      onComplete();
      return;
    }
    if (!host.hand.some((candidate: any) => candidate.instanceId === card.instanceId)) {
      advance(index + 1);
      return;
    }
    const state = host.createDiscardEffectState();
    host.presentHeldDiscardCard(card);
    host.resolveCardEffectSequenceInteractive(card.runtime.heldEffects ?? [], card, '', state, card.upgraded ? `${card.name}+` : card.name, card.instanceId, () => {
      if (state.returnSelfToDraw) {
        host.hand = host.hand.filter((candidate: any) => candidate.instanceId !== card.instanceId);
        host.discardPile = host.discardPile.filter((candidate: any) => candidate.instanceId !== card.instanceId);
        host.drawPile = host.drawPile.filter((candidate: any) => candidate.instanceId !== card.instanceId);
        host.addCardToDrawRandom(card);
      }
      advance(index + 1);
    });
  };
  advance(0);
}
