import type Phaser from 'phaser';

/** Clipboard promises cannot be aborted. Retire their UI owner instead. */
export function startOwnedCopy(scene: Phaser.Scene, options: {
  isCurrent: () => boolean;
  write: () => Promise<boolean>;
  complete: (copied: boolean) => void;
  canceled?: () => void;
}) {
  let owner: { scene: Phaser.Scene; callbacks: typeof options } | undefined = {scene, callbacks: options};
  const cleanup = () => {
    clearTimeout(timeout);
    owner?.scene.events.off('shutdown', cancel);
    owner = undefined;
  };
  const cancel = () => {
    const current = owner;
    if (!current) return;
    cleanup();
    current.callbacks.canceled?.();
  };
  const finish = (copied: boolean) => {
    const current = owner;
    if (!current) return;
    if (!current.scene.scene.isActive() || !current.callbacks.isCurrent()) { cancel(); return; }
    cleanup();
    current.callbacks.complete(copied);
  };
  // Wall-clock deadline also works while a modal pauses scene time.
  const timeout = setTimeout(() => finish(false), 8000);
  scene.events.once('shutdown', cancel);
  // Start synchronously to retain the browser's user-activation permission.
  try { void options.write().then(finish, () => finish(false)); }
  catch { queueMicrotask(() => finish(false)); }
  return { cancel, isCurrent: () => owner?.callbacks.isCurrent() ?? false };
}
