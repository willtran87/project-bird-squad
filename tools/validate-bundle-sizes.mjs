#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const assetsDir = path.join(root, '.artifacts', 'build', 'assets');
const kb = 1024;

const budgets = [
  { label: 'app entry', pattern: /^index-.*\.js$/, maxKb: 700, targetKb: 675, hard: true },
  { label: 'game core', pattern: /^game-core-.*\.js$/, maxKb: 30, hard: true },
  { label: 'adaptive music lazy module', pattern: /^adaptive-music-.*\.js$/, maxKb: 8, hard: true },
  { label: 'battle FX presenter lazy module', pattern: /^fx-presenter-.*\.js$/, maxKb: 8, hard: true },
  { label: 'battle debug-state lazy module', pattern: /^debug-state-.*\.js$/, maxKb: 8, hard: true },
  { label: 'battle backdrop renderer lazy module', pattern: /^render-backdrop-.*\.js$/, maxKb: 4, hard: true },
  { label: 'battle foreground renderer lazy module', pattern: /^render-foreground-.*\.js$/, maxKb: 8, hard: true },
  { label: 'battle HUD renderer lazy module', pattern: /^render-hud-.*\.js$/, maxKb: 10, hard: true },
  { label: 'battle hand renderer lazy module', pattern: /^render-hand-.*\.js$/, maxKb: 10, hard: true },
  { label: 'battle inspect renderer lazy module', pattern: /^render-inspect-.*\.js$/, maxKb: 12, hard: true },
  { label: 'battle reward renderer lazy module', pattern: /^render-reward-.*\.js$/, maxKb: 14, hard: true },
  { label: 'card detail lazy module', pattern: /^card-hover-detail-.*\.js$/, maxKb: 10, hard: true },
  { label: 'card comparison lazy module', pattern: /^card-comparison-.*\.js$/, maxKb: 6, hard: true },
  { label: 'Route deck browser lazy module', pattern: /^route-deck-browser-.*\.js$/, maxKb: 8, hard: true },
  { label: 'Route supply drawer lazy module', pattern: /^route-supply-drawer-.*\.js$/, maxKb: 4, hard: true },
  { label: 'Route reward overlay lazy module', pattern: /^route-reward-overlay-.*\.js$/, maxKb: 6, hard: true },
  { label: 'Waymark review lazy module', pattern: /^waymark-review-.*\.js$/, maxKb: 8, hard: true },
  { label: 'Route text-state lazy module', pattern: /^route-debug-state-.*\.js$/, maxKb: 24, hard: true },
  { label: 'flock stats overlay lazy module', pattern: /^flock-stats-overlay-.*\.js$/, maxKb: 8, hard: true },
  { label: 'screen reader runtime lazy module', pattern: /^screen-reader-runtime-.*\.js$/, maxKb: 4, hard: true },
  { label: 'Codex lazy data', pattern: /^codex-data-.*\.js$/, maxKb: 300, hard: true },
  { label: 'Phaser vendor', pattern: /^vendor-phaser-.*\.js$/, maxKb: 1400, hard: false },
];
const combinedBootBudget = {
  label: 'combined app boot code',
  patterns: [/^index-.*\.js$/, /^game-core-.*\.js$/],
  maxKb: 725,
  targetKb: 710,
};

if (!fs.existsSync(assetsDir)) {
  console.error('Missing .artifacts/build/assets. Run `npm run build` before validating bundle sizes.');
  process.exit(1);
}

const chunks = fs.readdirSync(assetsDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => {
    const file = path.join(assetsDir, name);
    const bytes = fs.readFileSync(file);
    return {
      name,
      kb: bytes.length / kb,
      gzipKb: zlib.gzipSync(bytes).length / kb,
    };
  })
  .sort((a, b) => b.kb - a.kb);

const failures = [];
const warnings = [];

for (const budget of budgets) {
  const matches = chunks.filter((chunk) => budget.pattern.test(chunk.name));
  if (matches.length === 0) {
    failures.push(`${budget.label}: no chunk matched ${budget.pattern}`);
    continue;
  }
  for (const chunk of matches) {
    if (budget.targetKb && chunk.kb > budget.targetKb) {
      warnings.push(`${budget.label} ${chunk.name}: ${chunk.kb.toFixed(1)} KB exceeds ${budget.targetKb} KB target`);
    }
    if (chunk.kb <= budget.maxKb) continue;
    const message = `${budget.label} ${chunk.name}: ${chunk.kb.toFixed(1)} KB exceeds ${budget.maxKb} KB budget`;
    if (budget.hard) failures.push(message);
    else warnings.push(message);
  }
}

const combinedBootChunks = chunks.filter((chunk) => combinedBootBudget.patterns.some((pattern) => pattern.test(chunk.name)));
if (combinedBootChunks.length !== combinedBootBudget.patterns.length) {
  failures.push(`${combinedBootBudget.label}: expected ${combinedBootBudget.patterns.length} chunks, found ${combinedBootChunks.length}`);
} else {
  const combinedKb = combinedBootChunks.reduce((sum, chunk) => sum + chunk.kb, 0);
  const combinedGzipKb = combinedBootChunks.reduce((sum, chunk) => sum + chunk.gzipKb, 0);
  console.log(`Combined boot code: ${combinedKb.toFixed(1)} KB minified, ${combinedGzipKb.toFixed(1)} KB gzip`);
  if (combinedKb > combinedBootBudget.targetKb) {
    warnings.push(`${combinedBootBudget.label}: ${combinedKb.toFixed(1)} KB exceeds ${combinedBootBudget.targetKb} KB target`);
  }
  if (combinedKb > combinedBootBudget.maxKb) {
    failures.push(`${combinedBootBudget.label}: ${combinedKb.toFixed(1)} KB exceeds ${combinedBootBudget.maxKb} KB budget`);
  }
}

console.log('Bundle size report:');
for (const chunk of chunks) {
  console.log(`- ${chunk.name}: ${chunk.kb.toFixed(1)} KB minified, ${chunk.gzipKb.toFixed(1)} KB gzip`);
}

if (warnings.length > 0) {
  console.warn('\nBundle size warnings:');
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (failures.length > 0) {
  console.error('\nBundle size validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('\nBundle size validation passed.');
