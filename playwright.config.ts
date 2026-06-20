import { defineConfig, devices } from '@playwright/test';

const smokePort = Number(process.env.BIRD_SQUAD_SMOKE_PORT ?? 5373);
const smokeBaseUrl = `http://127.0.0.1:${smokePort}`;

// Smoke-test harness for Bird Squad (next-level-implementation-spec Validation
// Plan). Tests assert against the in-game text-state harness exposed on window
// (__birdSquadGame / __birdSquadState / __birdSquadLastRun), which is fast and
// deterministic — no canvas-pixel assertions.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: smokeBaseUrl,
    trace: 'off',
  },
  webServer: {
    command: `npm run build && node ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${smokePort}`,
    env: {
      ...process.env,
      BIRD_SQUAD_SMOKE: '1',
    },
    url: smokeBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
