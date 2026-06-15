#!/usr/bin/env node
// tools/playtest-stats.mjs
//
// Aggregates local RunSummary artifacts into playtest stats
// (next-level-implementation-spec Phase 5 Local Playtest Stats).
//
// Reads a JSON array of run summaries. Default path: .artifacts/runs.json.
// Export them from a play session with `window.__birdSquadExportRuns()` (it
// returns the localStorage 'birdsquad.runs' JSON) and save to that file.
//
// Usage: node tools/playtest-stats.mjs [path-to-runs.json]

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rel = process.argv[2] ?? '.artifacts/runs.json';
const full = path.join(root, rel);

if (!fs.existsSync(full)) {
  console.log(`No run summaries found at ${rel}.`);
  console.log("Play some runs, then in the browser console run window.__birdSquadExportRuns()");
  console.log(`and save the JSON array to ${rel}.`);
  process.exit(0);
}

let runs;
try {
  runs = JSON.parse(fs.readFileSync(full, 'utf8'));
} catch (error) {
  console.error(`Failed to parse ${rel}: ${error.message}`);
  process.exit(1);
}
if (!Array.isArray(runs)) runs = [];

const tally = (items) => {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};
const avg = (nums) => (nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : 0);
const printTop = (label, entries) => {
  console.log(`\n${label}:`);
  if (entries.length === 0) { console.log('  (none recorded)'); return; }
  for (const [key, n] of entries.slice(0, 5)) console.log(`  ${n}×  ${key}`);
};

const wins = runs.filter((r) => r.result === 'win').length;
const losses = runs.filter((r) => r.result === 'loss').length;

console.log(`Playtest stats — ${runs.length} run(s): ${wins} win / ${losses} loss`);
if (runs.length) {
  console.log(`Avg turns taken: ${avg(runs.map((r) => r.turnsTaken ?? 0))}`);
  console.log(`Avg final Cohesion: ${avg(runs.map((r) => r.currentCohesion ?? 0))}`);
}

printTop('Deadliest (killed by)', tally(runs.filter((r) => r.killedBy).map((r) => r.killedBy)));
printTop('Most-chosen Signals', tally(runs.flatMap((r) => (r.signals ?? []).map((s) => `${s.signalId}:${s.choiceKey}`))));
printTop('Most-skipped reward offers', tally(runs.flatMap((r) => (r.cardRewards ?? []).filter((c) => c.skipped).flatMap((c) => c.offered))));
printTop('Most-visited nodes', tally(runs.flatMap((r) => r.path ?? [])));
