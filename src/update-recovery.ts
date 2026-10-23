// Failed module preloads can remain in WebKit's resource cache after a reload.
// Revalidate only failed, same-origin module URLs before an explicit whole-page
// reload. Never execute a separately cache-busted module or mix build versions.
const failedModules = new Set<string>();
// A click closing the native dialog must not hover/focus a canvas control below it.
// Resume hover selection only after a fresh pointer movement outside the dialog.
export let recoveryPointerBlocked = false;
addEventListener('pointermove', () => {
  if (!document.getElementById('update-recovery')) recoveryPointerBlocked = false;
});
addEventListener('error', event => {
  const link = event.target;
  if (!(link instanceof HTMLLinkElement) || link.rel !== 'modulepreload') return;
  const url = new URL(link.href);
  if (url.origin === location.origin && /\/assets\/[^/]+\.js$/.test(url.pathname) && failedModules.size < 16) failedModules.add(url.href);
}, true);

export function showDownloadRecovery() {
  if (document.getElementById('update-recovery')) return;
  recoveryPointerBlocked = true;
  const previousFocus = document.activeElement as HTMLElement | null;
  const panel = document.createElement('dialog');
  panel.id = 'update-recovery';
  panel.setAttribute('aria-label', 'Download recovery');
  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  message.textContent = 'A game download failed. You may be offline, or a newer version is available. Keep this tab open to preserve unsaved progress.';
  const reload = document.createElement('button');
  reload.type = 'button'; reload.textContent = 'Reload options';
  const dismiss = document.createElement('button');
  dismiss.type = 'button'; dismiss.textContent = 'Keep playing';
  let confirmed = false;
  let request: AbortController | undefined;
  reload.onclick = async () => {
    if (!confirmed) {
      confirmed = true;
      message.textContent = 'Reload returns to your last saved checkpoint, not necessarily this screen. If saving failed, keep this tab open and retry saving first.';
      reload.textContent = 'Reload saved checkpoint';
      dismiss.textContent = 'Cancel reload';
      dismiss.focus();
      return;
    }
    reload.disabled = true;
    message.textContent = 'Checking the failed download before reloading your saved checkpoint. You can still cancel.';
    request = new AbortController();
    const timeout = setTimeout(() => request?.abort(), 5000);
    try {
      await Promise.allSettled([...failedModules].map(async url => {
        const response = await fetch(url, { cache: 'reload', signal: request!.signal });
        await response.arrayBuffer(); // Finish cache replacement before navigation.
      }));
    } finally {
      clearTimeout(timeout);
      // An unavailable old chunk is expected after a deployment: the new HTML
      // chooses the new bundle. Cancellation keeps the current live scene intact.
      if (panel.isConnected) location.reload();
    }
  };
  dismiss.onclick = () => { panel.close(); panel.remove(); request?.abort();
    (previousFocus?.isConnected ? previousFocus : document.querySelector('canvas'))?.focus(); };
  panel.addEventListener('cancel', event => { event.preventDefault(); dismiss.click(); });
  // Phaser also listens for mouse/touch events on window. Native recovery
  // controls must not choose a route option underneath the panel.
  for (const name of ['keydown', 'keyup', 'keypress', 'mousedown', 'mouseup', 'mousemove',
    'pointerdown', 'pointerup', 'touchstart', 'touchend', 'touchmove', 'click', 'wheel']) {
    panel.addEventListener(name, event => event.stopPropagation());
  }
  panel.append(message, reload, dismiss);
  document.body.append(panel);
  panel.showModal();
  dismiss.focus();
}
addEventListener('vite:preloadError', showDownloadRecovery);
