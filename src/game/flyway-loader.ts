import type Phaser from 'phaser';
import { showDownloadRecovery } from '../update-recovery';
import { branchCards, type PreenBranch } from './flyway-rules';

/** A slow or failed journal download must not silently skip a Preen choice. */
export function loadFlyway(scene: Phaser.Scene) {
  const owner = scene as Phaser.Scene & { flywayPreenRequest?: (card: any, accept: (branch: PreenBranch) => void, isCurrent?: () => boolean) => boolean; flywayCancelPreen?: () => void };
  let alive = true, loading = false, failed = false;
  let pending: { card: any; accept: (branch: PreenBranch) => void; isCurrent: () => boolean } | undefined;
  let retry: HTMLButtonElement | undefined;
  owner.flywayPreenRequest = (card, accept, isCurrent = () => true) => {
    if (card.upgraded || card.preenBranch || !branchCards.includes(card.id)) return false;
    pending = { card, accept, isCurrent }; request(); return true;
  };
  owner.flywayCancelPreen = () => { pending = undefined; };
  function request() {
    if (loading || !alive) return;
    if (failed) { showDownloadRecovery(); return; }
    loading = true;
    void import('./flyway-expansion').then(module => {
      if (!alive) return;
      retry?.remove(); module.installFlyway(scene);
      if (pending?.isCurrent()) owner.flywayPreenRequest?.(pending.card, pending.accept, pending.isCurrent);
      pending = undefined;
    }).catch(() => {
      if (!alive || retry) return;
      failed = true;
      retry = document.createElement('button');
      retry.id = 'flyway-retry'; retry.textContent = 'Flyway unavailable · Recovery options';
      retry.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:30;min-height:48px;padding:12px;background:#14242e;color:#fff;border:1px solid #dbbd79;font:17px system-ui';
      // Failed module imports can be cached by the browser. Use the existing
      // explicit checkpoint reload flow; never promise an in-place retry.
      retry.onclick = () => showDownloadRecovery();
      document.body.append(retry);
    }).finally(() => { loading = false; });
  }
  scene.events.once('shutdown', () => { alive = false; retry?.remove(); pending = undefined; });
  request();
}
