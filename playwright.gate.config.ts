import { defineConfig } from '@playwright/test';
import base from './playwright.config';
import pkg from './package.json' with { type: 'json' };

// Fast gate (about 15 min at 3 workers): the ordered-sequence smoke set plus
// the feature and save/resume specs and the 1000x560 geometry sweep most
// likely to catch a regression. Run the full suite (test:e2e) nightly or
// before a release.
const sequencing = pkg.scripts['test:sequencing'].match(/--grep "(.*)"$/)![1];
const featureSpecs = [
  'card-objects', 'combat-life', 'retained-actors', 'scene-life', 'presentation-polish', 'platform-features',
  'collection-ceremony', 'daily-flight', 'run-recap', 'narrative-threads', 'enemy-cluster-layout', 'clear-choices',
  'hand-readability', 'reward-checkpoint', 'checkpoint-interruption-journey',
  'finished-run-recovery', 'opening-district', 'phone-landscape',
].map((name) => `**/${name}.spec.ts`);
const chromium = base.projects![0];

export default defineConfig({
  ...base,
  testIgnore: undefined,
  testMatch: undefined,
  projects: [
    { ...chromium, name: 'gate-sequence', testMatch: ['**/smoke-*.spec.ts', '**/asset-loading-recovery.spec.ts', '**/wheel-input-ownership.spec.ts'], grep: new RegExp(sequencing) },
    { ...chromium, name: 'gate-features', testMatch: featureSpecs },
    // General layout rules on every main screen at the smallest supported window.
    { ...chromium, name: 'gate-geometry', testMatch: '**/screen-geometry-sweep.spec.ts', grep: /at 1000x560$/ },
  ],
});
