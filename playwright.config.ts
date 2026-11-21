import { defineConfig, devices } from '@playwright/test';

const smokePort = Number(process.env.BIRD_SQUAD_SMOKE_PORT ?? 5373);
const smokeBaseUrl = `http://127.0.0.1:${smokePort}`;
const browserMatrix = process.env.BIRD_SQUAD_BROWSER_MATRIX === '1';
// Tests are independent (each gets its own page and storage), so files split
// across workers. BIRD_SQUAD_WORKERS overrides the default of 3.
const workers = Number(process.env.BIRD_SQUAD_WORKERS ?? 3);
// BIRD_SQUAD_REUSE_BUILD=1 serves the existing .artifacts/build instead of
// rebuilding first. Only use it when the build is known to match the source.
const build = process.env.BIRD_SQUAD_REUSE_BUILD === '1' ? '' : 'npm run build && ';

// Smoke-test harness for Bird Squad (next-level-implementation-spec Validation
// Plan). Tests assert against the in-game text-state harness exposed on window
// (__birdSquadGame / __birdSquadState / __birdSquadLastRun), which is fast and
// deterministic — no canvas-pixel assertions.
// Full start-to-finish flights and catalog sweeps: 4% of tests, about a third
// of suite time. test:e2e:standard leaves them out; test:e2e:long runs only
// them (see playwright.tiers.config.ts).
export const LONG_SPECS = [
  'run-progression-journey', 'reference-input-paths', 'reference-flight-controls', 'p0-encounter-catalog',
  'map-inspection', 'event-navigation-polish', 'market-navigation-polish', 'folio-tools-polish',
].map((name) => `**/${name}.spec.ts`);
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry absorbs load-induced timing flakes on a shared machine; a test
  // that only passes on retry is still reported as flaky, so it stays visible.
  retries: 1,
  workers,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: smokeBaseUrl,
    trace: 'off',
  },
  webServer: {
    command: `${build}node ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${smokePort}`,
    env: {
      ...process.env,
      BIRD_SQUAD_SMOKE: '1',
    },
    url: smokeBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: browserMatrix
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      ]
    : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
