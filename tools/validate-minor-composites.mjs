import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const args = process.argv.slice(2);
const selectedId = args.find(arg => arg.startsWith('--card-id='))?.slice('--card-id='.length);
let checked = 0;
const targetRootArg = args.find((arg) => !arg.startsWith('--')) ?? '.generated/imagegen/tarot/minor-arcana-border-first-runs/latest';
const sourceRootArg = args.find((arg) => arg.startsWith('--source-root='))?.split('=')[1];
const targetRoot = path.resolve(root, targetRootArg);
const sourceRoot = sourceRootArg ? path.resolve(root, sourceRootArg) : null;
const templateRootArg = args.find((arg) => arg.startsWith('--template-root='))?.split('=')[1]
  ?? 'assets/templates/minor-arcana/raster-border-templates';
const templateRoot = path.resolve(root, templateRootArg);
const errors = [];

const suitFiles = [
  { key: 'plumes', suitName: 'Plumes', file: 'data/cards/arcana/minor-arcana-wands.json', enamel: [60, 36, 64] },
  { key: 'basins', suitName: 'Basins', file: 'data/cards/arcana/minor-arcana-cups.json', enamel: [23, 56, 74] },
  { key: 'quills', suitName: 'Quills', file: 'data/cards/arcana/minor-arcana-swords.json', enamel: [27, 43, 61] },
  { key: 'nests', suitName: 'Nests', file: 'data/cards/arcana/minor-arcana-pentacles.json', enamel: [53, 44, 31] },
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
    buffer,
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  };
}

function chunks(buffer) {
  const out = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    out.push({ type, data });
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function rgbaPixels(png) {
  if (png.colorType !== 6) return null;
  const idat = Buffer.concat(chunks(png.buffer).filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data));
  const inflated = zlib.inflateSync(idat);
  const bytesPerPixel = 4;
  const stride = png.width * bytesPerPixel;
  const out = Buffer.alloc(png.height * stride);
  let inputOffset = 0;

  for (let y = 0; y < png.height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const row = inflated.subarray(inputOffset, inputOffset + stride);
    inputOffset += stride;
    const outOffset = y * stride;

    for (let x = 0; x < stride; x += 1) {
      const raw = row[x];
      const left = x >= bytesPerPixel ? out[outOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? out[outOffset + x - stride] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? out[outOffset + x - stride - bytesPerPixel] : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paeth(left, up, upLeft);
      else throw new Error(`Unsupported PNG filter ${filter}`);
      out[outOffset + x] = value & 0xff;
    }
  }
  return out;
}

function hasTransparentCorners(png) {
  const pixels = rgbaPixels(png);
  if (!pixels) return false;
  const samples = [
    [0, 0],
    [png.width - 1, 0],
    [0, png.height - 1],
    [png.width - 1, png.height - 1],
  ];
  return samples.every(([x, y]) => pixels[(y * png.width + x) * 4 + 3] <= 12);
}

function artOpeningMask(templatePixels, width, height) {
  const seed = { x: 512, y: 700 };
  const seedIndex = seed.y * width + seed.x;
  const mask = new Uint8Array(width * height);
  if (templatePixels[seedIndex * 4 + 3] > 16) return mask;

  const stack = [seedIndex];
  mask[seedIndex] = 1;

  while (stack.length > 0) {
    const index = stack.pop();
    const x = index % width;
    const y = Math.floor(index / width);
    const neighbors = [];
    if (x > 0) neighbors.push(index - 1);
    if (x < width - 1) neighbors.push(index + 1);
    if (y > 0) neighbors.push(index - width);
    if (y < height - 1) neighbors.push(index + width);

    for (const next of neighbors) {
      if (mask[next]) continue;
      if (templatePixels[next * 4 + 3] > 16) continue;
      mask[next] = 1;
      stack.push(next);
    }
  }

  return mask;
}

function borderLayerLeakCount(finalPixels, templatePixels, width, height) {
  const title = { x1: 154, y1: 1310, x2: 870, y2: 1422 };
  const openingMask = artOpeningMask(templatePixels, width, height);
  let leak = 0;
  let gap = 0;
  let borderMismatch = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const templateAlpha = templatePixels[i + 3];
      const finalAlpha = finalPixels[i + 3];
      const inOpening = openingMask[y * width + x] === 1;
      const inTitle = x >= title.x1 && x < title.x2 && y >= title.y1 && y < title.y2;

      if (inOpening && finalAlpha <= 16) gap += 1;
      if (!inOpening && templateAlpha <= 16 && finalAlpha > 16) leak += 1;
      if (!inTitle && templateAlpha > 220 && finalAlpha > 220) {
        const dr = Math.abs(finalPixels[i] - templatePixels[i]);
        const dg = Math.abs(finalPixels[i + 1] - templatePixels[i + 1]);
        const db = Math.abs(finalPixels[i + 2] - templatePixels[i + 2]);
        if (dr > 2 || dg > 2 || db > 2) borderMismatch += 1;
      }
    }
  }

  return { leak, gap, borderMismatch };
}

function sourceCandidates(suitKey, cardId) {
  if (!sourceRoot) return [];
  return [
    path.join(sourceRoot, suitKey, `${cardId}.png`),
    path.join(sourceRoot, `${cardId}.png`),
    path.join(sourceRoot, suitKey, `${cardId}.jpg`),
    path.join(sourceRoot, `${cardId}.jpg`),
    path.join(sourceRoot, suitKey, `${cardId}.jpeg`),
    path.join(sourceRoot, `${cardId}.jpeg`),
  ];
}

if (!fs.existsSync(targetRoot)) {
  fail(`${path.relative(root, targetRoot)}: missing composite root`);
} else {
  const expectedIds = new Set();
  let expectedTotal = 0;

  for (const suit of suitFiles) {
    const data = readJson(suit.file);
    const cards = selectedId ? data.cards.filter(card => card.id === selectedId) : data.cards;
    if (cards.length === 0) continue;
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
      const compositePath = path.join(suitDir, `${card.id}.png`);
      if (!fs.existsSync(compositePath)) {
        fail(`${path.relative(root, compositePath)}: missing final composite`);
        continue;
      }
      checked += 1;

      const size = pngSize(compositePath);
      if (size.width !== 1024 || size.height !== 1536) {
        fail(`${path.relative(root, compositePath)}: expected 1024x1536, found ${size.width}x${size.height}`);
      }
      if (size.colorType !== 6 || !hasTransparentCorners(size)) {
        fail(`${path.relative(root, compositePath)}: expected RGBA PNG output with transparent outer card area`);
      }

      const templatePath = path.join(templateRoot, `${suit.key}.png`);
      if (fs.existsSync(templatePath)) {
        const templatePng = pngSize(templatePath);
        const finalPixels = rgbaPixels(size);
        const templatePixels = rgbaPixels(templatePng);
        if (finalPixels && templatePixels) {
          const { leak, gap, borderMismatch } = borderLayerLeakCount(finalPixels, templatePixels, size.width, size.height);
          if (leak > 0) {
            fail(`${path.relative(root, compositePath)}: generated art leaks through ${leak} transparent border-template pixel(s) outside the template art opening`);
          }
          if (gap > 0) {
            fail(`${path.relative(root, compositePath)}: shaped art opening has ${gap} transparent gap pixel(s)`);
          }
          if (borderMismatch > 0) {
            fail(`${path.relative(root, compositePath)}: ${borderMismatch} opaque non-title border pixel(s) differ from the raster border template`);
          }
        }
      }

      const overlayPath = path.join(root, 'assets/templates/minor-arcana/card-overlays', suit.key, `${card.id}.svg`);
      if (!fs.existsSync(overlayPath)) {
        fail(`${path.relative(root, overlayPath)}: missing matching overlay`);
      }

      if (sourceRoot && !sourceCandidates(suit.key, card.id).some((candidate) => fs.existsSync(candidate))) {
        fail(`${card.id}: missing matching center-art source under ${path.relative(root, sourceRoot)}`);
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
    fail(`${path.relative(root, targetRoot)}: expected ${expectedTotal} total composite PNGs, found ${allPngs.length}`);
  }
  if (selectedId && expectedTotal !== 1) fail(`Unknown Minor Arcana card id: ${selectedId}`);

  for (const pngPath of allPngs) {
    const cardId = path.basename(pngPath, '.png');
    if (!expectedIds.has(cardId)) {
      fail(`${path.relative(root, pngPath)}: unknown card id`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Minor Arcana composite validation failed with ${errors.length} issue(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Minor Arcana composite validation passed.');
console.log(`Checked ${checked} final composite PNGs in ${path.relative(root, targetRoot)}.`);
