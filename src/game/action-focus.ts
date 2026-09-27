import type Phaser from 'phaser';
import { bindControlActions, controlActionForCode } from './input-bindings';
import { announceScreenReader } from './screen-reader-accessibility';

type Action = { hit: Phaser.GameObjects.Rectangle; label: string; run: () => void };

/** One input owner for small modal action lists, retired with its visible surface. */
export function bindActionFocus(
  scene: Phaser.Scene,
  owner: Phaser.GameObjects.GameObject,
  actions: Action[],
  onBack?: () => void,
) {
  let index = 0;
  let alive = true;
  const handledKeys = new WeakSet<KeyboardEvent>();
  const focus = (next: number, announce = true) => {
    if (!alive || !owner.active || !actions.length) return;
    index = (next + actions.length) % actions.length;
    actions.forEach((action, i) => action.hit.setStrokeStyle(i === index ? 2 : 1, i === index ? 0x77d9df : 0x496471, i === index ? 1 : 0.45));
    owner.setData('actionFocus', { index, label: actions[index].label, count: actions.length });
    if (announce) announceScreenReader(`${actions[index].label}. ${index + 1} of ${actions.length}. Confirm to choose.`);
  };
  const key = (event: KeyboardEvent) => {
    if (!alive || !owner.active || !scene.scene.isActive() || event.repeat || handledKeys.has(event)) return;
    handledKeys.add(event);
    if (event.code === 'Tab' || (event.code === 'ArrowDown' && !controlActionForCode(event.code))) {
      event.preventDefault(); focus(index + (event.shiftKey ? -1 : 1));
    } else if (event.code === 'ArrowUp' && !controlActionForCode(event.code)) {
      event.preventDefault(); focus(index - 1);
    }
  };
  const guarded = (run: () => void) => (event?: KeyboardEvent) => {
    if (alive && owner.active && scene.scene.isActive() && !event?.repeat) run();
  };
  const unbind = bindControlActions(scene, {
    confirm: guarded(() => actions[index].run()),
    previous: guarded(() => focus(index - 1)),
    next: guarded(() => focus(index + 1)),
    ...(onBack ? { back: guarded(onBack) } : {}),
  });
  const pad = (_pad: unknown, button: { index: number }) => {
    if (!alive || !owner.active || !scene.scene.isActive()) return;
    if (button.index === 12 || button.index === 14) focus(index - 1);
    else if (button.index === 13 || button.index === 15) focus(index + 1);
    else if (button.index === 0) actions[index].run();
    else if (button.index === 1) onBack?.();
  };
  const pointers = actions.map((action, i) => {
    const listener = () => focus(i);
    action.hit.on('pointerover', listener);
    return listener;
  });
  const cleanup = () => {
    if (!alive) return;
    alive = false;
    unbind();
    scene.input.keyboard?.off('keydown', key);
    scene.input.gamepad?.off('down', pad);
    actions.forEach((action, i) => action.hit.off('pointerover', pointers[i]));
    scene.events.off('shutdown', cleanup);
    owner.off('destroy', cleanup);
  };
  scene.input.keyboard?.on('keydown', key);
  scene.input.gamepad?.on('down', pad);
  scene.events.once('shutdown', cleanup);
  owner.once('destroy', cleanup);
  focus(0, false);
  return cleanup;
}
