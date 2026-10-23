import type Phaser from 'phaser';
import './folio-editor.css';

type FolioInput = HTMLInputElement | HTMLTextAreaElement;
const cleanups = new WeakMap<FolioInput, () => void>();

export function disposeFolioEditor(input?: FolioInput) {
  if (!input) return;
  cleanups.get(input)?.();
  input.remove();
}

/** One owner, one commit, and a retained draft until persistence succeeds. */
export function bindFolioEditor(scene: Phaser.Scene, input: FolioInput, options: {
  ownsInput: () => boolean;
  commit: () => string | undefined;
  close: (committed: boolean) => void;
  redraw: () => void;
}) {
  let finished = false;
  let error: HTMLDivElement | undefined;
  const actions = document.createElement('div'); actions.id = 'folio-editor-actions';
  actions.setAttribute('role', 'group'); actions.setAttribute('aria-label', 'Folio editor actions');
  input.dataset.folioEditor = 'true';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.id = 'folio-editor-cancel'; cancel.textContent = 'Cancel';
  const save = document.createElement('button'); save.type = 'button'; save.id = 'folio-editor-save';
  const importCode = input.getAttribute('aria-label') === 'Flight share code';
  save.textContent = importCode ? 'Import Folio' : 'Save';
  actions.append(cancel, save); document.body.append(actions);
  const controls = [input, cancel, save];
  const positionControls = () => {
    const box = input.getBoundingClientRect();
    actions.style.left = `${box.left}px`; actions.style.top = `${box.bottom + 12}px`; actions.style.width = `${box.width}px`;
  };
  const sizeObserver = new ResizeObserver(positionControls);
  sizeObserver.observe(input); window.addEventListener('resize', positionControls); positionControls();
  const ownsInput = () => !finished && input.isConnected && options.ownsInput() && scene.scene.isActive();
  const finish = (commit: boolean) => {
    if (!ownsInput() || document.getElementById('update-recovery')) return;
    // Removing a focused field can emit blur. Retire this owner before removal.
    finished = true;
    const message = commit ? options.commit() : undefined;
    if (message) {
      finished = false;
      if (!error) {
        error = document.createElement('div');
        error.id = input.tagName === 'TEXTAREA' ? 'folio-notes-error' : 'folio-editor-error';
        error.setAttribute('role', 'alert');
        Object.assign(error.style, { flex: '0 0 100%', width: '100%',
          padding: '12px', boxSizing: 'border-box', background: '#25151c', color: '#ffd6cf',
          font: '16px/1.4 Arial' });
        // Keep recovery text in normal flow with its commands. Independent
        // fixed error layers can leave stale compositor tiles after a dialog.
        actions.append(error);
      }
      error.textContent = `${message} Your draft is kept. Use Retry or Cancel; Enter / Esc also work.`;
      save.textContent = importCode ? 'Retry import' : 'Retry save';
      positionControls();
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', error.id);
      options.redraw();
      input.focus({ preventScroll: true });
      return;
    }
    disposeFolioEditor(input);
    options.close(commit);
    if (scene.scene.isActive()) {
      options.redraw();
      scene.game.canvas.focus({ preventScroll: true });
    }
  };
  const keydown = (event: Event) => {
    if (!(event instanceof KeyboardEvent)) return;
    event.stopPropagation();
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter' && event.shiftKey && event.target === input && input.tagName === 'TEXTAREA') return;
    if (['Enter', 'Escape', 'Tab'].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    if (event.key === 'Tab') {
      const index = controls.indexOf(document.activeElement as typeof input);
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus({ preventScroll: true });
    }
    if (event.key === 'Enter') finish(event.target !== cancel);
    if (event.key === 'Escape') finish(false);
  };
  // Focus loss is not consent to save: touch release and nested dialogs can blur
  // a newly opened field. Only an explicit Save/Import action commits a draft.
  const blur = () => {
    window.clearTimeout(refocusTimer);
    refocusTimer = window.setTimeout(() => {
      if (ownsInput() && document.hasFocus() && !actions.contains(document.activeElement) && !document.getElementById('update-recovery'))
        input.focus({ preventScroll: true });
    }, 0);
  };
  let refocusTimer: number | undefined;
  const cleanup = () => {
    finished = true;
    window.clearTimeout(timer);
    window.clearTimeout(refocusTimer);
    for (const control of controls) { control.removeEventListener('keydown', keydown); control.removeEventListener('blur', blur); }
    cancel.removeEventListener('click', onCancel); save.removeEventListener('click', onSave);
    sizeObserver.disconnect(); window.removeEventListener('resize', positionControls);
    actions.remove();
    delete input.dataset.folioEditor;
    error?.remove();
    cleanups.delete(input);
    scene.events.off('shutdown', shutdown);
  };
  const shutdown = () => disposeFolioEditor(input);
  const onCancel = () => finish(false), onSave = () => finish(true);
  cancel.addEventListener('click', onCancel); save.addEventListener('click', onSave);
  for (const control of controls) { control.addEventListener('keydown', keydown); control.addEventListener('blur', blur); }
  scene.events.once('shutdown', shutdown);
  cleanups.set(input, cleanup);
  const timer = window.setTimeout(() => {
    if (ownsInput() && !document.getElementById('update-recovery')) {
      input.focus({ preventScroll: true }); input.select();
    }
  }, 0);
}
