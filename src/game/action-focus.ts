import type Phaser from 'phaser';
import { recoveryPointerBlocked } from '../update-recovery';
import { actionFocusOwners, bindControlActions, controlActionForCode, controlPanelOwnsInput, modalGamepadRelease } from './input-bindings';
import { announceScreenReader } from './screen-reader-accessibility';
import { UI_CONTROL } from './theme';

type Action = { hit: Phaser.GameObjects.Rectangle; label: string; run: () => void };

/** One input owner for small modal action lists, retired with its visible surface. */
export function bindActionFocus(
  scene: Phaser.Scene,
  owner: Phaser.GameObjects.GameObject,
  actions: Action[],
  onBack?: () => void,
  options: { exclusive?: boolean; initialIndex?: number; onPause?: () => void; onSettings?: () => void;
    onMute?: () => void; onFullscreen?: () => void } = {},
) {
  let index = 0;
  let alive = true;
  const handledKeys = new WeakSet<KeyboardEvent>();
  const previousOwner = actionFocusOwners.get(scene);
  if (options.exclusive) actionFocusOwners.set(scene, owner);
  const ownsInput = () => {
    if (!alive || !scene.scene.isActive() || controlPanelOwnsInput(scene, options.exclusive ? owner : undefined)) return false;
    let node: any = owner;
    while (node) {
      if (!node.active || node.visible === false) return false;
      node = node.parentContainer;
    }
    return true;
  };
  const focus = (next: number, announce = true) => {
    if (!alive || !owner.active || !actions.length) return;
    index = (next + actions.length) % actions.length;
    actions.forEach((action, i) => {
      if (action.hit.getData('controlKind')) action.hit.setData('focused', i === index);
      else action.hit.setStrokeStyle(i === index ? UI_CONTROL.focusWidth : UI_CONTROL.borderWidth,
        i === index ? UI_CONTROL.focus : UI_CONTROL.border, 1);
    });
    owner.setData('actionFocus', { index, label: actions[index].label, count: actions.length });
    if (announce) {
      const hit = actions[index].hit;
      const hint = hit.getData('status') === 'loading' ? 'Loading.' : hit.getData('enabled') === false ? 'Unavailable.' : 'Confirm to choose.';
      announceScreenReader(`${hit.getData('labelObject')?.text ?? actions[index].label}. ${index + 1} of ${actions.length}. ${hint}`);
    }
  };
  const activate = () => {
    const action = actions[index];
    if (ownsInput() && action?.hit.active && action.hit.visible && action.hit.input?.enabled
      && action.hit.getData('enabled') !== false) action.run();
  };
  const key = (event: KeyboardEvent) => {
    if (!ownsInput() || event.repeat || handledKeys.has(event)) return;
    handledKeys.add(event);
    if (event.code === 'Tab' || (event.code === 'ArrowDown' && !controlActionForCode(event.code))) {
      event.preventDefault(); focus(index + (event.shiftKey ? -1 : 1));
    } else if (event.code === 'ArrowUp' && !controlActionForCode(event.code)) {
      event.preventDefault(); focus(index - 1);
    }
  };
  const guarded = (run: () => void) => (event?: KeyboardEvent) => {
    if (ownsInput() && !event?.repeat) run();
  };
  const unbind = bindControlActions(scene, {
    confirm: guarded(activate),
    previous: guarded(() => focus(index - 1)),
    next: guarded(() => focus(index + 1)),
    ...(onBack ? { back: guarded(onBack) } : {}),
    ...(options.onPause ? { pause: guarded(options.onPause) } : {}),
    ...(options.onSettings ? { settings: guarded(options.onSettings) } : {}),
    ...(options.onMute ? { mute: guarded(options.onMute) } : {}),
    ...(options.onFullscreen ? { fullscreen: guarded(options.onFullscreen) } : {}),
  }, options.exclusive ? owner : undefined);
  const pad = (_pad: unknown, button: { index: number }) => {
    if (!ownsInput()) return;
    if (options.exclusive && !modalGamepadRelease.has(scene)) {
      modalGamepadRelease.add(scene);
      // The owner may be destroyed by this press. Keep the release latch alive
      // independently, then retire it even in scenes without controller polling.
      const release = () => {
        if (scene.scene.isActive() && scene.input.gamepad?.pad1?.buttons.some(b => b.pressed)) return;
        modalGamepadRelease.delete(scene);
        scene.events.off('postupdate', release);
        scene.events.off('shutdown', shutdown);
      };
      const shutdown = () => {
        modalGamepadRelease.delete(scene);
        scene.events.off('postupdate', release);
      };
      scene.events.on('postupdate', release);
      scene.events.once('shutdown', shutdown);
    }
    if (button.index === 12 || button.index === 14) focus(index - 1);
    else if (button.index === 13 || button.index === 15) focus(index + 1);
    else if (button.index === 0) activate();
    else if (button.index === 1) onBack?.();
    else if (button.index === 9) options.onPause?.();
  };
  const pointers = actions.map((action, i) => {
    const listener = () => { if (ownsInput() && !recoveryPointerBlocked) focus(i); };
    action.hit.on('pointerover', listener);
    return listener;
  });
  const cleanup = () => {
    if (!alive) return;
    alive = false;
    if (actionFocusOwners.get(scene) === owner) {
      if (previousOwner?.active) actionFocusOwners.set(scene, previousOwner);
      else actionFocusOwners.delete(scene);
    }
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
  focus(options.initialIndex ?? 0, false);
  return cleanup;
}
