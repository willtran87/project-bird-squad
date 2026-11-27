#!/usr/bin/env node
// Runs the cross-browser release smoke set (tools/browser-smoke-set.mjs) under
// the browser matrix. Extra arguments (--project, --shard, --workers, ...) are
// passed through to Playwright.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { browserSmokeFiles, browserSmokeGrep } from './browser-smoke-set.mjs';

const cli = path.resolve('node_modules', '@playwright', 'test', 'cli.js');
const files = [...browserSmokeFiles.map((name) => `tests/${name}.spec.ts`), 'tests/smoke-'];
const result = spawnSync(process.execPath, [cli, 'test', ...files, '--grep', browserSmokeGrep, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    BIRD_SQUAD_BROWSER_MATRIX: '1',
    BIRD_SQUAD_SMOKE_PORT: process.env.BIRD_SQUAD_SMOKE_PORT ?? '43040',
  },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
