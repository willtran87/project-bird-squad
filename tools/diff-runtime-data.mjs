#!/usr/bin/env node
// tools/diff-runtime-data.mjs
//
// Field-level, id-matched diff of Bird Squad runtime data between two snapshots.
// Purpose: make balance iteration legible during playtesting — see exactly which
// gameplay number moved between builds, while ignoring art/copy/ordering churn.
//
// This is the Phase-4 "diff-runtime-data" tool from
// docs/game/next-level-data-contracts.md §13 (a spire-codex pattern: id-matched
// leaf diff with a presentation-key skip set). Dependency-free, mirroring
// tools/validate-runtime-data.mjs.
//
// Usage:
//   node tools/diff-runtime-data.mjs                     # working tree vs git HEAD
//   node tools/diff-runtime-data.mjs --base <ref>        # working tree vs <ref>
//   node tools/diff-runtime-data.mjs <a.json> <b.json>   # diff two explicit files
//
// Flags:
//   --all            include presentation keys (art/copy/version), normally skipped
//   --check          exit 1 if any change is found (CI / pre-commit gate)
//   --skip a,b,c     extra key names to ignore anywhere in the tree
//
// Output legend:  ~ changed   + added   - removed

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const argv = process.argv.slice(2);

const opts = { base: 'HEAD', all: false, check: false, skip: [], files: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--base') opts.base = argv[++i];
  else if (a === '--skip') opts.skip = (argv[++i] || '').split(',').filter(Boolean);
  else if (a === '--all') opts.all = true;
  else if (a === '--check') opts.check = true;
  else if (a.startsWith('--')) { console.error(`unknown flag: ${a}`); process.exit(2); }
  else opts.files.push(a);
}

// Presentation / metadata keys: skipped by default so a balance diff is not buried
// under art, copy, and ordering churn. Override with --all or extend with --skip.
const PRESENTATION_KEYS = new Set([
  'name', 'displayName', 'displayText', 'bird', 'label', 'prompt', 'title', 'text',
  'description', 'flavor', 'introText', 'victoryText', 'lossText', 'lesson', 'notes',
  'detail', 'shortLabel', 'art', 'portrait', 'thumbnail', 'icon', 'image', 'source',
  'basedOn', 'version', 'project',
]);
const skipKeys = new Set([...(opts.all ? [] : PRESENTATION_KEYS), ...opts.skip]);

const typeOf = (v) =>
  Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v === 'object' ? 'object' : 'primitive';

// A stable identity for an array element, so reordered or inserted items diff by
// id rather than by position. Falls back to positional indexing when unkeyed.
const keyOf = (item, index) => {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    if (typeof item.id === 'string') return `#${item.id}`;
    if (typeof item.from === 'string' && typeof item.to === 'string') return `#${item.from}->${item.to}`;
    if (typeof item.cardId === 'string') return `#${item.cardId}`;
    if (typeof item.key === 'string') return `#${item.key}`;
  }
  return `@${index}`;
};
const arrayKeyed = (arr) =>
  arr.length > 0 && arr.every((x, i) => keyOf(x, i).startsWith('#'));
const disp = (k) => k.replace(/^[#@]/, '');

const fmt = (v) => {
  if (v === undefined) return '∅';
  if (typeof v === 'string') return JSON.stringify(v);
  if (v === null || typeof v !== 'object') return String(v);
  if (Array.isArray(v)) return `[${v.length} item${v.length === 1 ? '' : 's'}]`;
  const id = v.id ?? (v.from && v.to ? `${v.from}->${v.to}` : undefined) ?? v.cardId ?? v.key;
  return id ? `{${id}}` : '{…}';
};

function diff(a, b, p, out) {
  if (a === b) return;
  const ta = typeOf(a);
  const tb = typeOf(b);
  if (ta !== tb) { out.push(`~ ${p}: ${fmt(a)} -> ${fmt(b)}`); return; }

  if (ta === 'array') {
    if (arrayKeyed(a) && arrayKeyed(b)) {
      const ma = new Map(a.map((x, i) => [keyOf(x, i), x]));
      const mb = new Map(b.map((x, i) => [keyOf(x, i), x]));
      for (const [k, x] of ma) {
        if (mb.has(k)) diff(x, mb.get(k), `${p}[${disp(k)}]`, out);
        else out.push(`- ${p}[${disp(k)}]`);
      }
      for (const [k, x] of mb) if (!ma.has(k)) out.push(`+ ${p}[${disp(k)}] = ${fmt(x)}`);
    } else {
      const n = Math.max(a.length, b.length);
      for (let i = 0; i < n; i++) {
        if (i >= a.length) out.push(`+ ${p}[${i}] = ${fmt(b[i])}`);
        else if (i >= b.length) out.push(`- ${p}[${i}]`);
        else diff(a[i], b[i], `${p}[${i}]`, out);
      }
    }
    return;
  }

  if (ta === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (skipKeys.has(k)) continue;
      const sub = p ? `${p}.${k}` : k;
      if (!(k in a)) out.push(`+ ${sub} = ${fmt(b[k])}`);
      else if (!(k in b)) out.push(`- ${sub}`);
      else diff(a[k], b[k], sub, out);
    }
    return;
  }

  out.push(`~ ${p}: ${fmt(a)} -> ${fmt(b)}`);
}

const parseOrNull = (text, label) => {
  if (text == null) return null;
  try { return JSON.parse(text); }
  catch (e) { console.error(`  ! ${label}: parse error: ${e.message}`); return undefined; }
};
const readWorking = (rel) => {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};
const gitShow = (ref, rel) => {
  try {
    return execFileSync('git', ['show', `${ref}:${rel}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return null; }
};
const listBaseFiles = (ref, dir) => {
  try {
    const out = execFileSync('git', ['ls-tree', '--name-only', '-r', ref, `${dir}/`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n').map((s) => s.trim()).filter((s) => /alpha-.*\.json$/.test(s));
  } catch { return []; }
};

let anyChange = false;
function reportFile(name, baseObj, workObj) {
  if (baseObj === undefined || workObj === undefined) return; // parse error already logged
  if (baseObj === null && workObj === null) return;
  if (baseObj === null) { anyChange = true; console.log(`\n${name}  NEW FILE`); return; }
  if (workObj === null) { anyChange = true; console.log(`\n${name}  DELETED`); return; }
  const out = [];
  diff(baseObj, workObj, '', out);
  if (out.length) {
    anyChange = true;
    console.log(`\n${name}  (${out.length} change${out.length === 1 ? '' : 's'})`);
    for (const line of out) console.log(`  ${line}`);
  }
}

if (opts.files.length === 2) {
  const [fa, fb] = opts.files;
  const ra = readWorking(fa);
  const rb = readWorking(fb);
  if (ra == null) { console.error(`file not found: ${fa}`); process.exit(2); }
  if (rb == null) { console.error(`file not found: ${fb}`); process.exit(2); }
  reportFile(`${fa}  ->  ${fb}`, parseOrNull(ra, fa), parseOrNull(rb, fb));
} else if (opts.files.length !== 0) {
  console.error('usage: diff-runtime-data.mjs [--base <ref>] [--all] [--check] [<a.json> <b.json>]');
  process.exit(2);
} else {
  const dir = 'data/game';
  const dirPath = path.join(root, dir);
  const wtFiles = fs.existsSync(dirPath)
    ? fs.readdirSync(dirPath).filter((f) => /^alpha-.*\.json$/.test(f)).map((f) => `${dir}/${f}`)
    : [];
  const baseFiles = listBaseFiles(opts.base, dir);
  const all = [...new Set([...wtFiles, ...baseFiles])].sort();
  if (!all.length) { console.error(`no data/game/alpha-*.json found in working tree or ${opts.base}`); process.exit(2); }
  console.log(`diff: working tree vs ${opts.base}${opts.all ? ' (incl. presentation keys)' : ''}`);
  for (const rel of all) {
    reportFile(rel, parseOrNull(gitShow(opts.base, rel), `${opts.base}:${rel}`), parseOrNull(readWorking(rel), rel));
  }
  if (!anyChange) console.log(`\nno gameplay changes vs ${opts.base}.`);
}

process.exit(opts.check && anyChange ? 1 : 0);
