#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const assetsDir = path.join(path.resolve(root, process.argv[2] ?? '.artifacts/build'), 'assets');
const kb = 1024;

const budgets = [
  { label: 'flight workshop lazy module', pattern: /^flight-workshop-.*\.js$/, maxKb: 6, hard: true },
  { label: 'build guidance shared lazy module', pattern: /^build-guidance-.*\.js$/, maxKb: 5, hard: true },
  { label: 'flight highlights shared lazy module', pattern: /^flight-highlights-.*\.js$/, maxKb: 3, hard: true },
  { label: 'living bird performance lazy module', pattern: /^living-performances-.*\.js$/, maxKb: 6, hard: true },
  { label: 'combat actions and FX lazy module', pattern: /^combat-fx-assets-.*\.js$/, maxKb: 64, hard: true },
  { label: 'Flock identity lazy module', pattern: /^flock-identity-.*\.js$/, maxKb: 14, hard: true },
  { label: 'High Roost lazy module', pattern: /^high-roost-.*\.js$/, maxKb: 14, hard: true },
  { label: 'canal markets lazy module', pattern: /^canal-markets-.*\.js$/, maxKb: 10, hard: true },
  { label: 'signal spires lazy module', pattern: /^signal-spires-.*\.js$/, maxKb: 12, hard: true },
  { label: 'opening district lazy module', pattern: /^opening-district-.*\.js$/, maxKb: 9, hard: true },
  { label: 'enemy breathing lazy module', pattern: /^enemy-breathing-.*\.js$/, maxKb: 2, hard: true },
  { label: 'shared run HUD lazy module', pattern: /^run-hud-.*\.js$/, maxKb: 10, hard: true },
  { label: 'route transition FX lazy module', pattern: /^route-transition-fx-.*\.js$/, maxKb: 7, hard: true },
  { label: 'battle state snapshot lazy module', pattern: /^battle-state-snapshot-.*\.js$/, maxKb: 12, hard: true },
  { label: 'battle outcome scene lazy module', pattern: /^battle-outcome-scene-.*\.js$/, maxKb: 8, hard: true },
  { label: 'Flyway expansion lazy module', pattern: /^flyway-expansion-.*\.js$/, maxKb: 32, hard: true },
  { label: 'app entry', pattern: /^index-.*\.js$/, maxKb: 700, targetKb: 675, hard: true },
  { label: 'game core', pattern: /^game-core-.*\.js$/, maxKb: 30, hard: true },
  { label: 'interaction rules', pattern: /^interaction-rules-.*\.js$/, maxKb: 12, hard: true },
  { label: 'adaptive music lazy module', pattern: /^adaptive-music-.*\.js$/, maxKb: 8, hard: true },
  { label: 'synthesized SFX lazy module', pattern: /^audio-sfx-.*\.js$/, maxKb: 8, hard: true },
  { label: 'battle FX presenter lazy module', pattern: /^fx-presenter-.*\.js$/, maxKb: 8, hard: true },
  { label: 'encounter intro lazy module', pattern: /^encounter-intro-.*\.js$/, maxKb: 4, hard: true },
  { label: 'battle debug-state lazy module', pattern: /^debug-state-.*\.js$/, maxKb: 10, hard: true },
  { label: 'battle backdrop renderer lazy module', pattern: /^render-backdrop-.*\.js$/, maxKb: 4, hard: true },
  { label: 'battle foreground renderer lazy module', pattern: /^render-foreground-.*\.js$/, maxKb: 8, hard: true },
  { label: 'battle HUD renderer lazy module', pattern: /^render-hud-.*\.js$/, maxKb: 10, hard: true },
  { label: 'battle hand renderer lazy module', pattern: /^render-hand-.*\.js$/, maxKb: 10, hard: true },
  { label: 'combat card reading panel', pattern: /^combat-card-detail-.*\.js$/, maxKb: 4, hard: true },
  { label: 'shared reward card face', pattern: /^reward-card-face-.*\.js$/, maxKb: 4, hard: true },
  { label: 'discard choice lazy module', pattern: /^discard-choice-.*\.js$/, maxKb: 6, hard: true },
  { label: 'discard return choice lazy module', pattern: /^return-choice-.*\.js$/, maxKb: 6, hard: true },
  { label: 'battle inspect renderer lazy module', pattern: /^render-inspect-.*\.js$/, maxKb: 12, hard: true },
  { label: 'battle reward renderer lazy module', pattern: /^render-reward-.*\.js$/, maxKb: 14, hard: true },
  { label: 'card detail lazy module', pattern: /^card-hover-detail-.*\.js$/, maxKb: 10, hard: true },
  { label: 'card comparison lazy module', pattern: /^card-comparison-.*\.js$/, maxKb: 6, hard: true },
  { label: 'Route deck browser lazy module', pattern: /^route-deck-browser-.*\.js$/, maxKb: 8, hard: true },
  { label: 'saved Flight Folios lazy module', pattern: /^saved-decks-.*\.js$/, maxKb: 8, hard: true },
  // Includes measured rule pagination and contextual term reading in both phases.
  { label: 'Route supply drawer lazy module', pattern: /^route-supply-drawer-.*\.js$/, maxKb: 5, hard: true },
  { label: 'Route reward overlay lazy module', pattern: /^route-reward-overlay-.*\.js$/, maxKb: 6, hard: true },
  { label: 'Waymark review lazy module', pattern: /^waymark-review-.*\.js$/, maxKb: 8, hard: true },
  { label: 'Route text-state lazy module', pattern: /^route-debug-state-.*\.js$/, maxKb: 24.25, hard: true },
  { label: 'Route map renderer lazy module', pattern: /^route-map-renderer-.*\.js$/, maxKb: 5, hard: true },
  { label: 'Route map inspection lazy module', pattern: /^route-map-inspection-.*\.js$/, maxKb: 5, hard: true },
  { label: 'flock stats overlay lazy module', pattern: /^flock-stats-overlay-.*\.js$/, maxKb: 8, hard: true },
  { label: 'screen reader runtime lazy module', pattern: /^screen-reader-runtime-.*\.js$/, maxKb: 4, hard: true },
  { label: 'menu diagnostics lazy module', pattern: /^menu-debug-state-.*\.js$/, maxKb: 7, hard: true },
  { label: 'menu optional UI lazy module', pattern: /^menu-optional-ui-.*\.js$/, maxKb: 6, hard: true },
  { label: 'setup portraits lazy module', pattern: /^setup-portraits-.*\.js$/, maxKb: 1, hard: true },
  { label: 'title launch lazy module', pattern: /^title-run-launch-.*\.js$/, maxKb: 4, hard: true },
  { label: 'Profile scene lazy module', pattern: /^profile-scene-.*\.js$/, maxKb: 170, hard: true },
  { label: 'Codex lazy data', pattern: /^codex-data-.*\.js$/, maxKb: 300, hard: true },
  { label: 'Phaser vendor', pattern: /^vendor-phaser-.*\.js$/, maxKb: 1400, hard: false },
];
const combinedBootBudget = {
  label: 'combined app boot code',
  patterns: [/^index-.*\.js$/, /^game-core-.*\.js$/, /^interaction-rules-.*\.js$/],
  maxKb: 710,
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
// Extracting a shared presentation must not silently enlarge the previous
// hand + ceremony allowance (10 + 14 KiB). Count the new dependency as well.
const rewardPresentation = chunks.filter(chunk => /^(render-hand|render-reward|reward-card-face)-.*\.js$/.test(chunk.name));
const rewardPresentationKb = rewardPresentation.reduce((sum, chunk) => sum + chunk.kb, 0);
console.log(`Combined hand/reward presentation: ${rewardPresentationKb.toFixed(1)} KB minified`);
if (rewardPresentation.length !== 3 || rewardPresentationKb > 24) failures.push('Combined hand/reward presentation exceeds its original 24 KB allowance or is incomplete.');
// Vite may emit a tiny index launcher plus the explicitly owned app chunk.
// Require every boot family and count every matching byte against the same cap.
if (combinedBootBudget.patterns.some(pattern => !combinedBootChunks.some(chunk => pattern.test(chunk.name)))) {
  failures.push(`${combinedBootBudget.label}: a required boot chunk family is missing`);
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
