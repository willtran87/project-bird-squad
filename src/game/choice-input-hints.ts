import type Phaser from 'phaser';
import { controlBindingLabel } from './input-bindings';

type InputMode = 'pointer' | 'keyboard' | 'controller';
type Hint = { label: Phaser.GameObjects.Text; format: (mode: InputMode) => string };
const scenes = new WeakMap<Phaser.Scene, { mode: InputMode; hints: Set<Hint> }>();

// One observer per scene, regardless of how often choices are redrawn. Hints
// observe input only: switching devices must never arm or commit a choice.
export function observeChoiceInput(scene: Phaser.Scene) {
  let state = scenes.get(scene);
  if (!state) {
    state = { mode: 'pointer', hints: new Set() };
    scenes.set(scene, state);
    const update = (mode: InputMode) => {
      const current = scenes.get(scene);
      if (!current || current.mode === mode) return;
      current.mode = mode;
      for (const hint of current.hints) {
        hint.label.setText(hint.format(mode)).setData('inputMode', mode);
      }
    };
    const pointer = () => { if (scene.sys.isActive()) update('pointer'); };
    // Bound keys can stop Phaser's generic keydown after dispatching an action.
    // Capture the real DOM event first so its redraw retains keyboard hints.
    const keyboard = () => { if (scene.sys.isActive()) update('keyboard'); };
    const controller = () => update('controller');
    scene.input.on('pointerdown', pointer);
    // Card hits may stop Phaser propagation to protect their selection. Read
    // the real pointer first, without changing or cancelling the input itself.
    scene.game.canvas.addEventListener('pointerdown', pointer, true);
    scene.game.canvas.ownerDocument.addEventListener('keydown', keyboard, true);
    scene.input.gamepad?.on('down', controller);
    scene.events.once('shutdown', () => {
      scene.input.off('pointerdown', pointer);
      scene.game.canvas.removeEventListener('pointerdown', pointer, true);
      scene.game.canvas.ownerDocument.removeEventListener('keydown', keyboard, true);
      scene.input.gamepad?.off('down', controller);
      scenes.delete(scene);
    });
  }
  return state;
}

export function bindChoiceHint(scene: Phaser.Scene, label: Phaser.GameObjects.Text, format: Hint['format']) {
  const state = observeChoiceInput(scene);
  const hint = { label, format };
  state.hints.add(hint);
  label.once('destroy', () => state.hints.delete(hint));
  label.setText(format(state.mode)).setData('inputMode', state.mode);
  return label;
}

export function choiceInputHint(mode: InputMode, armed: boolean, multiline = false) {
  const join = multiline ? '\n' : '   ·   ';
  if (mode === 'pointer') return armed
    ? `Click the selected choice again to confirm${join}Inspect reads without committing`
    : `Click a choice to select${join}Inspect reads without committing`;
  const controller = mode === 'controller';
  const move = controller ? 'D-pad' : `${controlBindingLabel('previous')}/${controlBindingLabel('next')}`;
  const confirm = controller ? 'A' : controlBindingLabel('confirm');
  const back = controller ? 'B' : controlBindingLabel('back');
  const inspect = controller ? 'Y' : controlBindingLabel('roost');
  return `${move}: choose · ${confirm}: select / confirm${join}${inspect}: inspect · ${back}: ${armed ? 'clear pick' : 'back'}`;
}

export function inspectInputHint(mode: InputMode) {
  return mode === 'pointer' ? 'Read full card' : `${mode === 'controller' ? 'Y' : controlBindingLabel('roost')}: full card`;
}
