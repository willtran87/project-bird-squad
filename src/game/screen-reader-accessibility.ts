import { safeStorageGet, safeStorageRemove, safeStorageSet } from './safe-storage';

export type ScreenReaderPreference = 'off' | 'on';

export interface ScreenReaderState {
  preference: ScreenReaderPreference;
  enabled: boolean;
  regionReady: boolean;
  observerActive: boolean;
  lastAnnouncement: string;
}

const STORAGE_KEY = 'birdsquad.screenReader';
const REGION_ID = 'game-status';
const POLL_MS = 300;
let sessionPreference: ScreenReaderPreference | undefined;
let preferenceLoaded = false;
let observer: number | undefined;
let lastAnnouncement = '';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function number(value: unknown) {
  return Number.isFinite(value) ? Number(value) : undefined;
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function spaced(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
}

function statusRegion() {
  return typeof document === 'undefined' ? null : document.getElementById(REGION_ID);
}

export function screenReaderPreference(): ScreenReaderPreference {
  if (preferenceLoaded) return sessionPreference ?? 'off';
  preferenceLoaded = true;
  const stored = safeStorageGet(STORAGE_KEY);
  if (stored === 'on' || stored === 'off') sessionPreference = stored;
  else if (stored !== null) safeStorageRemove(STORAGE_KEY);
  return sessionPreference ?? 'off';
}

export function screenReaderSummary(payload: unknown): string {
  if (!isRecord(payload)) return '';
  const mode = text(payload.mode);
  const scene = text(payload.scene);
  const settingsOpen = payload.settingsOpen === true || payload.settingsOverlayOpen === true;
  const settingsFocus = isRecord(payload.settingsFocus) ? payload.settingsFocus : undefined;
  if (settingsOpen && settingsFocus) {
    const label = text(settingsFocus.label) || 'setting';
    return `Settings. ${label}. Use Up and Down to move, Left and Right to adjust.`;
  }

  if (scene === 'MenuScene' || mode === 'menu') {
    if (payload.helpOpen === true) return 'How to Play is open. Press Back to close.';
    const focus = isRecord(payload.titleFocus) ? payload.titleFocus : undefined;
    const label = text(focus?.label) || 'Choose a setup, then start a run';
    return `Bird Squad menu. ${label}. Press Confirm to select.`;
  }

  if (scene === 'ProfileScene' || mode === 'profile') {
    const focus = isRecord(payload.focus) ? payload.focus : undefined;
    const current = spaced(text(focus?.current)) || 'Flock Record';
    return `Flock Record. ${current}. Press Confirm to select, or Back to return.`;
  }

  if (scene === 'RouteScene' || mode === 'routeSelection') {
    const map = isRecord(payload.map) ? payload.map : undefined;
    const run = isRecord(payload.run) ? payload.run : undefined;
    const selectedNodeId = text(payload.selectedNodeId);
    const nodes = records(payload.nodes);
    const selected = nodes.find((node) => text(node.id) === selectedNodeId)
      ?? nodes.find((node) => node.selectable === true);
    const mapName = text(map?.name) || 'current district';
    const nodeLabel = text(selected?.label) || 'available route';
    const risk = text(selected?.risk);
    const hp = number(run?.currentHp);
    const maxHp = number(run?.maxHp);
    const scrap = number(run?.scrap);
    const resources = hp === undefined || maxHp === undefined
      ? ''
      : ` Cohesion ${hp} of ${maxHp}.${scrap === undefined ? '' : ` Scrap ${scrap}.`}`;
    return `Route, ${mapName}. Selected ${nodeLabel}${risk ? `, ${risk} risk` : ''}.${resources} Press Confirm to inspect or commit.`;
  }

  if (scene === 'BattleScene') {
    if (payload.paused === true) return 'Battle paused. Use Settings, Resume, or Return to menu.';
    const turn = number(payload.turn) ?? 0;
    const energy = number(payload.energy) ?? 0;
    const flock = isRecord(payload.flock) ? payload.flock : undefined;
    const hp = number(flock?.hp) ?? 0;
    const maxHp = number(flock?.maxHp) ?? 0;
    const hand = records(payload.hand);
    const enemies = records(payload.enemies);
    const selectedCardId = text(payload.selectedCard);
    const selectedCard = hand.find((card) => text(card.instanceId) === selectedCardId);
    const selectedEnemyId = text(payload.selectedEnemy);
    const selectedEnemy = enemies.find((enemy) => text(enemy.id) === selectedEnemyId);
    const latestLog = Array.isArray(payload.log) ? text(payload.log.at(-1)) : '';
    const enemyMove = text(payload.combatEnemyTurnMove);
    const inputFocus = isRecord(payload.combatInputFocus) ? payload.combatInputFocus : undefined;
    if (enemyMove) {
      return `Enemy turn, ${enemyMove}.${latestLog ? ` ${latestLog}` : ''} Cohesion ${hp} of ${maxHp}.`;
    }
    if (mode === 'cardReward' || mode === 'upgradeReward' || mode === 'waymarkReward') {
      const source = mode === 'cardReward'
        ? records(payload.rewardChoices)
        : mode === 'upgradeReward'
          ? records(payload.upgradeChoices)
          : records(payload.waymarkChoices);
      const choices = source.map((choice) => text(choice.name)).filter(Boolean);
      const focusedLabel = text(inputFocus?.label);
      const focusedIndex = number(inputFocus?.index);
      const focusedCount = number(inputFocus?.count);
      const focused = focusedLabel
        ? ` Focused ${focusedLabel}${focusedIndex !== undefined && focusedCount !== undefined ? `, choice ${focusedIndex + 1} of ${focusedCount}` : ''}.`
        : '';
      return `Reward choice.${focused}${choices.length ? ` Options: ${choices.join(', ')}.` : ''} Use Previous and Next to choose, then Confirm. Use Skip Reward for Scrap when available.`;
    }
    if (selectedCard) {
      const name = text(selectedCard.name) || 'card';
      const cost = number(selectedCard.cost) ?? 0;
      const rules = text(selectedCard.activeText);
      const target = selectedEnemy ? ` Target ${text(selectedEnemy.name)}.` : '';
      return `Turn ${turn}. Selected ${name}, cost ${cost}.${target}${rules ? ` ${rules}` : ''} Wingbeats ${energy}. Cohesion ${hp} of ${maxHp}.`;
    }
    return `Combat, turn ${turn}. Wingbeats ${energy}. Cohesion ${hp} of ${maxHp}. ${hand.length} cards in hand, ${enemies.filter((enemy) => (number(enemy.hp) ?? 0) > 0).length} enemies.${latestLog ? ` ${latestLog}` : ''}`;
  }

  if (mode === 'codex') {
    const section = spaced(text(payload.section)) || 'cards';
    const focus = isRecord(payload.codexFocus) ? payload.codexFocus : undefined;
    const focusLabel = text(focus?.label);
    const zone = text(focus?.zone);
    const position = number(focus?.index);
    const count = number(focus?.count);
    const detail = text(payload.detailOpen);
    const itemPosition = zone === 'entries' && position !== undefined && count !== undefined
      ? ` Item ${position + 1} of ${count}.`
      : '';
    return `Codex, ${section}.${focusLabel ? ` ${focusLabel}.` : ''}${itemPosition}${detail ? ' Detail open.' : ''} ${detail ? 'Use Up and Down to scroll, then Confirm or Back to close.' : 'Use Tab to change focus, Previous and Next to navigate, and Confirm to select.'}`;
  }
  return scene ? `${spaced(scene)}.` : '';
}

export function announceScreenReader(message: string) {
  if (screenReaderPreference() !== 'on') return false;
  const region = statusRegion();
  const normalized = message.trim();
  if (!region || !normalized || normalized === lastAnnouncement) return false;
  lastAnnouncement = normalized;
  region.textContent = normalized;
  region.dataset.announcement = normalized;
  return true;
}

function pollScreenReaderState() {
  if (screenReaderPreference() !== 'on') return;
  try {
    const raw = window.render_game_to_text?.();
    if (!raw) return;
    announceScreenReader(screenReaderSummary(JSON.parse(raw)));
  } catch {
    // A transient scene handoff can replace the text-state function mid-poll.
  }
}

function startObserver() {
  if (observer !== undefined || typeof window === 'undefined') return;
  observer = window.setInterval(pollScreenReaderState, POLL_MS);
  window.setTimeout(pollScreenReaderState, 0);
}

function stopObserver() {
  if (observer === undefined || typeof window === 'undefined') return;
  window.clearInterval(observer);
  observer = undefined;
}

export function setScreenReaderPreference(value: ScreenReaderPreference): boolean {
  preferenceLoaded = true;
  sessionPreference = value;
  const stored = safeStorageSet(STORAGE_KEY, value);
  const region = statusRegion();
  if (region) {
    region.setAttribute('aria-live', value === 'on' ? 'polite' : 'off');
    region.setAttribute('aria-hidden', String(value !== 'on'));
  }
  lastAnnouncement = '';
  if (value === 'on') {
    startObserver();
    announceScreenReader('Screen reader announcements on. Use arrow keys to navigate and Confirm to select.');
  } else {
    stopObserver();
    if (region) {
      region.textContent = '';
      delete region.dataset.announcement;
    }
  }
  return stored;
}

export function initializeScreenReaderAccessibility() {
  const preference = screenReaderPreference();
  const region = statusRegion();
  if (region) {
    region.setAttribute('aria-live', preference === 'on' ? 'polite' : 'off');
    region.setAttribute('aria-hidden', String(preference !== 'on'));
  }
  if (preference === 'on') startObserver();
}

export function screenReaderState(): ScreenReaderState {
  const preference = screenReaderPreference();
  return {
    preference,
    enabled: preference === 'on',
    regionReady: Boolean(statusRegion()),
    observerActive: observer !== undefined,
    lastAnnouncement,
  };
}
