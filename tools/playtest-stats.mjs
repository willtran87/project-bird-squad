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
  console.log('Play some runs, then in the browser console run window.__birdSquadExportRuns()');
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
  for (const item of items.filter(Boolean)) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};

const avg = (nums) => (nums.length
  ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
  : 0);

const sumCombat = (run, key) => (run.combatResults ?? [])
  .reduce((sum, combat) => sum + (combat[key] ?? 0), 0);

const sumDecision = (run, key) => {
  if (run.decisionStats?.[key] !== undefined) return run.decisionStats[key] ?? 0;
  return (run.combatResults ?? []).reduce((sum, combat) => sum + (combat.decisionStats?.[key] ?? 0), 0);
};

const printTop = (label, entries) => {
  console.log(`\n${label}:`);
  if (entries.length === 0) {
    console.log('  (none recorded)');
    return;
  }
  for (const [key, n] of entries.slice(0, 5)) console.log(`  ${n}x  ${key}`);
};

const wins = runs.filter((r) => r.result === 'win').length;
const losses = runs.filter((r) => r.result === 'loss').length;

console.log(`Playtest stats - ${runs.length} run(s): ${wins} win / ${losses} loss`);
if (runs.length) {
  console.log(`Avg turns taken: ${avg(runs.map((r) => r.turnsTaken ?? 0))}`);
  console.log(`Avg final Cohesion: ${avg(runs.map((r) => r.currentCohesion ?? 0))}`);
  console.log(`Avg Cohesion lost per run: ${avg(runs.map((r) => sumCombat(r, 'cohesionLost')))}`);
  console.log(`Avg damage dealt per run: ${avg(runs.map((r) => sumCombat(r, 'damageDealt')))}`);
  console.log(`Avg cards played per run: ${avg(runs.map((r) => sumDecision(r, 'cardsPlayed')))}`);
  console.log(`Avg overextensions per run: ${avg(runs.map((r) => sumDecision(r, 'overextensions')))}`);
  console.log(`Avg low-card Roosts per run: ${avg(runs.map((r) => sumDecision(r, 'lowCardTurns')))}`);
  console.log(`Avg held cards at Roost: ${avg(runs.map((r) => sumDecision(r, 'cardsHeldAtRoost')))}`);
  console.log(`Avg unspent Wingbeat at Roost: ${avg(runs.map((r) => sumDecision(r, 'unspentWingbeatAtRoost')))}`);
  console.log(`Avg boss-entry Scrap: ${avg(runs.map((r) => r.decisionStats?.bossEntryScrap ?? 0).filter((n) => n > 0))}`);
  console.log(`Avg boss-entry Cohesion: ${avg(runs.map((r) => r.decisionStats?.bossEntryCohesion ?? 0).filter((n) => n > 0))}`);
}

printTop('Deadliest (killed by)', tally(runs.filter((r) => r.killedBy).map((r) => r.killedBy)));
printTop('Leader results', tally(runs.map((r) => `${r.leaderId ?? 'unknown'}:${r.result}`)));
printTop('Most-chosen Signals', tally(runs.flatMap((r) => (r.signals ?? []).map((s) => `${s.signalId}:${s.choiceKey}`))));
printTop('Most-skipped reward offers', tally(runs.flatMap((r) => (r.cardRewards ?? []).filter((c) => c.skipped).flatMap((c) => c.offered))));
printTop('Reward fallback choices', tally(runs.flatMap((r) => (r.cardRewards ?? []).filter((c) => c.skipped).map((c) => c.fallback ?? 'unknown'))));
printTop('Supplies used', tally(runs.flatMap((r) => r.suppliesUsed ?? [])));
printTop('Most common encounter enemies', tally(runs.flatMap((r) => (r.combatResults ?? []).flatMap((c) => c.enemyIds ?? []))));
printTop('Most-visited nodes', tally(runs.flatMap((r) => r.path ?? [])));

const hardestCombats = runs
  .flatMap((r) => (r.combatResults ?? []).map((c) => [`${c.nodeType}:${c.encounterId}`, c.cohesionLost ?? 0]))
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);

console.log('\nHighest Cohesion-loss combats:');
if (hardestCombats.length === 0) console.log('  (none recorded)');
for (const [label, lost] of hardestCombats) console.log(`  ${lost} lost  ${label}`);
