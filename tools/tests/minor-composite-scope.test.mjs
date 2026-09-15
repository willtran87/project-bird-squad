import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('minor composite validation remains strict by default and rejects unknown pilot ids', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bird-composite-scope-'));
  try {
    const run = (...args) => spawnSync(process.execPath, ['tools/validate-minor-composites.mjs', dir, ...args], { encoding: 'utf8' });
    const full = run();
    assert.equal(full.status, 1);
    assert.match(full.stderr, /expected 56 total composite PNGs/);
    const invalid = run('--card-id=unknown');
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /Unknown Minor Arcana card id: unknown/);
    const pilot = run('--card-id=wands_ace');
    assert.equal(pilot.status, 1);
    assert.match(pilot.stderr, /expected 1 total composite PNGs/);
    assert.doesNotMatch(pilot.stderr, /basins|quills|nests/);
  } finally {
    rmSync(dir, { recursive: true }); // Exact mkdtemp-owned directory only.
  }
});
