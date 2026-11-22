#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const assetsDir = path.join(path.resolve(root, process.argv[2] ?? '.artifacts/build'), 'assets');
const kb = 1024;

const budgets = [
  { label: 'district arrival framing lazy module', pattern: /^district-framing-.*\.js$/, maxKb: 2, hard: true },
  { label: 'hand rule formatting shared lazy module', pattern: /^hand-rule-summary-.*\.js$/, maxKb: 5.5, hard: true }, // +compact face dialect: every effect stays on hand and reward faces
  { label: 'strategy showcase lazy module', pattern: /^strategy-showcase-.*\.js$/, maxKb: 4, hard: true },
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
  // Retained actor stage: animation clock, hit-stop, body motion and hand fan. Replaces the breathing tween module.
  { label: 'battle actors lazy module', pattern: /^battle-actors-.*\.js$/, maxKb: 10, hard: true },
  // Combat life: status/intent icon badges, ghost health, counter rolls, combo chain, body status effects,
  // set pieces (Surge, Molt, boss entrance/phase, finishing blow, victory, defeat), Leader flourishes, Waymark lines (25.6 KB).
  { label: 'combat life lazy module', pattern: /^battle-life-.*\.js$/, maxKb: 26.5, hard: true },
  { label: 'cards-as-objects lazy module', pattern: /^battle-card-objects-.*\.js$/, maxKb: 21.5, hard: true }, // flight, deal, discard, drag, rarity frames, number highlights, inspect face (20.2 KB)
  { label: 'shared run HUD lazy module', pattern: /^run-hud-.*\.js$/, maxKb: 10.25, hard: true }, // +7 bytes of import renames from the scene-life chunk
  { label: 'route transition FX lazy module', pattern: /^route-transition-fx-.*\.js$/, maxKb: 7, hard: true },
  { label: 'battle state snapshot lazy module', pattern: /^battle-state-snapshot-.*\.js$/, maxKb: 12, hard: true },
  { label: 'battle outcome scene lazy module', pattern: /^battle-outcome-scene-.*\.js$/, maxKb: 8, hard: true },
  { label: 'Flyway expansion lazy module', pattern: /^flyway-expansion-.*\.js$/, maxKb: 32, hard: true },
  { label: 'app entry', pattern: /^index-.*\.js$/, maxKb: 420, targetKb: 416, hard: true }, // BattleScene now lazy (was 675 KB)
  // BattleScene and the combat-only modules it alone imports; fetched beside the title fonts.
  { label: 'battle scene lazy module', pattern: /^battle-scene-.*\.js$/, maxKb: 272, hard: true },
  // Versioned route rhythm adds ~1 KiB; the total boot ceiling below is tighter.
  // 31.5: unlock bookkeeping now queues Collection ceremony reveals (tiny, boot-resident append).
  { label: 'game core', pattern: /^game-core-.*\.js$/, maxKb: 31.5, hard: true },
  { label: 'optional market and card picker', pattern: /^route-secondary-presentation-.*\.js$/, maxKb: 23, hard: true },
  { label: 'interaction rules', pattern: /^interaction-rules-.*\.js$/, maxKb: 12, hard: true },
  { label: 'adaptive music lazy module', pattern: /^adaptive-music-.*\.js$/, maxKb: 8, hard: true },
  { label: 'synthesized SFX lazy module', pattern: /^audio-sfx-.*\.js$/, maxKb: 8, hard: true },
  // Typed audio events: pure rules, material/bird/impact/stinger voices, district beds and mood drones. All lazy.
  { label: 'audio event rules lazy module', pattern: /^audio-events-.*\.js$/, maxKb: 5, hard: true },
  { label: 'audio event voices lazy module', pattern: /^audio-voices-.*\.js$/, maxKb: 8, hard: true },
  { label: 'district ambience beds lazy module', pattern: /^audio-ambience-.*\.js$/, maxKb: 6, hard: true },
  { label: 'battle FX presenter lazy module', pattern: /^fx-presenter-.*\.js$/, maxKb: 8, hard: true },
  { label: 'encounter intro lazy module', pattern: /^encounter-intro-.*\.js$/, maxKb: 4, hard: true },
  { label: 'battle debug-state lazy module', pattern: /^debug-state-.*\.js$/, maxKb: 10.25, hard: true }, // import renames once BattleScene left the entry chunk (10.02 KB)
  { label: 'battle backdrop renderer lazy module', pattern: /^render-backdrop-.*\.js$/, maxKb: 4, hard: true },
  // +retained combatant bodies, slot-owned hit areas and the breathing envelope (was a tween module).
  { label: 'battle foreground renderer lazy module', pattern: /^render-foreground-.*\.js$/, maxKb: 10.5, hard: true }, // +seats combat life (10.1 KB)
  // Separate cost/outcome/protection fields and critical warnings; remains lazy.
  { label: 'battle HUD renderer lazy module', pattern: /^render-hud-.*\.js$/, maxKb: 13.5, hard: true }, // +CONFIRM TO PLAY is a real control; +confirm placement clear of enemy panels (13.3 KB, a320a5f9)
  // Full-portrait card faces, state halos and hover lift live here.
  { label: 'battle hand renderer lazy module', pattern: /^render-hand-.*\.js$/, maxKb: 15.25, hard: true }, // +hand reconciliation; +departures, rarity frame, number highlights and the inspect face hook (14.8 KB)
  // Living-stage lighting, weather, bloom and motion; never part of boot.
  // Title/route/chrome life: route legend and flock, arrival card, wing wipes,
  // overlay and list entrances, living backdrops, button depth. Loaded after
  // the stage; never part of boot.
  { label: 'scene life lazy module', pattern: /^scene-life-.*.js$/, maxKb: 30, hard: true },
  // Presentation polish (all lazy): card reward reveal (7.2 KB), delayed loading card (2.9 KB),
  // combat barks with their line content (15.8 KB), suit sigils, tarot marks and route signs (6.7 KB),
  // and the shared overlay panel (2.3 KB).
  { label: 'card reward reveal lazy module', pattern: /^reward-reveal-.*\.js$/, maxKb: 8, hard: true },
  { label: 'scene loading card lazy module', pattern: /^scene-loading-.*\.js$/, maxKb: 3.5, hard: true },
  { label: 'combat barks lazy module', pattern: /^barks-.*\.js$/, maxKb: 17, hard: true },
  { label: 'world glyphs and tarot marks lazy module', pattern: /^world-glyphs-.*\.js$/, maxKb: 7.5, hard: true },
  { label: 'shared overlay panel lazy module', pattern: /^ui-panel-.*\.js$/, maxKb: 3, hard: true },
  // Daily Flight, run recap/photo card and Collection ceremony scenes; the title
  // requests this after its first frame. Narrative copy rides with the arrival card.
  { label: 'engagement scenes lazy module', pattern: /^engagement-.*\.js$/, maxKb: 30, hard: true },
  { label: 'leader portrait manifest', pattern: /^leader-portraits-.*\.js$/, maxKb: 2, hard: true },
  { label: 'narrative threads lazy module', pattern: /^narrative-threads-.*\.js$/, maxKb: 14, hard: true },
  { label: 'spectacle stage lazy module', pattern: /^spectacle-.*\.js$/, maxKb: 24, hard: true },
  { label: 'combat card reading panel', pattern: /^combat-card-detail-.*\.js$/, maxKb: 4, hard: true },
  { label: 'shared reward card face', pattern: /^reward-card-face-.*\.js$/, maxKb: 5, hard: true }, // +full rules and larger portrait on reward faces
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
  { label: 'Route reward overlay lazy module', pattern: /^route-reward-overlay-.*\.js$/, maxKb: 6.25, hard: true }, // same import-rename drift
  { label: 'Waymark review lazy module', pattern: /^waymark-review-.*\.js$/, maxKb: 8, hard: true },
  { label: 'Route text-state lazy module', pattern: /^route-debug-state-.*\.js$/, maxKb: 24.25, hard: true },
  { label: 'Route map renderer lazy module', pattern: /^route-map-renderer-.*\.js$/, maxKb: 5.5, hard: true }, // +calls into route life (legend, trails, flock)
  { label: 'Route map inspection lazy module', pattern: /^route-map-inspection-.*\.js$/, maxKb: 5, hard: true },
  { label: 'flock stats overlay lazy module', pattern: /^flock-stats-overlay-.*\.js$/, maxKb: 8, hard: true },
  { label: 'screen reader runtime lazy module', pattern: /^screen-reader-runtime-.*\.js$/, maxKb: 4, hard: true },
  { label: 'menu diagnostics lazy module', pattern: /^menu-debug-state-.*\.js$/, maxKb: 7, hard: true },
  { label: 'menu optional UI lazy module', pattern: /^menu-optional-ui-.*\.js$/, maxKb: 6.75, hard: true }, // import-rename drift from the engagement chunk's shared exports; 6.4 KB under the Pages base path
  { label: 'first-encounter term callouts lazy module', pattern: /^term-introductions-.*\.js$/, maxKb: 4, hard: true },
  { label: 'setup portraits lazy module', pattern: /^setup-portraits-.*\.js$/, maxKb: 1, hard: true },
  { label: 'title launch lazy module', pattern: /^title-run-launch-.*\.js$/, maxKb: 4, hard: true },
  { label: 'Profile scene lazy module', pattern: /^profile-scene-.*\.js$/, maxKb: 170, hard: true },
  { label: 'Codex lazy data', pattern: /^codex-data-.*\.js$/, maxKb: 300, hard: true },
  { label: 'Phaser vendor', pattern: /^vendor-phaser-.*\.js$/, maxKb: 1400, hard: false },
];
const combinedBootBudget = {
  label: 'combined app boot code',
  patterns: [/^index-.*\.js$/, /^game-core-.*\.js$/, /^interaction-rules-.*\.js$/],
  // BattleScene (~267 KB with its combat-only imports) is now a lazy chunk:
  // a tiny loader holds its Scene Manager slot and boot fetches it beside the
  // title fonts (src/scenes/battle-scene-loader.ts). Was 702.8 KB; now 449.0 KB.
  // +1.6 KB: Fast Mode / Rumble preferences (scene pace syncs at boot) and the
  // context-aware rotate/too-small gate copy. Measured 450.6 KB.
  // The Pages build (--base=/project-bird-squad/) lengthens every asset URL:
  // 451.7 KB locally measures 453.1 KB there.
  maxKb: 456,
  targetKb: 454,
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
// hand + ceremony allowance (12 + 14 KiB). Count the new dependency as well.
const rewardPresentation = chunks.filter(chunk => /^(render-hand|render-reward|reward-card-face|hand-rule-summary)-.*\.js$/.test(chunk.name));
const rewardPresentationKb = rewardPresentation.reduce((sum, chunk) => sum + chunk.kb, 0);
console.log(`Combined hand/reward presentation: ${rewardPresentationKb.toFixed(1)} KB minified`);
// 28 KiB since full rules moved onto hand and reward faces (no "+N more");
// 29.5 KiB with retained hand-card reconciliation; 31.25 KiB with cards as
// objects (the hand renderer's hooks into the battle-card-objects chunk).
if (rewardPresentation.length !== 4 || rewardPresentationKb > 31.25) failures.push('Combined hand/reward presentation exceeds its 31.25 KB allowance or is incomplete.');
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
