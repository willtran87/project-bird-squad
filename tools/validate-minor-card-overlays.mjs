import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'assets/templates/minor-arcana/card-overlays/overlay-manifest.json';
const manifestFullPath = path.join(root, manifestPath);
const errors = [];

const suitFiles = [
  { suitName: 'Plumes', file: 'data/cards/arcana/minor-arcana-wands.json' },
  { suitName: 'Basins', file: 'data/cards/arcana/minor-arcana-cups.json' },
  { suitName: 'Quills', file: 'data/cards/arcana/minor-arcana-swords.json' },
  { suitName: 'Nests', file: 'data/cards/arcana/minor-arcana-pentacles.json' },
];

const rankNames = {
  Ace: 'Ace',
  '2': 'Two',
  '3': 'Three',
  '4': 'Four',
  '5': 'Five',
  '6': 'Six',
  '7': 'Seven',
  '8': 'Eight',
  '9': 'Nine',
  '10': 'Ten',
};

function fail(message) {
  errors.push(message);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function displayRank(card, data) {
  return rankNames[card.rank] ?? data.courtNaming?.[card.rank] ?? card.rank;
}

function displayTitle(card, data, suitName) {
  return `${displayRank(card, data)} of ${suitName}`;
}

function svgSize(svgText) {
  const svgTag = svgText.match(/<svg\b[^>]*>/)?.[0] ?? '';
  const width = Number(svgTag.match(/\bwidth="(\d+)"/)?.[1]);
  const height = Number(svgTag.match(/\bheight="(\d+)"/)?.[1]);
  return { width, height };
}

if (!fs.existsSync(manifestFullPath)) {
  fail(`${manifestPath}: missing; run npm run generate:minor-overlays`);
} else {
  const manifest = readJson(manifestPath);
  if (manifest.canvas?.width !== 1024 || manifest.canvas?.height !== 1536) {
    fail(`${manifestPath}: canvas must be 1024x1536`);
  }

  if (!manifest.geometry?.imageWindow || !manifest.geometry?.titleCartouche) {
    fail(`${manifestPath}: missing imageWindow or titleCartouche geometry`);
  }

  const expectedCards = [];
  for (const suit of suitFiles) {
    const data = readJson(suit.file);
    for (const card of data.cards) {
      expectedCards.push({
        cardId: card.id,
        suit: suit.suitName,
        title: displayTitle(card, data, suit.suitName),
        sourceData: suit.file,
      });
    }
  }

  const manifestCards = manifest.cards ?? [];
  if (manifestCards.length !== 56) {
    fail(`${manifestPath}: expected 56 overlay entries, found ${manifestCards.length}`);
  }

  const byId = new Map(manifestCards.map((card) => [card.cardId, card]));
  const seenOverlays = new Set();

  for (const expected of expectedCards) {
    const entry = byId.get(expected.cardId);
    if (!entry) {
      fail(`${manifestPath}: missing overlay entry for ${expected.cardId}`);
      continue;
    }

    if (entry.suit !== expected.suit) {
      fail(`${manifestPath}:${expected.cardId}: expected suit ${expected.suit}, found ${entry.suit}`);
    }

    if (entry.title !== expected.title) {
      fail(`${manifestPath}:${expected.cardId}: expected title "${expected.title}", found "${entry.title}"`);
    }

    if (entry.sourceData !== expected.sourceData) {
      fail(`${manifestPath}:${expected.cardId}: expected sourceData ${expected.sourceData}, found ${entry.sourceData}`);
    }

    if (typeof entry.overlay !== 'string' || !entry.overlay.endsWith(`/${expected.cardId}.svg`)) {
      fail(`${manifestPath}:${expected.cardId}: overlay path must end with /${expected.cardId}.svg`);
      continue;
    }

    if (seenOverlays.has(entry.overlay)) {
      fail(`${manifestPath}:${expected.cardId}: duplicate overlay path ${entry.overlay}`);
    }
    seenOverlays.add(entry.overlay);

    const overlayFullPath = path.join(root, entry.overlay);
    if (!fs.existsSync(overlayFullPath)) {
      fail(`${entry.overlay}: missing`);
      continue;
    }

    const svgText = fs.readFileSync(overlayFullPath, 'utf8');
    const size = svgSize(svgText);
    if (size.width !== 1024 || size.height !== 1536) {
      fail(`${entry.overlay}: expected SVG size 1024x1536, found ${size.width}x${size.height}`);
    }

    for (const required of [
      expected.title,
      'locked Bird Squad Minor Arcana overlay',
      '<text',
      'goldRail',
      'suitAccent',
    ]) {
      if (!svgText.includes(required)) {
        fail(`${entry.overlay}: missing required overlay content "${required}"`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Minor Arcana overlay validation failed with ${errors.length} issue(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Minor Arcana overlay validation passed.');
console.log('Checked 56 data-derived SVG border/title overlays at 1024x1536.');
