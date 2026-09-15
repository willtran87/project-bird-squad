import type Phaser from 'phaser';
import { controlBindingLabel } from './input-bindings';
import { bindChoiceHint } from './choice-input-hints';
import { decisionButton, decisionText } from './decision-surface';

type Reading = { title: string; text: string; page: number; total: number };
type State = { nodeId: string; index: number; open: boolean; page: number; reading?: Reading };
const states = new WeakMap<Phaser.Scene, State>();

export function eventChoiceState(scene: any, reset = false): State {
  let state = states.get(scene);
  if (reset || !state || state.nodeId !== scene.nodeChoiceNodeId) {
    state = { nodeId: scene.nodeChoiceNodeId, index: 0, open: false, page: 0 };
    states.set(scene, state);
  }
  return state;
}

export function handleEventChoice(scene: any, action: 'previous' | 'next' | 'confirm' | 'inspect' | 'back', index?: number) {
  if (!scene.nodeChoiceOpen) return false;
  if (scene.pauseOverlayOpen || scene.settingsOverlayOpen) return true;
  const state = eventChoiceState(scene);
  if (state.open) {
    if (action === 'previous' || action === 'next') {
      scene.children.getByName('route-event-reader')?.getData('turnPage')?.(action === 'previous' ? -1 : 1);
    } else {
      state.open = false;
      state.reading = undefined;
      scene.renderAll();
    }
    return true;
  }
  const choices = scene.eventChoices();
  if (!choices.length) return true;
  if (index !== undefined) state.index = Math.max(0, Math.min(choices.length - 1, index));
  if (action === 'previous' || action === 'next') {
    state.index = (state.index + (action === 'previous' ? -1 : 1) + choices.length) % choices.length;
  } else if (action === 'inspect' || (action === 'confirm' && choices[state.index]?.locked)) {
    state.open = true;
    state.page = 0;
  } else if (action === 'confirm') {
    // Reward/picker polling uses its own latch. Preserve this press across the
    // handoff; release is required before another intentional confirmation.
    if (scene.input.gamepad?.pad1?.A) {
      scene.controllerButtonsDown.add('reward-confirm');
      scene.controllerButtonsDown.add('picker-confirm');
    }
    scene.chooseNodeOption(choices[state.index].key);
    return true;
  } else return true; // Back never silently abandons a committed route stop.
  scene.renderAll();
  return true;
}

export function eventChoiceHint(scene: Phaser.Scene, x: number, y: number, width: number) {
  return bindChoiceHint(scene, decisionText(scene, x, y, '', width, 16, '#b8cdd2').setName('route-event-input-hint'), mode =>
    mode === 'pointer' ? 'Choose an option · Details reads without choosing' : mode === 'controller'
      ? 'D-pad: browse · A: choose · Y: details'
      : `${controlBindingLabel('previous')}/${controlBindingLabel('next')}: browse · ${controlBindingLabel('confirm')}: choose · ${controlBindingLabel('roost')}: details`);
}

export function renderEventChoiceReader(scene: any) {
  if (!scene.nodeChoiceOpen) return;
  const state = eventChoiceState(scene);
  const choice = scene.eventChoices()[state.index];
  if (!state.open || !choice) return;
  const panel = scene.add.container(0, 0).setDepth(23040).setName('route-event-reader');
  const add = <T extends Phaser.GameObjects.GameObject>(child: T): T => { panel.add(child); return child; };
  add(scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.88).setInteractive());
  const frame = add(scene.add.rectangle(640, 360, 760, 600, 0x070d15, 1).setStrokeStyle(1, 0x66818c, 0.8).setInteractive());
  const text = (x: number, y: number, value: string, size: number) => add(decisionText(scene, x, y, value, 688, size));
  text(296, 88, 'EVENT DETAILS', 16).setColor('#abc4d4');
  text(296, 119, 'Read before you decide', 28).setColor('#f3e6c9');
  text(296, 163, 'Nothing is spent or selected here.', 18).setColor('#abc4d4');
  add(scene.add.rectangle(640, 204, 688, 1, 0x66818c, 0.4));
  const heading = text(296, 225, '', 16).setColor('#f3e6c9');
  const body = text(296, 260, '', 22).setName('route-event-reader-body');
  const sections = scene.eventChoiceSections(choice);
  const pages: Array<{ title: string; text: string }> = [];
  for (const section of sections) {
    let lines: string[] = [];
    for (const line of body.getWrappedText(section.text)) {
      body.setText([...lines, line].join('\n'));
      if (body.getBounds().bottom > 495 && lines.length) {
        pages.push({ title: section.title, text: lines.join('\n') });
        lines = [];
      }
      lines.push(line);
    }
    if (lines.length) pages.push({ title: section.title, text: lines.join('\n') });
  }
  body.setText(pages[0].text);
  const single = pages.length === 1;
  const footer = single ? Math.max(410, body.getBounds().bottom + 58) : 568;
  const count = text(640, 520, '', 16).setOrigin(0.5).setVisible(!single);
  const show = (delta: number) => {
    if (scene.pauseOverlayOpen || scene.settingsOverlayOpen) return;
    state.page = (state.page + delta + pages.length) % pages.length;
    const page = pages[state.page];
    heading.setText(page.title); body.setText(page.text);
    count.setText(`${state.page + 1} / ${pages.length}`);
    state.reading = { ...page, page: state.page + 1, total: pages.length };
    if (delta) scene.updateTextState();
  };
  const button = (x: number, width: number, label: string, name: string, action: () => void) =>
    decisionButton(scene, x, footer, width, label, `route-event-reader-${name}`, action).forEach(add);
  if (!single) {
    button(402, 212, '← Previous', 'previous', () => show(-1));
    button(878, 212, 'Next →', 'next', () => show(1));
  }
  button(640, single ? 688 : 240, 'Return to choices', 'return', () => handleEventChoice(scene, 'back'));
  if (single) frame.setSize(760, footer + 92 - 60).setY((60 + footer + 92) / 2);
  add(bindChoiceHint(scene, decisionText(scene, 640, footer + 57, '', 688, 16, '#abc4d4').setOrigin(0.5), mode =>
    mode === 'pointer' ? `${single ? 'Complete details' : 'Read every page'} · Return keeps the same choice in focus` : mode === 'controller'
      ? `${single ? '' : 'D-pad: pages · '}B: return` : `${single ? '' : `${controlBindingLabel('previous')}/${controlBindingLabel('next')}: pages · `}${controlBindingLabel('back')}: return`));
  panel.setData('turnPage', show);
  show(0);
}
