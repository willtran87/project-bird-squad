#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const kb = 1024;

const budgets = [
  { label: 'splash WebP', dir: 'assets/splash', pattern: /\.webp$/i, maxKb: 350 },
  { label: 'flock leader WebP', dir: 'assets/runtime/flock/leaders', pattern: /\.webp$/i, maxKb: 280 },
  { label: 'encounter enemy WebP', dir: 'assets/runtime/enemies/full', pattern: /\.webp$/i, maxKb: 260 },
  { label: 'reserve enemy WebP', dir: 'assets/runtime/enemies/reserve', pattern: /\.webp$/i, maxKb: 220 },
  { label: 'card portrait WebP', dir: 'assets/runtime/cards/portrait', pattern: /\.webp$/i, maxKb: 800 },
  { label: 'card thumbnail WebP', dir: 'assets/runtime/cards/thumb', pattern: /\.webp$/i, maxKb: 125 },
  { label: 'card icon WebP', dir: 'assets/runtime/cards/icon', pattern: /\.webp$/i, maxKb: 80 },
  { label: 'waymark icon WebP', dir: 'assets/runtime/waymarks/icons', pattern: /\.webp$/i, maxKb: 24 },
  { label: 'route node icon WebP', dir: 'assets/runtime/map-icons/icons', pattern: /\.webp$/i, maxKb: 32 },
  { label: 'battlefield backdrop WebP', dir: 'assets/runtime/backdrops', pattern: /\.webp$/i, maxKb: 420 },
];

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return [full];
  });
}

const failures = [];
let checked = 0;

for (const budget of budgets) {
  const dir = path.join(root, budget.dir);
  const files = listFiles(dir).filter((file) => budget.pattern.test(path.basename(file)));
  if (files.length === 0) {
    failures.push(`${budget.label}: no files matched in ${budget.dir}`);
    continue;
  }
  for (const file of files) {
    checked += 1;
    const sizeKb = fs.statSync(file).size / kb;
    if (sizeKb > budget.maxKb) {
      failures.push(`${path.relative(root, file).replaceAll(path.sep, '/')}: ${sizeKb.toFixed(1)} KB exceeds ${budget.maxKb} KB ${budget.label} budget`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Runtime asset size validation failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Runtime asset size validation passed. Checked ${checked} optimized runtime assets.`);
