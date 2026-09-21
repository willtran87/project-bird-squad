import './card-journal-editor.css';

/** Native text entry owns its focus, scroll and explicit save/cancel lifecycle. */
export function createCardJournalEditor(options: {
  canvas: HTMLCanvasElement;
  name: string;
  note: string;
  limit: number;
  save: () => void;
  cancel: () => void;
}) {
  const dialog = document.createElement('dialog');
  dialog.id = 'codex-card-journal-editor';
  dialog.setAttribute('aria-labelledby', 'codex-card-journal-title');
  dialog.setAttribute('aria-describedby', 'codex-card-journal-privacy');
  const body = document.createElement('div');
  body.className = 'card-journal-body';
  const title = document.createElement('h2');
  title.id = 'codex-card-journal-title'; title.textContent = 'Private card journal';
  const label = document.createElement('label');
  label.htmlFor = 'codex-card-journal-input'; label.textContent = options.name;
  const privacy = document.createElement('p');
  privacy.id = 'codex-card-journal-privacy';
  privacy.textContent = 'Only in your local save and backups. Never shared in deck codes or used to change gameplay.';
  const input = document.createElement('textarea');
  input.id = 'codex-card-journal-input'; input.value = options.note;
  input.maxLength = options.limit; input.rows = 5;
  input.setAttribute('aria-label', `Private Card Journal note for ${options.name}`);
  input.setAttribute('aria-describedby', 'codex-card-journal-count codex-card-journal-help codex-card-journal-error');
  input.autocomplete = 'off'; input.spellcheck = true;
  input.placeholder = 'Record a combo idea, memory, or collection goal.';
  const count = document.createElement('p');
  count.id = 'codex-card-journal-count';
  const updateCount = () => { count.textContent = `${input.value.length} / ${options.limit} characters`; };
  input.addEventListener('input', updateCount); updateCount();
  const help = document.createElement('p');
  help.id = 'codex-card-journal-help';
  help.textContent = 'Enter: Save · Shift+Enter: New line · Esc: Cancel · Controller A / B: Save / Cancel';
  const error = document.createElement('p');
  error.id = 'codex-card-journal-error'; error.setAttribute('role', 'alert'); error.hidden = true;
  body.append(title, label, privacy, input, count, help, error);
  const actions = document.createElement('div'); actions.className = 'card-journal-actions';
  const cancel = document.createElement('button'); cancel.type = 'button';
  cancel.id = 'codex-card-journal-cancel'; cancel.textContent = 'Cancel'; cancel.addEventListener('click', options.cancel);
  const save = document.createElement('button'); save.type = 'button';
  save.id = 'codex-card-journal-save'; save.textContent = 'Save note'; save.addEventListener('click', options.save);
  actions.append(cancel, save); dialog.append(body, actions);
  dialog.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Tab') {
      event.preventDefault();
      const controls = [input, cancel, save];
      const index = controls.indexOf(document.activeElement as typeof input);
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
      return;
    }
    // IME confirmation must never submit or discard a note. Repeated Confirm
    // must not close the dialog and subsequently activate the underlying game.
    if (event.isComposing || event.keyCode === 229) {
      if (event.key === 'Escape') event.preventDefault();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault(); if (!event.repeat) options.cancel();
    } else if (event.key === 'Enter' && event.target === input && !event.shiftKey) {
      event.preventDefault(); if (!event.repeat) options.save();
    }
  });
  dialog.addEventListener('keyup', event => event.stopPropagation());
  dialog.addEventListener('cancel', event => { event.preventDefault(); options.cancel(); });
  // Clicking the backdrop deliberately neither saves nor discards a draft.
  dialog.addEventListener('pointerdown', event => event.stopPropagation());
  dialog.addEventListener('wheel', event => event.stopPropagation());
  const position = () => {
    const canvas = options.canvas.getBoundingClientRect(), viewport = window.visualViewport;
    const vx = viewport?.offsetLeft ?? 0, vy = viewport?.offsetTop ?? 0;
    const vw = viewport?.width ?? innerWidth, vh = viewport?.height ?? innerHeight;
    let left = Math.max(canvas.left, vx), top = Math.max(canvas.top, vy);
    let right = Math.min(canvas.right, vx + vw), bottom = Math.min(canvas.bottom, vy + vh);
    // When the orientation gate hides the stage, keep the unfinished note
    // recoverable inside the visible viewport (including a software keyboard).
    if (right - left < 320 || bottom - top < 180) {
      left = vx; top = vy; right = vx + vw; bottom = vy + vh;
    }
    dialog.style.width = `${Math.max(0, Math.min(760, right - left - 32))}px`;
    dialog.style.maxHeight = `${Math.max(0, bottom - top - 32)}px`;
    dialog.style.left = `${(left + right) / 2}px`;
    dialog.style.top = `${(top + bottom) / 2}px`;
  };
  const observer = new ResizeObserver(position); observer.observe(options.canvas);
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
  // Keep the editor outside the stage's orientation-gate display/inert subtree.
  document.body.append(dialog);
  // Opening from a gameplay key must not insert that same character into the
  // newly focused field during the browser's remaining keypress processing.
  const focusFrame = requestAnimationFrame(() => {
    position(); dialog.showModal(); input.focus({ preventScroll: true }); input.select();
  });
  return {
    input,
    showError() {
      error.hidden = false;
      error.textContent = 'Could not save. Your draft is still here. Try Save note again, or Cancel to keep the previous note.';
      error.scrollIntoView({ block: 'nearest' });
    },
    destroy() {
      cancelAnimationFrame(focusFrame);
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
      dialog.close(); dialog.remove();
    },
  };
}
