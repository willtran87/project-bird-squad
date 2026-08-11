import type Phaser from 'phaser';
import { safeStorageGet, safeStorageRemove, safeStorageSet } from './safe-storage';

export type ControlAction =
  | 'confirm'
  | 'back'
  | 'previous'
  | 'next'
  | 'pause'
  | 'roost'
  | 'hustle'
  | 'skipReward'
  | 'mute'
  | 'fullscreen'
  | 'settings'
  | 'guide';

export type ControlBindingPage = 'play' | 'utility';

export interface ControlBindingDefinition {
  action: ControlAction;
  label: string;
  page: ControlBindingPage;
  defaultCode: string;
}

export type ControlBindings = Record<ControlAction, string>;

export interface ControlBindingUpdate {
  action: ControlAction;
  code: string;
  swappedAction?: ControlAction;
  persisted: boolean;
}

const STORAGE_KEY = 'birdsquad.controlBindings';

export const CONTROL_BINDING_DEFINITIONS: readonly ControlBindingDefinition[] = [
  { action: 'confirm', label: 'Confirm', page: 'play', defaultCode: 'Enter' },
  { action: 'back', label: 'Back', page: 'play', defaultCode: 'Escape' },
  { action: 'previous', label: 'Previous', page: 'play', defaultCode: 'ArrowLeft' },
  { action: 'next', label: 'Next', page: 'play', defaultCode: 'ArrowRight' },
  { action: 'pause', label: 'Pause', page: 'play', defaultCode: 'KeyP' },
  { action: 'roost', label: 'Roost', page: 'play', defaultCode: 'KeyR' },
  { action: 'hustle', label: 'Hustle', page: 'utility', defaultCode: 'Space' },
  { action: 'skipReward', label: 'Run Kit / Skip', page: 'utility', defaultCode: 'KeyX' },
  { action: 'mute', label: 'Mute', page: 'utility', defaultCode: 'KeyM' },
  { action: 'fullscreen', label: 'Full Screen', page: 'utility', defaultCode: 'KeyF' },
  { action: 'settings', label: 'Settings', page: 'utility', defaultCode: 'KeyS' },
  { action: 'guide', label: 'How to Play', page: 'utility', defaultCode: 'KeyH' },
] as const;

const ACTIONS = CONTROL_BINDING_DEFINITIONS.map((definition) => definition.action);
const RESERVED_CODES = new Set(['Tab', ...Array.from({ length: 9 }, (_, index) => `Digit${index + 1}`)]);
const DISALLOWED_CODES = new Set([
  'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight',
  'ShiftLeft', 'ShiftRight', 'CapsLock', 'ContextMenu', 'NumLock', 'ScrollLock',
  ...Array.from({ length: 24 }, (_, index) => `F${index + 1}`),
]);

const CODE_LABELS: Record<string, string> = {
  Enter: 'Enter',
  Escape: 'Esc',
  Space: 'Space',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Insert: 'Insert',
  Digit0: '0',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
};

const PHASER_KEY_SUFFIX: Record<string, string> = {
  Enter: 'ENTER',
  Escape: 'ESC',
  Space: 'SPACE',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  Backspace: 'BACKSPACE',
  Delete: 'DELETE',
  Home: 'HOME',
  End: 'END',
  PageUp: 'PAGE_UP',
  PageDown: 'PAGE_DOWN',
  Insert: 'INSERT',
  Digit0: 'ZERO',
};

let cachedBindings: ControlBindings | undefined;
const bindingSubscribers = new Set<() => void>();
let bindingNotificationQueued = false;

function defaultBindings(): ControlBindings {
  return Object.fromEntries(
    CONTROL_BINDING_DEFINITIONS.map((definition) => [definition.action, definition.defaultCode]),
  ) as ControlBindings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assignWithSwap(bindings: ControlBindings, action: ControlAction, code: string): ControlAction | undefined {
  const previousCode = bindings[action];
  const swappedAction = ACTIONS.find((candidate) => candidate !== action && bindings[candidate] === code);
  bindings[action] = code;
  if (swappedAction) bindings[swappedAction] = previousCode;
  return swappedAction;
}

function loadBindings(): ControlBindings {
  if (cachedBindings) return cachedBindings;
  const bindings = defaultBindings();
  const raw = safeStorageGet(STORAGE_KEY);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      const stored = isRecord(parsed) && isRecord(parsed.bindings) ? parsed.bindings : parsed;
      if (isRecord(stored)) {
        for (const action of ACTIONS) {
          const code = stored[action];
          if (typeof code === 'string' && isBindableControlCode(code)) assignWithSwap(bindings, action, code);
        }
      }
    } catch {
      safeStorageRemove(STORAGE_KEY);
    }
  }
  cachedBindings = bindings;
  return bindings;
}

function persistBindings(bindings: ControlBindings): boolean {
  return safeStorageSet(STORAGE_KEY, JSON.stringify({ version: 1, bindings }));
}

function notifyBindingSubscribers() {
  if (bindingNotificationQueued) return;
  bindingNotificationQueued = true;
  queueMicrotask(() => {
    bindingNotificationQueued = false;
    for (const subscriber of bindingSubscribers) subscriber();
  });
}

function phaserKeySuffix(code: string): string | undefined {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  return PHASER_KEY_SUFFIX[code];
}

export function isBindableControlCode(code: string): boolean {
  if (!code || RESERVED_CODES.has(code) || DISALLOWED_CODES.has(code)) return false;
  return /^Key[A-Z]$/.test(code)
    || code === 'Digit0'
    || code.startsWith('Arrow')
    || Object.prototype.hasOwnProperty.call(CODE_LABELS, code);
}

export function controlCodeLabel(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  return CODE_LABELS[code] ?? code.replace(/^Digit/, '');
}

export function controlActionLabel(action: ControlAction): string {
  return CONTROL_BINDING_DEFINITIONS.find((definition) => definition.action === action)?.label ?? action;
}

export function controlBindingsSnapshot(): ControlBindings {
  return { ...loadBindings() };
}

export function controlBindingCode(action: ControlAction): string {
  return loadBindings()[action];
}

export function controlBindingLabel(action: ControlAction): string {
  return controlCodeLabel(controlBindingCode(action));
}

export function controlActionForCode(code: string): ControlAction | undefined {
  return ACTIONS.find((action) => controlBindingCode(action) === code);
}

export function controlBindingsAreDefault(): boolean {
  const bindings = loadBindings();
  return CONTROL_BINDING_DEFINITIONS.every((definition) => bindings[definition.action] === definition.defaultCode);
}

export function setControlBinding(action: ControlAction, code: string): ControlBindingUpdate | undefined {
  if (!isBindableControlCode(code)) return undefined;
  const bindings = { ...loadBindings() };
  const swappedAction = assignWithSwap(bindings, action, code);
  cachedBindings = bindings;
  const persisted = persistBindings(bindings);
  notifyBindingSubscribers();
  return { action, code, swappedAction, persisted };
}

export function resetControlBindings(): boolean {
  cachedBindings = defaultBindings();
  const persisted = safeStorageRemove(STORAGE_KEY);
  notifyBindingSubscribers();
  return persisted;
}

export function matchesControlAction(event: Pick<KeyboardEvent, 'code'>, action: ControlAction): boolean {
  return event.code === controlBindingCode(action);
}

export function controlPanelRegistryKey(scene: Phaser.Scene): string {
  return `birdsquad.controlsPanel.${scene.scene.key}`;
}

export function settingsOverlayInputRegistryKey(scene: Phaser.Scene): string {
  return `birdsquad.settingsInput.${scene.scene.key}`;
}

export function controlCaptureRegistryKey(scene: Phaser.Scene): string {
  return `birdsquad.controlsCapture.${scene.scene.key}`;
}

export function controlPanelPageRegistryKey(scene: Phaser.Scene): string {
  return `birdsquad.controlsPage.${scene.scene.key}`;
}

export function controlPanelFocusRegistryKey(scene: Phaser.Scene): string {
  return `birdsquad.controlsFocus.${scene.scene.key}`;
}

export function controlPanelOwnsInput(scene: Phaser.Scene): boolean {
  return Boolean(scene.registry.get(controlPanelRegistryKey(scene)))
    || Boolean(scene.registry.get(settingsOverlayInputRegistryKey(scene)));
}

export function bindControlActions(
  scene: Phaser.Scene,
  handlers: Partial<Record<ControlAction, (event?: KeyboardEvent) => void>>,
): () => void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) return () => {};

  const dispatchedEvents = new WeakSet<object>();
  let specificListeners: Array<{ event: string; listener: (event?: KeyboardEvent) => void }> = [];
  let cleanedUp = false;

  const dispatch = (action: ControlAction, event?: KeyboardEvent) => {
    if (controlPanelOwnsInput(scene) && event) return;
    const handler = handlers[action];
    if (!handler) return;
    if (event && typeof event === 'object') {
      if (dispatchedEvents.has(event)) return;
      dispatchedEvents.add(event);
      event.preventDefault?.();
      event.stopPropagation?.();
    }
    handler(event);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!event?.code || controlPanelOwnsInput(scene)) return;
    const action = ACTIONS.find((candidate) => handlers[candidate] && matchesControlAction(event, candidate));
    if (action) dispatch(action, event);
  };

  const removeSpecificListeners = () => {
    for (const binding of specificListeners) keyboard.off(binding.event, binding.listener);
    specificListeners = [];
  };

  const refreshSpecificListeners = () => {
    if (cleanedUp) return;
    removeSpecificListeners();
    for (const action of ACTIONS) {
      if (!handlers[action]) continue;
      const suffix = phaserKeySuffix(controlBindingCode(action));
      if (!suffix) continue;
      const event = `keydown-${suffix}`;
      const listener = (keyboardEvent?: KeyboardEvent) => dispatch(action, keyboardEvent);
      keyboard.on(event, listener);
      specificListeners.push({ event, listener });
    }
  };

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    keyboard.off('keydown', onKeyDown);
    removeSpecificListeners();
    bindingSubscribers.delete(refreshSpecificListeners);
    scene.events.off('shutdown', cleanup);
  };

  keyboard.on('keydown', onKeyDown);
  bindingSubscribers.add(refreshSpecificListeners);
  refreshSpecificListeners();
  scene.events.once('shutdown', cleanup);
  return cleanup;
}
