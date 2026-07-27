export interface ScreenReaderRuntimeState {
  observerActive: boolean;
  summaryLoaded: boolean;
  lastAnnouncement: string;
}

const REGION_ID = 'game-status';
const POLL_MS = 300;
let enabled = false;
let observer: number | undefined;
let lastAnnouncement = '';
type ScreenReaderSummaryModule = typeof import('./screen-reader-summary');
let summaryModulePromise: Promise<ScreenReaderSummaryModule> | undefined;

function statusRegion() {
  return typeof document === 'undefined' ? null : document.getElementById(REGION_ID);
}

function loadScreenReaderSummary() {
  return summaryModulePromise ??= import('./screen-reader-summary');
}

export function announceScreenReaderRuntime(message: string) {
  if (!enabled) return false;
  const region = statusRegion();
  const normalized = message.trim();
  if (!region || !normalized || normalized === lastAnnouncement) return false;
  lastAnnouncement = normalized;
  region.textContent = normalized;
  region.dataset.announcement = normalized;
  return true;
}

async function pollScreenReaderState() {
  if (!enabled) return;
  try {
    const raw = window.render_game_to_text?.();
    if (!raw) return;
    const summary = await loadScreenReaderSummary();
    if (!enabled) return;
    announceScreenReaderRuntime(summary.screenReaderSummary(JSON.parse(raw)));
  } catch {
    // A transient scene handoff can replace the text-state function mid-poll.
  }
}

export function enableScreenReaderRuntime() {
  enabled = true;
  const region = statusRegion();
  region?.setAttribute('aria-live', 'polite');
  region?.setAttribute('aria-hidden', 'false');
  if (observer === undefined && typeof window !== 'undefined') {
    observer = window.setInterval(() => void pollScreenReaderState(), POLL_MS);
    window.setTimeout(() => void pollScreenReaderState(), 0);
  }
  announceScreenReaderRuntime('Screen reader announcements on. Use arrow keys to navigate and Confirm to select.');
}

export function disableScreenReaderRuntime() {
  enabled = false;
  if (observer !== undefined && typeof window !== 'undefined') {
    window.clearInterval(observer);
    observer = undefined;
  }
  lastAnnouncement = '';
  const region = statusRegion();
  if (region) {
    region.setAttribute('aria-live', 'off');
    region.setAttribute('aria-hidden', 'true');
    region.textContent = '';
    delete region.dataset.announcement;
  }
}

export function screenReaderRuntimeState(): ScreenReaderRuntimeState {
  return {
    observerActive: observer !== undefined,
    summaryLoaded: summaryModulePromise !== undefined,
    lastAnnouncement,
  };
}
