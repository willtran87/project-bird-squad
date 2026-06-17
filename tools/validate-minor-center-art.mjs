import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const targetRootArg = args.find((arg) => !arg.startsWith('--')) ?? '.generated/imagegen/tarot/minor-arcana-center-art-runs/latest';
const allowAnySize = args.includes('--allow-any-size');
const targetRoot = path.resolve(root, targetRootArg);
const errors = [];
const normalizedTargetRoot = targetRoot.replaceAll(path.sep, '/').toLowerCase();
const forbiddenSourceFragments = [
  '/minor-arcana-border-first-runs/',
  '/minor-arcana-composited/',
  '/runtime/cards/',
];

const suitFiles = [
  { key: 'plumes', suitName: 'Plumes', file: 'data/cards/arcana/minor-arcana-wands.json' },
  { key: 'basins', suitName: 'Basins', file: 'data/cards/arcana/minor-arcana-cups.json' },
  { key: 'quills', suitName: 'Quills', file: 'data/cards/arcana/minor-arcana-swords.json' },
  { key: 'nests', suitName: 'Nests', file: 'data/cards/arcana/minor-arcana-pentacles.json' },
];

function fail(message) {
  errors.push(message);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function pngSize(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`${file} is not a PNG file`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

if (!fs.existsSync(targetRoot)) {
  fail(`${path.relative(root, targetRoot)}: missing center-art root`);
} else {
  if (forbiddenSourceFragments.some((fragment) => normalizedTargetRoot.includes(fragment))) {
    fail(`${path.relative(root, targetRoot)}: center-art root must be isolated borderless art, not finished/composited card output`);
  }

  const expectedIds = new Set();
  let expectedTotal = 0;

  for (const suit of suitFiles) {
    const data = readJson(suit.file);
    const cards = data.cards;
    expectedTotal += cards.length;

    const suitDir = path.join(targetRoot, suit.key);
    if (!fs.existsSync(suitDir)) {
      fail(`${path.relative(root, suitDir)}: missing suit directory`);
      continue;
    }

    const pngs = fs.readdirSync(suitDir).filter((name) => name.toLowerCase().endsWith('.png'));
    if (pngs.length !== cards.length) {
      fail(`${path.relative(root, suitDir)}: expected ${cards.length} PNGs, found ${pngs.length}`);
    }

    const knownSuitIds = new Set(cards.map((card) => card.id));
    for (const card of cards) {
      expectedIds.add(card.id);
      const centerPath = path.join(suitDir, `${card.id}.png`);
      if (!fs.existsSync(centerPath)) {
        fail(`${path.relative(root, centerPath)}: missing center art`);
        continue;
      }

      const size = pngSize(centerPath);
      if (!allowAnySize && (size.width !== 1024 || size.height !== 1536)) {
        fail(`${path.relative(root, centerPath)}: expected 1024x1536, found ${size.width}x${size.height}`);
      }
    }

    for (const png of pngs) {
      const cardId = path.basename(png, '.png');
      if (!knownSuitIds.has(cardId)) {
        fail(`${path.relative(root, path.join(suitDir, png))}: filename does not match known ${suit.suitName} card id`);
      }
    }
  }

  const allPngs = [];
  for (const suit of suitFiles) {
    const suitDir = path.join(targetRoot, suit.key);
    if (!fs.existsSync(suitDir)) continue;
    for (const name of fs.readdirSync(suitDir)) {
      if (name.toLowerCase().endsWith('.png')) allPngs.push(path.join(suitDir, name));
    }
  }

  if (allPngs.length !== expectedTotal) {
    fail(`${path.relative(root, targetRoot)}: expected ${expectedTotal} total center-art PNGs, found ${allPngs.length}`);
  }

  for (const pngPath of allPngs) {
    const cardId = path.basename(pngPath, '.png');
    if (!expectedIds.has(cardId)) {
      fail(`${path.relative(root, pngPath)}: unknown card id`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Minor Arcana center-art validation failed with ${errors.length} issue(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Minor Arcana center-art validation passed.');
console.log(`Checked 56 center-art PNGs in ${path.relative(root, targetRoot)}.`);
