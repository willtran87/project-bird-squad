import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.BIRD_SQUAD_PAGES_PORT ?? 5440);
const outDir = process.env.BIRD_SQUAD_PAGES_BUILD_DIR ?? '.artifacts/pages-build';
const base = '/project-bird-squad/';
const preview = `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --strictPort --base=${base} --outDir=${outDir}`;

export default defineConfig({
  testDir: './tools/tests', testMatch: 'pages-smoke.spec.ts',
  workers: 1, retries: 0, timeout: 120000,
  outputDir: '.artifacts/pages-smoke',
  use: { baseURL: `http://127.0.0.1:${port}${base}`, trace: 'retain-on-failure' },
  projects: [{ name: 'pages-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: process.env.BIRD_SQUAD_PAGES_PREBUILT === '1' ? preview
      : `npm run build -- --base=${base} --outDir=${outDir} && ${preview}`,
    url: `http://127.0.0.1:${port}${base}`, reuseExistingServer: false, timeout: 180000,
  },
});
