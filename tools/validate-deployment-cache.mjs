#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const buildDir = path.join(root, '.artifacts', 'build');
const assetsDir = path.join(buildDir, 'assets');
const indexPath = path.join(buildDir, 'index.html');

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

if (!fs.existsSync(indexPath)) {
  fail('Missing .artifacts/build/index.html. Run `npm run build` before validating deployment cache.');
}

if (!fs.existsSync(assetsDir)) {
  fail('Missing .artifacts/build/assets. Run `npm run build` before validating deployment cache.');
}

if (failures.length === 0) {
  const html = fs.readFileSync(indexPath, 'utf8');
  const assetHrefs = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((match) => match[1]);
  const preloadHrefs = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map((match) => match[1]);

  if (assetHrefs.length === 0) {
    fail('index.html does not reference any hashed assets.');
  }

  const unhashedRefs = assetHrefs.filter((href) => {
    const name = path.basename(href);
    return !/^.+-[A-Za-z0-9_-]{6,}\.(?:js|css|png|webp|json|svg)$/.test(name);
  });
  if (unhashedRefs.length > 0) {
    fail(`index.html references non-hashed asset names: ${unhashedRefs.join(', ')}`);
  }

  const bootPreloadPattern = /\/assets\/(?:vendor-phaser|runtime-data)-[A-Za-z0-9_-]+\.js$/;
  const unexpectedPreloads = preloadHrefs.filter((href) => !bootPreloadPattern.test(href));
  if (unexpectedPreloads.length > 0) {
    fail(`index.html modulepreloads non-boot chunks: ${unexpectedPreloads.join(', ')}`);
  }

  if (preloadHrefs.some((href) => /codex-data-/.test(href))) {
    fail('Codex data chunk is preloaded by index.html; it should stay lazy until CodexScene opens.');
  }

  const files = fs.readdirSync(assetsDir);
  const unhashedTextAssets = files.filter((name) => {
    if (!/\.(?:js|css)$/.test(name)) return false;
    return !/^.+-[A-Za-z0-9_-]{6,}\.(?:js|css)$/.test(name);
  });
  if (unhashedTextAssets.length > 0) {
    fail(`Build emitted non-hashed JS/CSS assets: ${unhashedTextAssets.join(', ')}`);
  }

  const codexChunks = files.filter((name) => /^codex-data-.*\.js$/.test(name));
  if (codexChunks.length !== 1) {
    fail(`Expected exactly one lazy codex-data chunk, found ${codexChunks.length}.`);
  }

  const vendorChunks = files.filter((name) => /^vendor-phaser-.*\.js$/.test(name));
  if (vendorChunks.length !== 1) {
    fail(`Expected exactly one vendor-phaser chunk, found ${vendorChunks.length}.`);
  }

  const runtimeChunks = files.filter((name) => /^runtime-data-.*\.js$/.test(name));
  if (runtimeChunks.length !== 1) {
    fail(`Expected exactly one runtime-data boot chunk, found ${runtimeChunks.length}.`);
  }

  const appChunks = files.filter((name) => /^index-.*\.js$/.test(name));
  if (appChunks.length !== 1) {
    fail(`Expected exactly one app entry chunk, found ${appChunks.length}.`);
  }

  const unreferencedBootChunks = [...vendorChunks, ...runtimeChunks, ...appChunks].filter((name) => !html.includes(`/assets/${name}`));
  if (unreferencedBootChunks.length > 0) {
    fail(`index.html does not reference required boot chunks: ${unreferencedBootChunks.join(', ')}`);
  }

  if (!html.includes('id="boot-shell"')) {
    warn('index.html no longer contains the boot shell; confirm the loading experience is intentional.');
  }
}

if (warnings.length > 0) {
  console.warn('Deployment cache validation warnings:');
  warnings.forEach((message) => console.warn(`- ${message}`));
}

if (failures.length > 0) {
  console.error('Deployment cache validation failed:');
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log('Deployment cache validation passed.');
console.log('Expected hosting headers: /index.html no-cache; /assets/* public, max-age=31536000, immutable.');
