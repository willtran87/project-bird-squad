#!/usr/bin/env node
// Local, aggregate-only playtest dashboard. Seeded fallback data verifies the
// reporting pipeline and is always labeled; it must not support balance claims.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const requestedInputs = args.filter((arg) => !arg.startsWith('--'));
const relInputs = requestedInputs.length > 0 ? requestedInputs : ['.artifacts/runs.json'];
const dashboardPath = path.join(root, '.artifacts', 'playtest-dashboard.md');
const round = (n) => Math.round(n * 10) / 10;
const pct = (n, total) => total ? `${round((n / total) * 100)}%` : '0%';
const avg = (values) => values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
};
const sumDecision = (run, key) => (run.combatResults ?? [])
  .reduce((sum, combat) => sum + (combat.decisionStats?.[key] ?? 0), 0);
const tally = (values) => {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
};
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${row.join(' | ')} |`),
].join('\n');

function seededRuns() {
  const leaders = ['fledgling', 'spark_caller', 'talon', 'tidewarden', 'roostkeeper'];
  const cards = ['wands_02', 'swords_02', 'cups_02', 'pentacles_02'];
  return Array.from({ length: 10 }, (_, i) => {
    const loss = i === 2 || i === 6 || i === 9;
    const fights = loss ? 2 + (i % 3) : 5 + (i % 2);
    const combatResults = Array.from({ length: fights }, (_unused, fight) => ({
      encounterId: `seeded_encounter_${fight}`,
      nodeId: `m${Math.min(4, 1 + Math.floor(fight / 2))}_${fight === fights - 1 && !loss ? 'boss' : `street_${fight}`}`,
      nodeType: fight === fights - 1 && !loss ? 'boss' : 'street',
      turnsTaken: 2 + ((i + fight) % 4),
      durationMs: 58_000 + i * 4_000 + fight * 7_000,
      cohesionLost: (i + fight) % 9,
      damageDealt: 18 + fight * 5,
      killedByMove: loss && fight === fights - 1 ? ['Toll Line', 'Static Burst', 'Floodgate Slam'][i % 3] : undefined,
      damageTakenByMove: [{
        enemyId: `seeded_enemy_${fight}`,
        moveId: `seeded_move_${fight}`,
        moveLabel: ['Toll Line', 'Static Burst', 'Floodgate Slam'][fight % 3],
        damageTaken: (i + fight) % 9,
        blockedDamage: (i + fight + 2) % 5,
        hitCount: 1 + ((i + fight) % 2),
      }],
      decisionStats: {
        cardsPlayed: 5 + fight,
        turnEnds: 2 + (fight % 3),
        overextensions: (i + fight) % 3 === 0 ? 1 : 0,
        invalidActions: (i + fight) % 4 === 0 ? 1 : 0,
        cancelledActions: (i + fight) % 3 === 0 ? 1 : 0,
      }
    }));
    const routeDecisions = Array.from({ length: fights }, (_unused, n) => ({
      offered: [`route_${n}_a`, `route_${n}_b`],
      picked: `route_${n}_${(i + n) % 3 === 0 ? 'b' : 'a'}`,
      decisionMs: 4_000 + ((i + n) % 5) * 1_100,
    }));
    const cardRewards = Array.from({ length: Math.max(0, fights - 1) }, (_unused, n) => ({
      offered: [cards[(i + n) % cards.length], cards[(i + n + 1) % cards.length], cards[(i + n + 2) % cards.length]],
      picked: (i + n) % 4 === 0 ? undefined : cards[(i + n) % cards.length],
      skipped: (i + n) % 4 === 0,
      fallback: (i + n) % 4 === 0 ? 'scrap' : undefined,
      decisionMs: 5_500 + ((i + n) % 6) * 1_250,
    }));
    return {
      id: `seeded-dashboard-${i + 1}`, seed: `dashboard-${i + 1}`, source: 'seeded-pipeline',
      result: loss ? 'loss' : 'win', leaderId: leaders[i % leaders.length], runMode: i % 3 === 0 ? 'quick' : 'full',
      mapId: `map_${loss ? 1 + (i % 3) : 4}`, killedBy: loss ? combatResults.at(-1).killedByMove : undefined,
      turnsTaken: combatResults.reduce((sum, combat) => sum + combat.turnsTaken, 0),
      durationMs: combatResults.reduce((sum, combat) => sum + combat.durationMs, 0) + 120_000,
      scrapEarned: 30 + i * 3, scrapSpent: 12 + (i % 4) * 4, finalScrap: 18 + i,
      currentCohesion: loss ? 0 : 12 + i, path: routeDecisions.map((decision) => decision.picked),
      combatResults, routeDecisions, cardRewards,
      combatPace: ['cinematic', 'standard', 'snappy'][i % 3],
      animationPace: ['relaxed', 'standard', 'fast'][i % 3],
      firstFlightGuide: { completed: i > 1, skipped: i === 1 ? 1 : 0 },
    };
  });
}

function inputFilesFor(relInput) {
  const full = path.resolve(root, relInput);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isDirectory()) {
    return fs.readdirSync(full, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      .map((entry) => path.join(full, entry.name))
      .sort((a, b) => a.localeCompare(b));
  }
  return [full];
}

const inputFiles = [...new Set(relInputs.flatMap(inputFilesFor))];
let runs;
let source = relInputs.join(', ');
if (inputFiles.length > 0) {
  const merged = [];
  for (const file of inputFiles) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      console.error(`Failed to parse ${path.relative(root, file)}: ${error.message}`);
      process.exit(1);
    }
    if (!Array.isArray(parsed)) {
      console.error(`Expected an array of run summaries in ${path.relative(root, file)}.`);
      process.exit(1);
    }
    merged.push(...parsed);
  }
  const seen = new Set();
  runs = merged.filter((run, index) => {
    const id = run && typeof run === 'object' && typeof run.id === 'string'
      ? run.id
      : `anonymous-${index}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  source = inputFiles.map((file) => path.relative(root, file)).join(', ');
} else if (args.includes('--seeded-if-empty') || args.includes('--seeded')) {
  runs = seededRuns();
  source = 'seeded pipeline harness (not human playtest evidence)';
} else {
  console.log(`No run summaries found at ${relInputs.join(', ')}. Run with --seeded to verify the dashboard pipeline.`);
  process.exit(0);
}

const funnel = [
  ['Run started', runs.length],
  ['First route committed', runs.filter((run) => (run.routeDecisions?.length ?? run.path?.length ?? 0) > 0).length],
  ['First card played', runs.filter((run) => sumDecision(run, 'cardsPlayed') > 0).length],
  ['First Roost', runs.filter((run) => sumDecision(run, 'turnEnds') > 0).length],
  ['First fight cleared', runs.filter((run) => (run.path?.length ?? 0) > 0).length],
  ['First reward resolved', runs.filter((run) => (run.cardRewards?.length ?? 0) > 0).length],
  ['District boss cleared', runs.filter((run) => (run.combatResults ?? []).some((combat) => combat.nodeType === 'boss' && !combat.killedByMove)).length],
];
const rewards = runs.flatMap((run) => run.cardRewards ?? []);
const rewardCards = [...new Set(rewards.flatMap((reward) => reward.offered ?? []))].map((card) => {
  const offered = rewards.filter((reward) => reward.offered?.includes(card)).length;
  const picked = rewards.filter((reward) => reward.picked === card).length;
  return [card, offered, picked, pct(picked, offered)];
}).sort((a, b) => b[1] - a[1]);
const routeDecisions = runs.flatMap((run) => run.routeDecisions ?? []);
const routePicks = [...new Set(routeDecisions.flatMap((decision) => decision.offered ?? []))].map((node) => {
  const offered = routeDecisions.filter((decision) => decision.offered?.includes(node)).length;
  const picked = routeDecisions.filter((decision) => decision.picked === node).length;
  return [node, offered, picked, pct(picked, offered)];
}).sort((a, b) => b[1] - a[1]);
const leaderRows = tally(runs.map((run) => run.leaderId ?? 'unknown')).map(([leader, count]) => {
  const leaderRuns = runs.filter((run) => (run.leaderId ?? 'unknown') === leader);
  return [leader, count, pct(leaderRuns.filter((run) => run.result === 'win').length, count), `${avg(leaderRuns.map((run) => run.durationMs ?? 0))} ms`];
});
const deathRows = tally(runs.filter((run) => run.result === 'loss').map((run) => `${run.mapId ?? 'unknown'} / ${run.killedBy ?? run.combatResults?.at(-1)?.killedByMove ?? 'unknown'}`));
const paceRows = tally(runs.map((run) => run.combatPace ?? 'unrecorded'));
const animationPaceRows = tally(runs.map((run) => run.animationPace ?? 'unrecorded'));
const firstFightDurations = runs.map((run) => run.combatResults?.[0]?.durationMs).filter(Number.isFinite);
const activeDecisionTimes = runs.map((run) => [
  ...(run.routeDecisions ?? []).map((decision) => decision.decisionMs ?? 0),
  ...(run.cardRewards ?? []).map((reward) => reward.decisionMs ?? 0),
].reduce((sum, value) => sum + value, 0));
const movePressure = new Map();
runs.flatMap((run) => run.combatResults ?? []).flatMap((combat) => combat.damageTakenByMove ?? []).forEach((entry) => {
  const key = `${entry.enemyId ?? 'unknown'} / ${entry.moveLabel ?? entry.moveId ?? 'unknown'}`;
  const total = movePressure.get(key) ?? { damage: 0, blocked: 0, hits: 0 };
  total.damage += entry.damageTaken ?? 0;
  total.blocked += entry.blockedDamage ?? 0;
  total.hits += entry.hitCount ?? 0;
  movePressure.set(key, total);
});
const movePressureRows = [...movePressure.entries()]
  .map(([move, total]) => [move, total.damage, total.blocked, total.hits])
  .sort((a, b) => b[1] - a[1] || b[2] - a[2]);
const invalidActions = runs.reduce((sum, run) => sum + sumDecision(run, 'invalidActions'), 0);
const cancelledActions = runs.reduce((sum, run) => sum + sumDecision(run, 'cancelledActions'), 0);
const experienceDimensions = [
  ['fun', 'Fun'],
  ['fairness', 'Fairness'],
  ['clarity', 'Clarity'],
  ['replay', 'Replay intent'],
];
const experienceRuns = runs.filter((run) => experienceDimensions.every(([key]) => {
  const value = run.experienceFeedback?.[key];
  return Number.isFinite(value) && value >= 1 && value <= 5;
}));
const experienceRows = experienceDimensions.map(([key, label]) => {
  const ratings = experienceRuns.map((run) => run.experienceFeedback[key]);
  return [label, ratings.length, ratings.length ? `${avg(ratings)} / 5` : 'No human ratings', ratings.filter((rating) => rating <= 2).length];
});

const lines = [
  '# Bird Squad Playtest Dashboard', '',
  `Source: **${source}**`,
  source.startsWith('seeded') ? '> Seeded rows verify telemetry and report completeness only. Do not use them for balance conclusions.' : '',
  '', '## Overview', '',
  table(['Runs', 'Wins', 'Losses', 'Median first fight', 'Avg active decision time'], [[
    runs.length, runs.filter((run) => run.result === 'win').length, runs.filter((run) => run.result === 'loss').length,
    `${median(firstFightDurations)} ms`, `${avg(activeDecisionTimes)} ms`
  ]]),
  '', '## Experience Ratings', '',
  `Complete latest-run responses: **${experienceRuns.length}/${runs.length}**. Ratings are local, voluntary human evidence; seeded runs intentionally provide none.`, '',
  table(['Dimension', 'Responses', 'Average', 'Low ratings (1-2)'], experienceRows),
  '', '## Completion Funnel', '', table(['Milestone', 'Runs', 'Conversion'], funnel.map(([label, count]) => [label, count, pct(count, runs.length)])),
  '', '## Economy', '', table(['Metric', 'Average'], [
    ['Scrap earned', avg(runs.map((run) => run.scrapEarned ?? 0))],
    ['Scrap spent', avg(runs.map((run) => run.scrapSpent ?? 0))],
    ['Final Scrap', avg(runs.map((run) => run.finalScrap ?? 0))],
  ]),
  '', `## Rewards (${rewards.length} decisions, ${pct(rewards.filter((reward) => reward.skipped).length, rewards.length)} skipped)`, '',
  table(['Card', 'Offered', 'Picked', 'Pick rate'], rewardCards.slice(0, 12)),
  '', '## Route Alternatives', '', table(['Node', 'Offered', 'Picked', 'Pick rate'], routePicks.slice(0, 16)),
  '', '## Leaders', '', table(['Leader', 'Runs', 'Win rate', 'Avg duration'], leaderRows),
  '', '## Deaths', '', table(['District / move', 'Deaths'], deathRows.length ? deathRows : [['None', 0]]),
  '', '## Enemy Move Pressure', '', table(['Enemy / move', 'Cohesion lost', 'Cover blocked', 'Hits'], movePressureRows.length ? movePressureRows.slice(0, 16) : [['None', 0, 0, 0]]),
  '', '## Input Friction', '', table(['Invalid card/target actions', 'Cancelled selections'], [[invalidActions, cancelledActions]]),
  '', '## Combat Pacing', '', table(['Preference', 'Runs'], paceRows),
  '', '## Animation Pacing', '', table(['Preference', 'Runs'], animationPaceRows),
  '', '## Telemetry Contract', '',
  '- `turnsTaken`: total of `combatResults[].turnsTaken`.',
  '- Economy: `scrapEarned`, `scrapSpent`, and `finalScrap` remain separate.',
  '- Timing: `combatResults[].durationMs`, `routeDecisions[].decisionMs`, and `cardRewards[].decisionMs`.',
  '- Choice rates use recorded offer denominators, never selection counts alone.',
  '- Deaths use the final `killedByMove` when available.',
  '- Enemy pressure uses `combatResults[].damageTakenByMove` resolved at Impact.',
  '- Input friction uses `decisionStats.invalidActions` and `decisionStats.cancelledActions` from live click handlers.',
  '- Presentation preference uses `animationPace` captured when the run ends.',
  '- Subjective evidence uses only runs with complete 1-5 `experienceFeedback` ratings for fun, fairness, clarity, and replay intent.',
];

fs.mkdirSync(path.dirname(dashboardPath), { recursive: true });
fs.writeFileSync(dashboardPath, `${lines.filter((line) => line !== undefined).join('\n')}\n`);
console.log(lines.slice(0, 18).join('\n'));
console.log(`\nDashboard written to ${path.relative(root, dashboardPath)} (${runs.length} runs).`);
