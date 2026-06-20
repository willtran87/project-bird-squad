#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const assetsDir = path.join(root, '.artifacts', 'build', 'assets');
const kb = 1024;

const budgets = [
  { label: 'app entry', pattern: /^index-.*\.js$/, maxKb: 675, targetKb: 590, hard: true },
  { label: 'Codex lazy data', pattern: /^codex-data-.*\.js$/, maxKb: 300, hard: true },
  { label: 'Phaser vendor', pattern: /^vendor-phaser-.*\.js$/, maxKb: 1400, hard: false },
];

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
