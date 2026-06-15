import fs from 'node:fs';
import path from 'node:path';

const targetDir = process.argv[2] ?? 'assets/concept-art/minor-arcana';
const targetWidth = Number(process.argv[3] ?? 1024);
const targetHeight = Number(process.argv[4] ?? 1536);
const root = process.cwd();
const start = path.resolve(root, targetDir);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) return [fullPath];
    return [];
  });
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

const files = walk(start);
const mismatches = [];

for (const file of files) {
  const size = pngSize(file);
  if (size.width !== targetWidth || size.height !== targetHeight) {
    mismatches.push({ file: path.relative(root, file), ...size });
  }
}

if (mismatches.length > 0) {
  console.error(`Found ${mismatches.length} PNG dimension mismatch(es); expected ${targetWidth}x${targetHeight}:`);
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch.file}: ${mismatch.width}x${mismatch.height}`);
  }
  process.exit(1);
}

console.log(`Art dimension validation passed: ${files.length} PNG file(s) are ${targetWidth}x${targetHeight}.`);
