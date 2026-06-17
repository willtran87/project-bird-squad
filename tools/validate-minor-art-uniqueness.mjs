import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const targetRootArg = args.find((arg) => !arg.startsWith('--')) ?? '.generated/imagegen/tarot/minor-arcana-center-art-runs/latest';
const targetRoot = path.resolve(root, targetRootArg);
const errors = [];

function fail(message) {
  errors.push(message);
}

function walkPngs(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.toLowerCase() === 'rejected') continue;
      files.push(...walkPngs(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      files.push(fullPath);
    }
  }
  return files;
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
}

if (!fs.existsSync(targetRoot)) {
  fail(`${path.relative(root, targetRoot)}: missing art root`);
} else {
  const byHash = new Map();
  for (const file of walkPngs(targetRoot)) {
    const hash = hashFile(file);
    const files = byHash.get(hash) ?? [];
    files.push(file);
    byHash.set(hash, files);
  }

  for (const [hash, files] of byHash) {
    if (files.length <= 1) continue;
    fail(`duplicate PNG content ${hash}: ${files.map((file) => path.relative(root, file)).join(' :: ')}`);
  }
}

if (errors.length > 0) {
  console.error(`Minor Arcana art uniqueness validation failed with ${errors.length} issue(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Minor Arcana art uniqueness validation passed.');
console.log(`Checked PNG content hashes in ${path.relative(root, targetRoot)}.`);
