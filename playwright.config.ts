import { defineConfig, devices } from '@playwright/test';

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
    baseURL: 'http://127.0.0.1:5273',
    trace: 'off',
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5273',
    url: 'http://127.0.0.1:5273',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
