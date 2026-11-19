import type { GameMode, RunMode } from './runtime-types';

export const isRunOutcome = (mode: GameMode) => mode === 'runComplete' || mode === 'defeat';

const sharedRouteParams = new URLSearchParams(window.location.search);

export const PLAYTEST_MODE = sharedRouteParams.get('playtest') === '1';

const sharedRouteCandidate = sharedRouteParams.get('flight') ?? '';

export const SHARED_ROUTE_SEED = /^[a-z0-9_-]{1,32}$/i.test(sharedRouteCandidate) ? sharedRouteCandidate : undefined;

export const SHARED_ROUTE_MODE: RunMode = sharedRouteParams.get('length') === 'quick' ? 'quick' : 'full';

export const LAZY_LOAD_FAILED = 'Load failed';

export const RUN_MODE_SUMMARY: Record<RunMode, string> = {
  quick: 'Quick, 3 districts, no tier unlock',
  full: 'Full, 4 districts, unlocks tiers',
};
