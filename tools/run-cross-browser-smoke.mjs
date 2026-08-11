#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const cli = path.resolve('node_modules', '@playwright', 'test', 'cli.js');
const requested = process.argv.slice(2);
const tests = requested.length > 0
  ? requested
  : [
      'tests/smoke.spec.ts',
      '--grep',
      'title boot paints generated controls once|sold-out Market stock remains in the spoken unavailable inventory|opt-in screen reader announcements follow',
      '--workers=1',
      '--reporter=line',
    ];
const result = spawnSync(process.execPath, [cli, 'test', ...tests], {
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
