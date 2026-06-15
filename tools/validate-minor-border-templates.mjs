import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const args = process.argv.slice(2);
const manifestArg = args.find((arg) => arg.startsWith('--manifest='))?.split('=')[1]
  ?? 'assets/templates/minor-arcana/raster-border-templates/template-manifest.json';
const requireAll = args.includes('--require-all');
const manifestPath = path.resolve(root, manifestArg);
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readPng(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`${file} is not a PNG file`);
  }
  return {
    buffer,
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
    interlace: buffer[28],
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
  if (png.bitDepth !== 8 || png.colorType !== 6 || png.interlace !== 0) {
    return null;
  }

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

function transparentRatio(pixels, width, region) {
  let transparent = 0;
  let total = 0;
  const x1 = Math.max(0, region.x);
  const y1 = Math.max(0, region.y);
  const x2 = Math.min(width, region.x + region.width);
  const y2 = region.y + region.height;
  for (let y = y1; y < y2; y += 1) {
    for (let x = x1; x < x2; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha <= 12) transparent += 1;
      total += 1;
    }
  }
  return total === 0 ? 0 : transparent / total;
}

function opaqueRatio(pixels, width, height, region, inset = 0) {
  let opaque = 0;
  let total = 0;
  const x1 = Math.max(0, region.x + inset);
  const y1 = Math.max(0, region.y + inset);
  const x2 = Math.min(width, region.x + region.width - inset);
  const y2 = Math.min(height, region.y + region.height - inset);
  for (let y = y1; y < y2; y += 1) {
    for (let x = x1; x < x2; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha >= 220) opaque += 1;
      total += 1;
    }
  }
  return total === 0 ? 0 : opaque / total;
}

function chromaResidueCount(pixels, width, height) {
  let residue = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];
      if (a > 16 && g >= 190 && r <= 150 && b <= 150 && g - Math.max(r, b) >= 45) {
        residue += 1;
      }
    }
  }
  return residue;
}

function hasTransparentCorners(pixels, width, height) {
  const samples = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  return samples.every(([x, y]) => pixels[(y * width + x) * 4 + 3] <= 12);
}

if (!fs.existsSync(manifestPath)) {
  fail(`${path.relative(root, manifestPath)}: missing template manifest`);
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const width = manifest.canvas?.width;
  const height = manifest.canvas?.height;
  if (width !== 1024 || height !== 1536) {
    fail(`${path.relative(root, manifestPath)}: canvas must be 1024x1536`);
  }

  if (!manifest.geometry?.imageWindow || !manifest.geometry?.titleCartouche) {
    fail(`${path.relative(root, manifestPath)}: missing imageWindow or titleCartouche geometry`);
  }

  const templates = manifest.templates ?? [];
  if (templates.length !== 5) {
    fail(`${path.relative(root, manifestPath)}: expected 5 template entries, found ${templates.length}`);
  }

  for (const template of templates) {
    const templatePath = path.resolve(root, template.path);
    if (!fs.existsSync(templatePath)) {
      const message = `${template.path}: missing raster template PNG`;
      if (requireAll) fail(message);
      else warn(message);
      continue;
    }

    const png = readPng(templatePath);
    if (png.width !== width || png.height !== height) {
      fail(`${template.path}: expected ${width}x${height}, found ${png.width}x${png.height}`);
    }
    if (png.colorType !== 6) {
      fail(`${template.path}: expected RGBA PNG color type 6, found color type ${png.colorType}`);
    }
    if (png.bitDepth !== 8 || png.interlace !== 0) {
      fail(`${template.path}: expected non-interlaced 8-bit PNG`);
    }

    const pixels = rgbaPixels(png);
    if (pixels) {
      const imageWindowRatio = transparentRatio(pixels, width, manifest.geometry.imageWindow);
      if (imageWindowRatio < 0.9) {
        fail(`${template.path}: imageWindow must be mostly transparent chroma opening while preserving shaped border intrusions, found ${(imageWindowRatio * 100).toFixed(1)}%`);
      }

      const centerIndex = (700 * width + 512) * 4;
      if (pixels[centerIndex + 3] > 12) {
        fail(`${template.path}: center chroma field must be transparent at x=512,y=700`);
      }

      if (!hasTransparentCorners(pixels, width, height)) {
        fail(`${template.path}: outside black canvas corners must be transparent`);
      }

      const chromaResidue = chromaResidueCount(pixels, width, height);
      if (chromaResidue > 0) {
        fail(`${template.path}: found ${chromaResidue} opaque chroma-green residue pixel(s)`);
      }

      const titleCartoucheRatio = opaqueRatio(pixels, width, height, manifest.geometry.titleCartouche, 24);
      if (titleCartoucheRatio < 0.9) {
        fail(`${template.path}: titleCartouche must remain at least 90% opaque for compositor title text, found ${(titleCartoucheRatio * 100).toFixed(1)}%`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Minor Arcana border template validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

for (const message of warnings) {
  console.warn(`Warning: ${message}`);
}

console.log('Minor Arcana border template validation passed.');
console.log(`Checked manifest ${path.relative(root, manifestPath)}.`);
if (warnings.length > 0) {
  console.log('Template PNGs are not all present yet; rerun with --require-all after imagegen assets are prepared.');
}
