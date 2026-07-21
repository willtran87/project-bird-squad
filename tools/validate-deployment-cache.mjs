#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const buildDir = path.join(root, '.artifacts', 'build');
const assetsDir = path.join(buildDir, 'assets');
const indexPath = path.join(buildDir, 'index.html');
const headersPath = path.join(buildDir, '_headers');

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (!fs.existsSync(indexPath)) {
  fail('Missing .artifacts/build/index.html. Run `npm run build` before validating deployment cache.');
}

if (!fs.existsSync(assetsDir)) {
  fail('Missing .artifacts/build/assets. Run `npm run build` before validating deployment cache.');
}

if (!fs.existsSync(headersPath)) {
  fail('Missing .artifacts/build/_headers security and cache manifest.');
}

if (failures.length === 0) {
  const html = fs.readFileSync(indexPath, 'utf8');
  const headers = fs.readFileSync(headersPath, 'utf8');
  const assetHrefs = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((match) => match[1]);
  const preloadHrefs = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map((match) => match[1]);

  const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => !/\bsrc\s*=/.test(match[1]) && match[2].trim().length > 0);
  if (inlineScripts.length > 0) {
    fail(`index.html contains ${inlineScripts.length} inline script(s); strict script-src CSP cannot protect this build.`);
  }

  const csp = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/mi)?.[1]?.trim();
  if (!csp) {
    fail('_headers does not define Content-Security-Policy.');
  } else {
    const directives = new Map(csp.split(';').map((directive) => {
      const [name, ...values] = directive.trim().split(/\s+/);
      return [name, values];
    }).filter(([name]) => Boolean(name)));
    const requiredCsp = new Map([
      ['default-src', ["'self'"]],
      ['script-src', ["'self'"]],
      ['connect-src', ["'self'"]],
      ['object-src', ["'none'"]],
      ['base-uri', ["'none'"]],
      ['form-action', ["'none'"]],
      ['frame-ancestors', ["'none'"]],
    ]);
    for (const [name, values] of requiredCsp) {
      const actual = directives.get(name) ?? [];
      if (!values.every((value) => actual.includes(value))) {
        fail(`Content-Security-Policy ${name} must include ${values.join(' ')}.`);
      }
    }
    const scriptSources = directives.get('script-src') ?? [];
    if (scriptSources.includes("'unsafe-inline'") || scriptSources.includes("'unsafe-eval'")) {
      fail('Content-Security-Policy script-src must not allow unsafe-inline or unsafe-eval.');
    }
  }

  const requiredHeaders = [
    ['Referrer-Policy', 'no-referrer'],
    ['X-Content-Type-Options', 'nosniff'],
    ['X-Frame-Options', 'DENY'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['Cross-Origin-Resource-Policy', 'same-origin'],
  ];
  for (const [name, value] of requiredHeaders) {
    if (!new RegExp(`^\\s*${escapeRegex(name)}:\\s*${escapeRegex(value)}\\s*$`, 'mi').test(headers)) {
      fail(`_headers must define ${name}: ${value}.`);
    }
  }
  const permissions = headers.match(/^\s*Permissions-Policy:\s*(.+)$/mi)?.[1] ?? '';
  for (const feature of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()', 'fullscreen=(self)']) {
    if (!permissions.includes(feature)) fail(`Permissions-Policy must include ${feature}.`);
  }
  if (!/\/index\.html\s+[\s\S]*?Cache-Control:\s*no-cache/i.test(headers)) {
    fail('_headers must keep /index.html uncached.');
  }
  if (!/\/assets\/\*\s+[\s\S]*?Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/i.test(headers)) {
    fail('_headers must cache /assets/* as immutable for one year.');
  }

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

  const bootPreloadPattern = /\/assets\/(?:vendor-phaser|runtime-data|game-core)-[A-Za-z0-9_-]+\.js$/;
  const unexpectedPreloads = preloadHrefs.filter((href) => !bootPreloadPattern.test(href));
  if (unexpectedPreloads.length > 0) {
    fail(`index.html modulepreloads non-boot chunks: ${unexpectedPreloads.join(', ')}`);
  }

  if (preloadHrefs.some((href) => /codex-data-/.test(href))) {
    fail('Codex data chunk is preloaded by index.html; it should stay lazy until CodexScene opens.');
  }

  if (preloadHrefs.some((href) => /combat-preview-/.test(href))) {
    fail('Combat preview chunk is preloaded by index.html; it should stay lazy until BattleScene opens.');
  }

  if (preloadHrefs.some((href) => /fx-presenter-/.test(href))) {
    fail('Battle FX presenter chunk is preloaded by index.html; it should stay lazy until BattleScene opens.');
  }

  if (preloadHrefs.some((href) => /debug-state-/.test(href))) {
    fail('Battle debug-state chunk is preloaded by index.html; it should stay lazy until BattleScene opens.');
  }

  if (preloadHrefs.some((href) => /render-backdrop-/.test(href))) {
    fail('Battle backdrop renderer chunk is preloaded by index.html; it should stay lazy until BattleScene opens.');
  }

  if (preloadHrefs.some((href) => /render-foreground-/.test(href))) {
    fail('Battle foreground renderer chunk is preloaded by index.html; it should stay lazy until BattleScene opens.');
  }

  if (preloadHrefs.some((href) => /render-hud-/.test(href))) {
    fail('Battle HUD renderer chunk is preloaded by index.html; it should stay lazy until BattleScene opens.');
  }

  if (preloadHrefs.some((href) => /render-hand-/.test(href))) {
    fail('Battle hand renderer chunk is preloaded by index.html; it should stay lazy until BattleScene opens.');
  }

  if (preloadHrefs.some((href) => /render-inspect-/.test(href))) {
    fail('Battle inspect renderer chunk is preloaded by index.html; it should stay lazy until a combat card index opens.');
  }

  if (preloadHrefs.some((href) => /render-reward-/.test(href))) {
    fail('Battle reward renderer chunk is preloaded by index.html; it should stay lazy until a reward ceremony opens.');
  }

  if (preloadHrefs.some((href) => /run-challenge-/.test(href))) {
    fail('Run challenge chunk is preloaded by index.html; it should stay lazy until a flight code is copied.');
  }

  if (preloadHrefs.some((href) => /profile-scene-/.test(href))) {
    fail('Profile scene chunk is preloaded by index.html; it should stay lazy until Flock Record opens.');
  }

  if (preloadHrefs.some((href) => /system-overlays-/.test(href))) {
    fail('System overlays chunk is preloaded by index.html; it should stay lazy until a pause, settings, or guide panel opens.');
  }

  if (preloadHrefs.some((href) => /adaptive-music-/.test(href))) {
    fail('Adaptive music chunk is preloaded by index.html; it should stay lazy until the first audio interaction.');
  }

  const files = fs.readdirSync(assetsDir);
  const unhashedTextAssets = files.filter((name) => {
    if (!/\.(?:js|css)$/.test(name)) return false;
    return !/^.+-[A-Za-z0-9_-]{6,}\.(?:js|css)$/.test(name);
  });
  if (unhashedTextAssets.length > 0) {
    fail(`Build emitted non-hashed JS/CSS assets: ${unhashedTextAssets.join(', ')}`);
  }

  const fxDir = path.join(root, 'assets/runtime/fx');
  const fxNames = fs.existsSync(fxDir)
    ? fs.readdirSync(fxDir).filter((name) => name.endsWith('.png')).map((name) => name.replace(/\.png$/i, ''))
    : [];
  for (const fxName of fxNames) {
    const escapedName = escapeRegex(fxName);
    const optimizedMatches = files.filter((name) => new RegExp(`^${escapedName}-[A-Za-z0-9_-]{8}\\.webp$`).test(name));
    const legacyMatches = files.filter((name) => new RegExp(`^${escapedName}-[A-Za-z0-9_-]{8}\\.png$`).test(name));
    if (optimizedMatches.length !== 1) {
      fail(`Expected one hashed WebP for runtime FX asset ${fxName}, found ${optimizedMatches.length}.`);
    }
    if (legacyMatches.length > 0) {
      fail(`Build emitted legacy PNG runtime FX asset ${fxName}: ${legacyMatches.join(', ')}`);
    }
  }

  const uiIconDir = path.join(root, 'assets/runtime/ui/icons');
  const uiIconNames = fs.existsSync(uiIconDir)
    ? fs.readdirSync(uiIconDir).filter((name) => name.endsWith('.png')).map((name) => name.replace(/\.png$/i, ''))
    : [];
  for (const iconName of uiIconNames) {
    const escapedName = escapeRegex(iconName);
    const optimizedMatches = files.filter((name) => new RegExp(`^${escapedName}-[A-Za-z0-9_-]{8}\\.webp$`).test(name));
    const legacyMatches = files.filter((name) => new RegExp(`^${escapedName}-[A-Za-z0-9_-]{8}\\.png$`).test(name));
    if (optimizedMatches.length !== 1) {
      fail(`Expected one hashed WebP for runtime UI asset ${iconName}, found ${optimizedMatches.length}.`);
    }
    if (legacyMatches.length > 0) {
      fail(`Build emitted legacy PNG runtime UI asset ${iconName}: ${legacyMatches.join(', ')}`);
    }
  }

  const titlePreloadIconNames = [
    'ascension-medallion',
    'audio-toggle-medallion',
    'audio-toggle-pulse-ring',
    'audio-toggle-wave-burst',
    'codex-medallion',
    'help-medallion',
    'leader-lock-medallion',
    'leader-ready-medallion',
    'leader-select-medallion',
    'record-medallion',
    'settings-medallion',
    'start-run-medallion',
  ];
  const titlePreloadIconDir = path.join(uiIconDir, 'title-preload');
  const titlePreloadSources = fs.existsSync(titlePreloadIconDir)
    ? fs.readdirSync(titlePreloadIconDir).filter((name) => name.endsWith('.webp')).sort()
    : [];
  const expectedTitlePreloadSources = titlePreloadIconNames.map((name) => `${name}-title-preload.webp`).sort();
  const missingTitlePreloads = expectedTitlePreloadSources.filter((name) => !titlePreloadSources.includes(name));
  const unexpectedTitlePreloads = titlePreloadSources.filter((name) => !expectedTitlePreloadSources.includes(name));
  missingTitlePreloads.forEach((name) => fail(`Missing compact title preload asset ${name}.`));
  unexpectedTitlePreloads.forEach((name) => fail(`Unexpected compact title preload asset ${name}.`));
  for (const iconName of titlePreloadIconNames) {
    const emittedName = `${iconName}-title-preload`;
    const optimizedMatches = files.filter((name) => new RegExp(`^${escapeRegex(emittedName)}-[A-Za-z0-9_-]{8}\\.webp$`).test(name));
    if (optimizedMatches.length !== 1) {
      fail(`Expected one hashed compact title preload asset ${emittedName}, found ${optimizedMatches.length}.`);
    }
  }

  const codexChunks = files.filter((name) => /^codex-data-.*\.js$/.test(name));
  if (codexChunks.length !== 1) {
    fail(`Expected exactly one lazy codex-data chunk, found ${codexChunks.length}.`);
  }

  const combatPreviewChunks = files.filter((name) => /^combat-preview-.*\.js$/.test(name));
  if (combatPreviewChunks.length !== 1) {
    fail(`Expected exactly one lazy combat-preview chunk, found ${combatPreviewChunks.length}.`);
  }

  const battleFxPresenterChunks = files.filter((name) => /^fx-presenter-.*\.js$/.test(name));
  if (battleFxPresenterChunks.length !== 1) {
    fail(`Expected exactly one lazy battle FX presenter chunk, found ${battleFxPresenterChunks.length}.`);
  }

  const battleDebugStateChunks = files.filter((name) => /^debug-state-.*\.js$/.test(name));
  if (battleDebugStateChunks.length !== 1) {
    fail(`Expected exactly one lazy battle debug-state chunk, found ${battleDebugStateChunks.length}.`);
  }

  const battleBackdropRendererChunks = files.filter((name) => /^render-backdrop-.*\.js$/.test(name));
  if (battleBackdropRendererChunks.length !== 1) {
    fail(`Expected exactly one lazy battle backdrop renderer chunk, found ${battleBackdropRendererChunks.length}.`);
  }

  const battleForegroundRendererChunks = files.filter((name) => /^render-foreground-.*\.js$/.test(name));
  if (battleForegroundRendererChunks.length !== 1) {
    fail(`Expected exactly one lazy battle foreground renderer chunk, found ${battleForegroundRendererChunks.length}.`);
  }

  const battleHudRendererChunks = files.filter((name) => /^render-hud-.*\.js$/.test(name));
  if (battleHudRendererChunks.length !== 1) {
    fail(`Expected exactly one lazy battle HUD renderer chunk, found ${battleHudRendererChunks.length}.`);
  }

  const battleHandRendererChunks = files.filter((name) => /^render-hand-.*\.js$/.test(name));
  if (battleHandRendererChunks.length !== 1) {
    fail(`Expected exactly one lazy battle hand renderer chunk, found ${battleHandRendererChunks.length}.`);
  }

  const battleInspectRendererChunks = files.filter((name) => /^render-inspect-.*\.js$/.test(name));
  if (battleInspectRendererChunks.length !== 1) {
    fail(`Expected exactly one lazy battle inspect renderer chunk, found ${battleInspectRendererChunks.length}.`);
  }

  const battleRewardRendererChunks = files.filter((name) => /^render-reward-.*\.js$/.test(name));
  if (battleRewardRendererChunks.length !== 1) {
    fail(`Expected exactly one lazy battle reward renderer chunk, found ${battleRewardRendererChunks.length}.`);
  }

  const runChallengeChunks = files.filter((name) => /^run-challenge-.*\.js$/.test(name));
  if (runChallengeChunks.length !== 1) {
    fail(`Expected exactly one lazy run-challenge chunk, found ${runChallengeChunks.length}.`);
  }

  const profileSceneChunks = files.filter((name) => /^profile-scene-.*\.js$/.test(name));
  if (profileSceneChunks.length !== 1) {
    fail(`Expected exactly one lazy profile-scene chunk, found ${profileSceneChunks.length}.`);
  }

  const systemOverlayChunks = files.filter((name) => /^system-overlays-.*\.js$/.test(name));
  if (systemOverlayChunks.length !== 1) {
    fail(`Expected exactly one lazy system-overlays chunk, found ${systemOverlayChunks.length}.`);
  }

  const adaptiveMusicChunks = files.filter((name) => /^adaptive-music-.*\.js$/.test(name));
  if (adaptiveMusicChunks.length !== 1) {
    fail(`Expected exactly one lazy adaptive-music chunk, found ${adaptiveMusicChunks.length}.`);
  }

  const vendorChunks = files.filter((name) => /^vendor-phaser-.*\.js$/.test(name));
  if (vendorChunks.length !== 1) {
    fail(`Expected exactly one vendor-phaser chunk, found ${vendorChunks.length}.`);
  }

  const runtimeChunks = files.filter((name) => /^runtime-data-.*\.js$/.test(name));
  if (runtimeChunks.length !== 1) {
    fail(`Expected exactly one runtime-data boot chunk, found ${runtimeChunks.length}.`);
  }

  const gameCoreChunks = files.filter((name) => /^game-core-.*\.js$/.test(name));
  if (gameCoreChunks.length !== 1) {
    fail(`Expected exactly one game-core boot chunk, found ${gameCoreChunks.length}.`);
  }

  const appChunks = files.filter((name) => /^index-.*\.js$/.test(name));
  if (appChunks.length !== 1) {
    fail(`Expected exactly one app entry chunk, found ${appChunks.length}.`);
  }

  const unreferencedBootChunks = [...vendorChunks, ...runtimeChunks, ...gameCoreChunks, ...appChunks].filter((name) => !html.includes(`/assets/${name}`));
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
console.log('Deployment headers validated: strict script CSP, browser hardening, /index.html no-cache, and immutable /assets/*.');
