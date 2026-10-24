import type Phaser from 'phaser';
import { bindActionFocus } from './action-focus';
import { quietButton, quietText } from './quiet-ui';
import { showDownloadRecovery } from '../update-recovery';

/** Boot-resident: cancelling a download must not depend on that download. */
export function pendingOverlay<T>(scene: Phaser.Scene, addTo: (o: Phaser.GameObjects.GameObject) => void,
  load: () => Promise<T>, render: (module: T) => void, onClose: () => void, closeLabel = 'Close') {
  const root = scene.add.container(0, 0).setName('pending-overlay');
  addTo(root);
  root.add(scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.94).setInteractive());
  root.add(scene.add.rectangle(640, 360, 640, 280, 0x0b151f).setStrokeStyle(1, 0x718b98));
  const message = quietText(scene, 360, 266, 'Opening panel…', 560, 26).setName('pending-overlay-message');
  const detail = quietText(scene, 360, 316, 'You can close this panel while it downloads.', 560);
  root.add([message, detail]);
  const close = () => { root.destroy(); onClose(); };
  const cancel = quietButton(scene, { x: 484, y: 430, width: 240, label: closeLabel, name: 'pending-overlay-close', kind: 'primary', onActivate: close });
  const recover = quietButton(scene, { x: 776, y: 430, width: 240, label: 'Recovery options', name: 'pending-overlay-recovery', enabled: false, onActivate: showDownloadRecovery });
  root.add([cancel, cancel.getData('labelObject'), recover, recover.getData('labelObject')]);
  bindActionFocus(scene, root, [{ hit: cancel, label: closeLabel, run: close },
    { hit: recover, label: 'Recovery options', run: showDownloadRecovery }], close, { exclusive: true, onPause: close });
  const status = (failed: boolean) => {
    if (!root.active) return;
    root.setData('status', failed ? 'error' : 'slow');
    message.setText(failed ? 'Panel download failed' : 'Still downloading…');
    detail.setText('Close to keep playing, or review reload options. Reload uses your last saved checkpoint.');
    recover.setData('enabled', true);
  };
  // Scene clocks stop during Pause. The exit/recovery UI must not stop with them.
  const timeout = setTimeout(() => status(false), 8000);
  const retire = () => root.destroy();
  scene.events.once('shutdown', retire);
  root.once('destroy', () => { clearTimeout(timeout); scene.events.off('shutdown', retire); });
  root.setData('status', 'loading');
  void load().then(module => {
    if (!root.active || !scene.scene.isActive()) return;
    root.destroy(); render(module);
  }).catch(() => { clearTimeout(timeout); status(true); });
  return root;
}

/** A route-owned decision can fail to download without losing its saved preview. */
export function renderModuleStatus(scene: Phaser.Scene, title: string, hint: string,
  failed: boolean, name: string, close: () => void) {
  scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.76).setInteractive();
  const owner = scene.add.rectangle(640, 360, 620, 220, 0x050a12, 0.97)
    .setStrokeStyle(1.5, failed ? 0xff7a6e : 0xe8b830, 0.62).setName(`${name}-owner`);
  quietText(scene, 640, 318, failed ? `${title} unavailable` : `Opening ${title}…`, 580, 26,
    failed ? '#ffb09a' : '#ffe1a3').setOrigin(0.5).setName(`${name}-title`);
  quietText(scene, 640, 356, failed ? 'Close to keep playing, or review recovery options.' : hint, 580)
    .setOrigin(0.5).setName(`${name}-hint`);
  const cancel = quietButton(scene, { x: failed ? 484 : 640, y: 420, width: failed ? 240 : 140,
    label: 'Close', name: `${name}-close`, kind: 'primary', onActivate: close });
  const actions = [{ hit: cancel, label: 'Close', run: close }];
  if (failed) {
    const recover = quietButton(scene, { x: 776, y: 420, width: 240, label: 'Recovery options',
      name: `${name}-recovery`, onActivate: showDownloadRecovery });
    actions.push({ hit: recover, label: 'Recovery options', run: showDownloadRecovery });
  }
  bindActionFocus(scene, owner, actions, close, { exclusive: true });
}
