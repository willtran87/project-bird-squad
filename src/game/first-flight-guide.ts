import { readJournaledJson, writeJournaledJson } from './safe-storage';

const STORAGE_KEY = 'birdsquad.firstFlightGuide';

export type FirstFlightGuideStep = 'route' | 'card' | 'roost' | 'reward' | 'complete' | 'off';
type TrackedGuideStep = Exclude<FirstFlightGuideStep, 'complete' | 'off'>;
const TRACKED_STEPS: TrackedGuideStep[] = ['route', 'card', 'roost', 'reward'];

export type FirstFlightGuideProgress = {
  enabled: boolean;
  completed: boolean;
  routeCommits: number;
  cardsPlayed: number;
  roosts: number;
  rewardsResolved: number;
  seen: TrackedGuideStep[];
  skipped: number;
  replays: number;
  moltLessonSeen: number;
  moltLessonCompleted: boolean;
};

const freshGuide = (): FirstFlightGuideProgress => ({
  enabled: true,
  completed: false,
  routeCommits: 0,
  cardsPlayed: 0,
  roosts: 0,
  rewardsResolved: 0,
  seen: [],
  skipped: 0,
  replays: 0,
  moltLessonSeen: 0,
  moltLessonCompleted: false
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteCount(value: unknown) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0;
}

export function sanitizeGuide(value: unknown): FirstFlightGuideProgress | undefined {
  if (!isRecord(value)) return undefined;
  const fresh = freshGuide();
  const seen = Array.isArray(value.seen)
    ? value.seen.filter((step): step is TrackedGuideStep => TRACKED_STEPS.includes(step as TrackedGuideStep))
    : [];
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : fresh.enabled,
    completed: value.completed === true,
    routeCommits: finiteCount(value.routeCommits),
    cardsPlayed: finiteCount(value.cardsPlayed),
    roosts: finiteCount(value.roosts),
    rewardsResolved: finiteCount(value.rewardsResolved),
    seen: [...new Set(seen)],
    skipped: finiteCount(value.skipped),
    replays: finiteCount(value.replays),
    moltLessonSeen: finiteCount(value.moltLessonSeen),
    moltLessonCompleted: value.moltLessonCompleted === true,
  };
}

export function firstFlightGuideProgress(): FirstFlightGuideProgress {
  return readJournaledJson(STORAGE_KEY, sanitizeGuide) ?? freshGuide();
}

const save = (progress: FirstFlightGuideProgress) => writeJournaledJson(STORAGE_KEY, progress);

export function firstFlightGuideStep(progress = firstFlightGuideProgress()): FirstFlightGuideStep {
  if (!progress.enabled) return progress.completed ? 'complete' : 'off';
  if (progress.routeCommits < 1) return 'route';
  if (progress.cardsPlayed < 1) return 'card';
  if (progress.roosts < 1) return 'roost';
  if (progress.rewardsResolved < 1) return 'reward';
  return 'complete';
}

export function recordFirstFlightGuideEvent(event: TrackedGuideStep) {
  const progress = firstFlightGuideProgress();
  if (!progress.enabled || progress.completed) return;
  if (event === 'route') progress.routeCommits += 1;
  else if (event === 'card') progress.cardsPlayed += 1;
  else if (event === 'roost') progress.roosts += 1;
  else progress.rewardsResolved += 1;
  if (event === 'reward') {
    progress.completed = true;
    progress.enabled = false;
  }
  save(progress);
}

export function markFirstFlightGuideSeen(step: FirstFlightGuideStep) {
  if (!TRACKED_STEPS.includes(step as TrackedGuideStep)) return;
  const progress = firstFlightGuideProgress();
  const tracked = step as TrackedGuideStep;
  if (!progress.seen.includes(tracked)) {
    progress.seen.push(tracked);
    save(progress);
  }
}

export function skipFirstFlightGuide() {
  const progress = firstFlightGuideProgress();
  progress.enabled = false;
  progress.skipped += 1;
  save(progress);
}

export function replayFirstFlightGuide() {
  const previous = firstFlightGuideProgress();
  save({ ...freshGuide(), skipped: previous.skipped, replays: previous.replays + 1 });
}

export function firstMoltGuideState(hasMoltCard = false) {
  const progress = firstFlightGuideProgress();
  const eligible = progress.completed && !progress.moltLessonCompleted;
  return {
    eligible,
    active: eligible && hasMoltCard,
    seen: progress.moltLessonSeen,
    completed: progress.moltLessonCompleted,
  };
}

export function markFirstMoltGuideSeen() {
  const progress = firstFlightGuideProgress();
  if (!progress.completed || progress.moltLessonCompleted || progress.moltLessonSeen > 0) return;
  progress.moltLessonSeen = 1;
  save(progress);
}

export function completeFirstMoltGuide() {
  const progress = firstFlightGuideProgress();
  if (!progress.completed || progress.moltLessonCompleted) return;
  progress.moltLessonCompleted = true;
  save(progress);
}

export function firstFlightGuideState() {
  const progress = firstFlightGuideProgress();
  return { ...progress, step: firstFlightGuideStep(progress) };
}
