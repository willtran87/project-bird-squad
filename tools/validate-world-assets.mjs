#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const canonicalGroups = [
  {
    dir: 'assets/splash',
    files: [
      'bird-squad-bold-streetwear-splash-v3-gate.webp',
      'bird-squad-bold-streetwear-splash-v3.png',
      'bird-squad-canal-run-splash-v11-menu-pop.webp',
      'bird-squad-canal-run-splash-v11.png',
    ],
  },
  {
    dir: 'assets/runtime/backdrops',
    files: [
      'canal-markets-route-map-v1.webp',
      'canal-markets.webp',
      'high-roost-route-map-v1.webp',
      'high-roost.webp',
      'rooftop-blocks-route-map-v1.webp',
      'rooftop-blocks-readability-v2.webp',
      'signal-spires-route-map-v1.webp',
      'signal-spires.webp',
    ],
  },
  {
    dir: 'assets/runtime/backdrops/variants',
    files: [
      'canal-markets-boss-gatekeeper-v1.webp',
      'high-roost-boss-warden-v1.webp',
      'rooftop-blocks-boss-tar-crow-v1.webp',
      'signal-spires-boss-beacon-breaker-v1.webp',
    ],
  },
  {
    dir: 'assets/runtime/route-events',
    files: [
      'caldra-pinion-v2.webp',
      'featherwright-studio-v2.webp',
      'ivo-tallymast-v2.webp',
      'lantern-roost-shelter-v3.webp',
      'marn-valeclip-v2.webp',
      'oren-shearbright-v2.webp',
      'rival-wager-board-v2.webp',
      'rooftop-cache-office-v2.webp',
      'sella-warmwick-v2.webp',
      'signal-switchboard-v2.webp',
    ],
  },
  {
    dir: 'assets/runtime/route-events/props',
    files: [
      'basin-hearth-cart-v1.webp',
      'marn-lockbox-cabinet-v1.webp',
      'nest-featherwright-bench-v1.webp',
      'signal-route-switchboard-v1.webp',
    ],
  },
  {
    dir: 'assets/runtime/market-kit',
    files: [
      'bird-market-background-v1.webp',
      'bird-market-sign-v1.webp',
      'market-counter-wares-v1.webp',
      'starling-shopkeeper-v1.webp',
    ],
  },
  {
    dir: 'assets/runtime/map-icons/icons',
    files: [
      'basin.webp',
      'boss.webp',
      'cache.webp',
      'market.webp',
      'nest.webp',
      'rival.webp',
      'signal.webp',
      'street.webp',
    ],
  },
];

const canonicalSourceGroups = [
  {
    dir: 'assets/concept-art/backdrops/sources',
    files: [
      'rooftop-blocks-readability-source-v2.png',
      'canal-markets-route-map-source-v1.png',
      'high-roost-route-map-source-v1.png',
      'signal-spires-route-map-source-v1.png',
    ],
  },
  {
    dir: 'assets/concept-art/market-kit',
    files: [
      'bird-market-background-v1.png',
      'market-kit-composite-preview-v1.png',
    ],
  },
  {
    dir: 'assets/concept-art/market-kit/layers',
    files: [
      'bird-market-sign-v1.png',
      'market-counter-wares-v1.png',
      'starling-shopkeeper-v1.png',
    ],
  },
  {
    dir: 'assets/concept-art/market-kit/sources',
    files: [
      'bird-market-sign-chroma-v1.png',
      'market-counter-wares-chroma-v1.png',
      'starling-shopkeeper-chroma-v1.png',
    ],
  },
  {
    dir: 'assets/concept-art/route-events/featherwright-studio',
    files: [
      'featherwright-chair-press-v1-alpha-source.png',
      'featherwright-chair-press-v1-chroma-source.png',
      'featherwright-studio-v2-scene-source.png',
      'oren-shearbright-v2-alpha-source.png',
      'oren-shearbright-v2-chroma-source.png',
    ],
  },
  {
    dir: 'assets/concept-art/route-events/lantern-roost',
    files: [
      'lantern-roost-hearth-alpha-source.png',
      'lantern-roost-shelter-v3-scene-source.png',
      'sella-warmwick-v2-alpha-source.png',
      'sella-warmwick-v2-chroma-source.png',
    ],
  },
  {
    dir: 'assets/concept-art/route-events/marn-cache',
    files: ['marn-lockbox-cabinet-v1-raw.png'],
  },
  {
    dir: 'assets/concept-art/route-events/rival-wager',
    files: [
      'caldra-pinion-v2-alpha-source.png',
      'caldra-pinion-v2-chroma-source.png',
      'rival-wager-board-v2-scene-source.png',
    ],
  },
  {
    dir: 'assets/concept-art/route-events/rooftop-cache',
    files: [
      'marn-valeclip-v2-alpha-source.png',
      'marn-valeclip-v2-chroma-source.png',
      'rooftop-cache-office-v2-scene-source.png',
    ],
  },
  {
    dir: 'assets/concept-art/route-events/signal-landmark',
    files: [
      'ivo-tallymast-v2-alpha-source.png',
      'ivo-tallymast-v2-chroma-source.png',
      'signal-route-switchboard-v1-alpha-source.png',
      'signal-route-switchboard-v1-chroma-source.png',
      'signal-switchboard-v2-scene-source.png',
    ],
  },
  {
    dir: 'assets/concept-art/route-event-centerpieces/sources',
    files: [
      'basin-hearth-cart-v1-source.png',
      'nest-featherwright-bench-v1-source.png',
      'signal-route-switchboard-v1-source.png',
    ],
  },
  {
    dir: 'assets/concept-art/ui/route-map/route-node-icons-splash-v7',
    files: [
      'basin-splash-v7.png',
      'boss-splash-v7.png',
      'cache-splash-v7.png',
      'market-splash-v7.png',
      'nest-splash-v7.png',
      'rival-splash-v7.png',
      'signal-splash-v7.png',
      'street-splash-v7.png',
    ],
  },
];

// These are deliberately the highest owned roots, not just the leaf folders
// above. Scanning the complete trees prevents a retired generation from being
// parked in a new nested folder where a direct-file allowlist would miss it.
const canonicalTreeRoots = [
  'assets/splash',
  'assets/runtime/backdrops',
  'assets/runtime/route-events',
  'assets/runtime/market-kit',
  'assets/runtime/map-icons',
  'assets/concept-art/backdrops',
  'assets/concept-art/market-kit',
  'assets/concept-art/route-events',
  'assets/concept-art/route-event-centerpieces',
  'assets/concept-art/ui/route-map',
];

function directFiles(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  return fs.readdirSync(absoluteDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function allFiles(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(relativeDir, entry.name);
    return entry.isDirectory() ? allFiles(relative) : [relative.replaceAll(path.sep, '/')];
  });
}

const failures = [];

for (const group of canonicalGroups) {
  const actual = directFiles(group.dir);
  const expected = [...group.files].sort();
  const missing = expected.filter((file) => !actual.includes(file));
  const unexpected = actual.filter((file) => !expected.includes(file));
  missing.forEach((file) => failures.push(`missing canonical world asset: ${group.dir}/${file}`));
  unexpected.forEach((file) => failures.push(`unregistered world asset: ${group.dir}/${file}`));
}

for (const group of canonicalSourceGroups) {
  const actual = directFiles(group.dir);
  const expected = [...group.files].sort();
  const missing = expected.filter((file) => !actual.includes(file));
  const unexpected = actual.filter((file) => !expected.includes(file));
  missing.forEach((file) => failures.push(`missing canonical world source: ${group.dir}/${file}`));
  unexpected.forEach((file) => failures.push(`unregistered world source: ${group.dir}/${file}`));
}

if (fs.existsSync(path.join(root, 'assets/battlefields'))) {
  failures.push('legacy battlefield directory is forbidden: assets/battlefields');
}

const routeMapSourceDir = 'assets/concept-art/ui/route-map';
const routeMapSourceFiles = directFiles(routeMapSourceDir);
const expectedRouteMapSourceFiles = ['route-node-icon-atlas-splash-v7.png'];
routeMapSourceFiles
  .filter((file) => !expectedRouteMapSourceFiles.includes(file))
  .forEach((file) => failures.push(`superseded route-map source: ${routeMapSourceDir}/${file}`));

const routeMapSourceDirectories = fs.existsSync(path.join(root, routeMapSourceDir))
  ? fs.readdirSync(path.join(root, routeMapSourceDir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  : [];
routeMapSourceDirectories
  .filter((dir) => dir !== 'route-node-icons-splash-v7')
  .forEach((dir) => failures.push(`superseded route-map source directory: ${routeMapSourceDir}/${dir}`));

const canonicalTreeFiles = new Set([
  ...canonicalGroups.flatMap((group) => group.files.map((file) => `${group.dir}/${file}`)),
  ...canonicalSourceGroups.flatMap((group) => group.files.map((file) => `${group.dir}/${file}`)),
  ...expectedRouteMapSourceFiles.map((file) => `${routeMapSourceDir}/${file}`),
]);
for (const treeRoot of canonicalTreeRoots) {
  allFiles(treeRoot)
    .filter((file) => !canonicalTreeFiles.has(file))
    .forEach((file) => failures.push(`unregistered world-tree asset: ${file}`));
}

const forbiddenSourceTokens = [
  'ROUTE_MAP_BACKING_ASSET',
  'bird-squad-splash-v1',
  'bird-squad-canal-run-splash-v4',
  'bird-squad-canal-run-splash-v5',
  'bird-squad-canal-run-splash-v6',
  'bird-squad-canal-run-splash-v7',
  'bird-squad-canal-run-splash-v8',
  'bird-squad-canal-run-splash-v9',
  'bird-squad-canal-run-splash-v10',
  'route-board-laminated-plan',
  'map-node-icon-atlas-v1',
  'map-node-icon-atlas-contrast-v2',
  'route-node-icon-atlas-contrast-v2',
  'route-node-icon-atlas-splash-v3',
  'route-node-icon-atlas-splash-v4',
  'route-node-icon-atlas-splash-v5',
  'route-node-icon-atlas-splash-v6',
  'canal-markets-supply-market-v1',
  'high-roost-workshop-prep-v1',
  'rooftop-blocks-cache-billboard-v1',
  'signal-spires-signal-relay-v1',
  'featherwright-studio-v1',
  'lantern-roost-shelter-v1',
  'lantern-roost-shelter-v2',
  'rival-wager-board-v1',
  'rooftop-cache-office-v1',
  'signal-switchboard-v1',
  // Retired v1 event exports used string URLs in the old route renderer. Keep
  // their exact runtime filenames forbidden so a future fallback cannot compile
  // successfully and then fail as a silent 404 after the files are gone.
  'caldra-pinion-v1.webp',
  'featherwright-chair-press-v1.webp',
  'ivo-tallymast-v1.webp',
  'lantern-roost-awning-v1.webp',
  'lantern-roost-hearth-v1.webp',
  'lantern-roost-rain-pipe-v1.webp',
  'lantern-roost-sign-v1.webp',
  'lantern-roost-wrapped-snack-v1.webp',
  'marn-valeclip-v1.webp',
  'oren-shearbright-v1.webp',
  'rival-contract-prize-board-v1.webp',
  'rooftop-cache-cabinet-v1.webp',
  'sella-warmwick-v1.webp',
];
const sourceFiles = [
  ...allFiles('src'),
  ...allFiles('tools').filter((file) => file !== 'tools/validate-world-assets.mjs'),
  'index.html',
  'package.json',
  'vite.config.ts',
].filter((file) => /\.(?:ts|tsx|js|mjs|py|html|json)$/i.test(file) && fs.existsSync(path.join(root, file)));
for (const file of sourceFiles) {
  const contents = fs.readFileSync(path.join(root, file), 'utf8');
  forbiddenSourceTokens
    .filter((token) => contents.includes(token))
    .forEach((token) => failures.push(`legacy world reference "${token}" remains in ${file}`));
}

// Current guidance must not point contributors back toward retired art. The
// canonical contract and progress log may name legacy families specifically so
// they can document the denylist and historical cleanup.
const guidanceFiles = [
  'README.md',
  ...allFiles('docs').filter((file) => (
    file !== 'docs/art/world-asset-contract.md'
    && file !== 'docs/project/progress.md'
  )),
].filter((file) => /\.md$/i.test(file) && fs.existsSync(path.join(root, file)));
for (const file of guidanceFiles) {
  const contents = fs.readFileSync(path.join(root, file), 'utf8');
  forbiddenSourceTokens
    .filter((token) => contents.includes(token))
    .forEach((token) => failures.push(`legacy world guidance "${token}" remains in ${file}`));
}

if (failures.length > 0) {
  console.error(`World asset validation failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

const runtimeChecked = canonicalGroups.reduce((total, group) => total + group.files.length, 0);
const sourceChecked = canonicalSourceGroups.reduce((total, group) => total + group.files.length, 0)
  + expectedRouteMapSourceFiles.length;
console.log(`World asset validation passed. Checked ${runtimeChecked} canonical runtime/style assets and ${sourceChecked} canonical sources; rejected legacy paths.`);
