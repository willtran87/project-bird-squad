#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const build = path.resolve(process.argv[2] ?? '.artifacts/build');
const output = path.resolve(process.argv[3] ?? '.artifacts/build-evidence.json');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const names = [...new Set(git('ls-files', '-c', '-o', '--exclude-standard', '-z').split('\0'))]
  .filter(name => name && fs.existsSync(name) && fs.statSync(name).isFile()).sort();
const source = crypto.createHash('sha256');
for (const name of names) source.update(name).update('\0').update(fs.readFileSync(name)).update('\0');
const entries = fs.readdirSync(path.join(build, 'assets')).filter(name => /^index-.*\.js$/.test(name));
if (entries.length !== 1) throw new Error(`Expected one app entry, found ${entries.length}`);
const entry = path.join(build, 'assets', entries[0]);
const result = {
  generatedAt: new Date().toISOString(), revision: git('rev-parse', 'HEAD'),
  dirty: git('status', '--porcelain').length > 0,
  sourceSha256: source.digest('hex'), sourceFiles: names.length,
  buildDirectory: path.relative(process.cwd(), build).replaceAll('\\', '/'),
  entry: entries[0], entryBytes: fs.statSync(entry).size,
  entrySha256: crypto.createHash('sha256').update(fs.readFileSync(entry)).digest('hex'),
  htmlSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(build, 'index.html'))).digest('hex'),
  note: 'Identity only; not a test pass. Pair with the report for this exact build. Dirty source hashes include tracked and non-ignored untracked files.',
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
