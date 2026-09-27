/** A failed write must never silently navigate away from the only live result. */
export function showSaveRecovery(retry: () => boolean) {
  if (document.getElementById('save-recovery')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'save-recovery';
  dialog.setAttribute('aria-label', 'Flight save recovery');
  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  message.textContent = 'Your flight result could not be fully saved. Keep this tab open. Retry saving before starting another flight.';
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = 'Retry saving';
  button.onclick = () => {
    if (retry()) { dialog.close(); dialog.remove(); document.querySelector('canvas')?.focus(); }
    else message.textContent = 'Saving is still unavailable. Your result remains open; free browser storage or restore storage access, then retry.';
  };
  const dismiss = document.createElement('button');
  dismiss.type = 'button'; dismiss.textContent = 'Keep result open';
  dismiss.onclick = () => { dialog.close(); dialog.remove(); document.querySelector('canvas')?.focus(); };
  for (const name of ['keydown', 'keyup', 'keypress']) dialog.addEventListener(name, e => e.stopPropagation());
  dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss.click(); });
  const hint = document.createElement('p');
  hint.textContent = 'Tab / D-pad: select · Enter / A: confirm · Esc / B: keep open';
  dialog.append(message, button, dismiss, hint); document.body.append(dialog); dialog.showModal();
}

export function consumeSaveRecoveryGamepad(index?: number) {
  const dialog = document.getElementById('save-recovery');
  if (!dialog) return false;
  const buttons = [...dialog.querySelectorAll('button')];
  if (index === 0) (buttons.find(button => button === document.activeElement) ?? buttons[0]).click();
  else if (index === 1) buttons[1].click();
  else if ([4, 5, 12, 13, 14, 15].includes(index ?? -1)) {
    buttons[document.activeElement === buttons[0] ? 1 : 0].focus();
  }
  return true; // The modal owns every controller action, including Start.
}
