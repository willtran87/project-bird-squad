#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { freshPlayerGate } from './release-evidence-policy.mjs';

const root = process.cwd();
const sessionDir = path.join(root, '.artifacts', 'playtest-sessions');
const auditFile = path.join(root, '.artifacts', 'release-evidence', 'manual-audits.json');
const failures = [];
let humanGate = { waived: false };
try {
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'docs/game/release-evidence-policy.json'), 'utf8'));
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  humanGate = freshPlayerGate(policy, version, process.argv.includes('--strict-human'));
  if (humanGate.error) failures.push(humanGate.error);
  if (humanGate.notice) console.log(humanGate.notice);
} catch (error) {
  failures.push(`Release policy: ${error.message}`);
}
const ratings = ['fun', 'fairness', 'clarity', 'replay'];
const validRating = (value) => Number.isFinite(value) && value >= 1 && value <= 5;

const sessionFiles = fs.existsSync(sessionDir)
  ? fs.readdirSync(sessionDir).filter((name) => name.toLowerCase().endsWith('.json'))
  : [];
const noteFiles = fs.existsSync(sessionDir)
  ? fs.readdirSync(sessionDir).filter((name) => name.toLowerCase().endsWith('.md'))
  : [];
const notes = noteFiles.map((name) => fs.readFileSync(path.join(sessionDir, name), 'utf8'));
const runs = [];

for (const name of sessionFiles) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(sessionDir, name), 'utf8'));
    if (!Array.isArray(parsed)) {
      failures.push(`${name}: expected an array of exported run summaries.`);
      continue;
    }
    parsed.forEach((run) => runs.push({ ...run, evidenceFile: name }));
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

const uniqueRuns = [...new Map(runs
  .filter((run) => typeof run?.id === 'string' && run.id.trim())
  .map((run) => [run.id, run])).values()];
const humanRuns = uniqueRuns.filter((run) => (
  !String(run.source ?? '').toLowerCase().includes('seeded')
  && ratings.every((key) => validRating(run.experienceFeedback?.[key]))
));

if (humanRuns.length < 5 && !humanGate.waived) {
  failures.push(`Fresh-player evidence: found ${humanRuns.length}/5 unique, non-seeded runs with complete Fun, Fairness, Clarity, and Replay ratings.`);
}
for (const run of humanRuns.slice(0, 5)) {
  if (!notes.some((note) => note.includes(`Exported run ID: ${run.id}`))) {
    failures.push(`Fresh-player evidence: no observer note names exported run ID ${run.id}.`);
  }
}

let audits = [];
if (fs.existsSync(auditFile)) {
  try {
    audits = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
    if (!Array.isArray(audits)) {
      failures.push('manual-audits.json must contain an array.');
      audits = [];
    }
  } catch (error) {
    failures.push(`manual-audits.json: ${error.message}`);
  }
} else {
  failures.push('Manual evidence: missing .artifacts/release-evidence/manual-audits.json.');
}

const completedAudits = audits.filter((audit) => (
  audit?.passed === true
  && typeof audit.revision === 'string' && audit.revision.trim()
  && typeof audit.notes === 'string' && audit.notes.trim()
));
const requires = [
  ['physical-device', 'windows', 'low-end Windows device'],
  ['physical-device', 'android', 'Android tablet'],
  ['physical-device', 'ipad', 'iPad'],
  ['assistive-tech', 'nvda', 'NVDA'],
  ['assistive-tech', 'voiceover', 'VoiceOver'],
];
for (const [kind, environment, label] of requires) {
  const found = completedAudits.some((audit) => (
    String(audit.kind).toLowerCase() === kind
    && String(audit.environment).toLowerCase().includes(environment)
  ));
  if (!found) failures.push(`Manual evidence: missing passing ${label} audit with revision and notes.`);
}

console.log(`Release evidence: ${humanRuns.length} rated human runs, ${noteFiles.length} observer notes, ${completedAudits.length} completed manual audits.`);
if (failures.length) {
  console.error('\nRelease evidence validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Release evidence validation passed.');
