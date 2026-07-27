#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const failures = [];
const runtimeTellPath = path.join(root, 'assets/runtime/fx/combat-enemy-attack-tell.png');
const canonicalSourcePath = path.join(
  root,
  'assets/concept-art/fx/sources/combat-enemy-attack-tell-source-v2-directionless.png',
);
const retiredSourcePath = path.join(
  root,
  'assets/concept-art/fx/sources/combat-enemy-attack-tell-source-v1.png',
);

function fail(message) {
  failures.push(message);
}

function readPng(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`${path.relative(root, file)} is not a PNG file`);
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
  const output = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    output.push({ type, data: buffer.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return output;
}

function paeth(a, b, c) {
  const estimate = a + b - c;
  const distanceA = Math.abs(estimate - a);
  const distanceB = Math.abs(estimate - b);
  const distanceC = Math.abs(estimate - c);
  if (distanceA <= distanceB && distanceA <= distanceC) return a;
  if (distanceB <= distanceC) return b;
  return c;
}

function rgbaPixels(png) {
  if (png.bitDepth !== 8 || png.colorType !== 6 || png.interlace !== 0) {
    throw new Error('attack tell must remain an 8-bit, non-interlaced RGBA PNG');
  }

  const idat = Buffer.concat(
    chunks(png.buffer).filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data),
  );
  const inflated = zlib.inflateSync(idat);
  const bytesPerPixel = 4;
  const stride = png.width * bytesPerPixel;
  const output = Buffer.alloc(png.height * stride);
  let inputOffset = 0;

  for (let y = 0; y < png.height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const row = inflated.subarray(inputOffset, inputOffset + stride);
    inputOffset += stride;
    const outputOffset = y * stride;

    for (let x = 0; x < stride; x += 1) {
      const raw = row[x];
      const left = x >= bytesPerPixel ? output[outputOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? output[outputOffset + x - stride] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? output[outputOffset + x - stride - bytesPerPixel] : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paeth(left, up, upLeft);
      else throw new Error(`unsupported PNG filter ${filter}`);
      output[outputOffset + x] = value & 0xff;
    }
  }
  return output;
}

if (!fs.existsSync(runtimeTellPath)) {
  fail('missing canonical runtime attack tell PNG');
}
if (!fs.existsSync(canonicalSourcePath)) {
  fail('missing canonical v2 directionless attack tell source');
}
if (fs.existsSync(retiredSourcePath)) {
  fail('retired directional v1 attack tell source is forbidden');
}

let metrics;
if (failures.length === 0) {
  try {
    const png = readPng(runtimeTellPath);
    if (png.width !== 512 || png.height !== 512) {
      fail(`attack tell must remain 512x512, received ${png.width}x${png.height}`);
    }
    const pixels = rgbaPixels(png);
    const alphaAt = (x, y) => pixels[(y * png.width + x) * 4 + 3];
    const centerStartX = Math.floor(png.width * 0.35);
    const centerEndX = Math.ceil(png.width * 0.65);
    const centerStartY = Math.floor(png.height * 0.35);
    const centerEndY = Math.ceil(png.height * 0.65);
    let centerOpaquePixels = 0;
    let visiblePixels = 0;
    let alphaTotal = 0;
    let weightedX = 0;
    let weightedY = 0;
    let rotationDifference = 0;
    const quadrantAlpha = [0, 0, 0, 0];

    for (let y = 0; y < png.height; y += 1) {
      for (let x = 0; x < png.width; x += 1) {
        const alpha = alphaAt(x, y);
        if (
          x >= centerStartX && x < centerEndX
          && y >= centerStartY && y < centerEndY
          && alpha > 12
        ) {
          centerOpaquePixels += 1;
        }
        if (alpha > 12) visiblePixels += 1;
        alphaTotal += alpha;
        weightedX += alpha * x;
        weightedY += alpha * y;
        quadrantAlpha[(y >= png.height / 2 ? 2 : 0) + (x >= png.width / 2 ? 1 : 0)] += alpha;
        rotationDifference += Math.abs(alpha - alphaAt(png.width - 1 - x, png.height - 1 - y));
      }
    }

    const centerX = weightedX / alphaTotal;
    const centerY = weightedY / alphaTotal;
    const rotationalDifferenceMean = rotationDifference / (png.width * png.height);
    const quadrantBalance = Math.max(...quadrantAlpha) / Math.min(...quadrantAlpha);
    const corners = [
      alphaAt(0, 0),
      alphaAt(png.width - 1, 0),
      alphaAt(0, png.height - 1),
      alphaAt(png.width - 1, png.height - 1),
    ];
    metrics = {
      centerOpaquePixels,
      visiblePixels,
      centerX,
      centerY,
      rotationalDifferenceMean,
      quadrantBalance,
    };

    if (centerOpaquePixels !== 0) {
      fail(`attack tell center must be fully clear; found ${centerOpaquePixels} visible center pixels`);
    }
    if (visiblePixels < 5_000) {
      fail(`attack tell perimeter is too sparse; found ${visiblePixels} visible pixels`);
    }
    if (corners.some((alpha) => alpha > 12)) {
      fail(`attack tell corners must remain transparent; received alpha values ${corners.join(', ')}`);
    }
    if (Math.abs(centerX - (png.width - 1) / 2) > png.width * 0.04
      || Math.abs(centerY - (png.height - 1) / 2) > png.height * 0.04) {
      fail(`attack tell alpha mass is directionally biased at (${centerX.toFixed(1)}, ${centerY.toFixed(1)})`);
    }
    if (rotationalDifferenceMean > 20) {
      fail(`attack tell silhouette is too directional; 180-degree alpha difference is ${rotationalDifferenceMean.toFixed(2)}`);
    }
    if (quadrantBalance > 1.3) {
      fail(`attack tell perimeter is too directionally imbalanced; quadrant ratio is ${quadrantBalance.toFixed(2)}`);
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

if (failures.length > 0) {
  console.error(`Combat FX contract validation failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Combat FX contract validation passed.');
console.log(
  `Directionless attack tell: clear center, ${metrics.visiblePixels} visible perimeter pixels, `
  + `${metrics.rotationalDifferenceMean.toFixed(2)} rotational difference, `
  + `${metrics.quadrantBalance.toFixed(2)} quadrant ratio.`,
);
