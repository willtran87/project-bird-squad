import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const args = process.argv.slice(2);
const targetRootArg = args.find((arg) => !arg.startsWith('--')) ?? '.generated/imagegen/tarot/aviary-border-first-runs/latest';
const sourceRootArg = args.find((arg) => arg.startsWith('--source-root='))?.split('=')[1];
const templateArg = args.find((arg) => arg.startsWith('--template='))?.split('=')[1]
  ?? 'assets/templates/minor-arcana/raster-border-templates/master.png';
const targetRoot = path.resolve(root, targetRootArg);
const sourceRoot = sourceRootArg ? path.resolve(root, sourceRootArg) : null;
const templatePath = path.resolve(root, templateArg);
const errors = [];

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
  const topMedallion = { x1: 440, y1: 38, x2: 584, y2: 150 };
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
      const inTopMedallion = x >= topMedallion.x1 && x < topMedallion.x2 && y >= topMedallion.y1 && y < topMedallion.y2;

      if (inOpening && finalAlpha <= 16) gap += 1;
      if (!inOpening && templateAlpha <= 16 && finalAlpha > 16) leak += 1;
      if (!inTitle && !inTopMedallion && templateAlpha > 220 && finalAlpha > 220) {
        const dr = Math.abs(finalPixels[i] - templatePixels[i]);
        const dg = Math.abs(finalPixels[i + 1] - templatePixels[i + 1]);
        const db = Math.abs(finalPixels[i + 2] - templatePixels[i + 2]);
        if (dr > 2 || dg > 2 || db > 2) borderMismatch += 1;
      }
    }
  }

  return { leak, gap, borderMismatch };
}

function sourceCandidates(cardId) {
  if (!sourceRoot) return [];
  return [
    path.join(sourceRoot, 'aviary', `${cardId}.png`),
    path.join(sourceRoot, `${cardId}.png`),
    path.join(sourceRoot, 'aviary', `${cardId}.jpg`),
    path.join(sourceRoot, `${cardId}.jpg`),
    path.join(sourceRoot, 'aviary', `${cardId}.jpeg`),
    path.join(sourceRoot, `${cardId}.jpeg`),
  ];
}

const data = readJson('data/cards/arcana/aviary-arcana.json');

if (!fs.existsSync(targetRoot)) {
  fail(`${path.relative(root, targetRoot)}: missing composite root`);
} else if (!fs.existsSync(templatePath)) {
  fail(`${path.relative(root, templatePath)}: missing master template`);
} else {
  const expectedIds = new Set(data.cards.map((card) => card.id));
  const outputDir = fs.existsSync(path.join(targetRoot, 'aviary')) ? path.join(targetRoot, 'aviary') : targetRoot;
  const pngs = fs.existsSync(outputDir)
    ? fs.readdirSync(outputDir).filter((name) => name.toLowerCase().endsWith('.png'))
    : [];

  if (pngs.length !== data.cards.length) {
    fail(`${path.relative(root, outputDir)}: expected ${data.cards.length} PNGs, found ${pngs.length}`);
  }

  const templatePng = fs.existsSync(templatePath) ? pngSize(templatePath) : null;
  const templatePixels = templatePng ? rgbaPixels(templatePng) : null;

  for (const card of data.cards) {
    const compositePath = path.join(outputDir, `${card.id}.png`);
    if (!fs.existsSync(compositePath)) {
      fail(`${path.relative(root, compositePath)}: missing final composite`);
      continue;
    }

    const size = pngSize(compositePath);
    if (size.width !== 1024 || size.height !== 1536) {
      fail(`${path.relative(root, compositePath)}: expected 1024x1536, found ${size.width}x${size.height}`);
    }
    if (size.colorType !== 6 || !hasTransparentCorners(size)) {
      fail(`${path.relative(root, compositePath)}: expected RGBA PNG output with transparent outer card area`);
    }

    const finalPixels = rgbaPixels(size);
    if (finalPixels && templatePixels) {
      const { leak, gap, borderMismatch } = borderLayerLeakCount(finalPixels, templatePixels, size.width, size.height);
      if (leak > 0) {
        fail(`${path.relative(root, compositePath)}: generated art leaks through ${leak} transparent border-template pixel(s) outside the template art opening`);
      }
      if (gap > 0) {
        fail(`${path.relative(root, compositePath)}: shaped art opening has ${gap} transparent gap pixel(s)`);
      }
      if (borderMismatch > 0) {
        fail(`${path.relative(root, compositePath)}: ${borderMismatch} opaque non-title/non-numeral border pixel(s) differ from the master border template`);
      }
    }

    if (sourceRoot && !sourceCandidates(card.id).some((candidate) => fs.existsSync(candidate))) {
      fail(`${card.id}: missing matching center-art source under ${path.relative(root, sourceRoot)}`);
    }
  }

  for (const png of pngs) {
    const cardId = path.basename(png, '.png');
    if (!expectedIds.has(cardId)) {
      fail(`${path.relative(root, path.join(outputDir, png))}: filename does not match known Aviary card id`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Aviary composite validation failed with ${errors.length} issue(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Aviary composite validation passed.');
console.log(`Checked ${data.cards.length} final composite PNGs in ${path.relative(root, targetRoot)}.`);
