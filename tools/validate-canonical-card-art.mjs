import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Validate the exact masters selected by the runtime manifest, not an optional
// artist's "latest" work directory. Existing pixel-level gates remain intact.
const root = process.cwd();
const artifacts = path.resolve(root, '.artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const staging = fs.mkdtempSync(path.join(artifacts, 'canonical-card-check-'));
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
let failed = false;
try {
  const manifest = new Map(read('assets/runtime/cards/card-art-manifest.json').cards.map(card => [card.cardId, card]));
  for (const [folder, file] of [
    ['plumes', 'minor-arcana-wands'], ['basins', 'minor-arcana-cups'],
    ['quills', 'minor-arcana-swords'], ['nests', 'minor-arcana-pentacles'],
    ['aviary', 'aviary-arcana'],
  ]) {
    const destination = path.join(staging, folder);
    fs.mkdirSync(destination);
    for (const card of read(`data/cards/arcana/${file}.json`).cards) {
      const entry = manifest.get(card.id);
      if (entry?.status !== 'approved' || !entry.source) throw new Error(`Missing approved master: ${card.id}`);
      fs.copyFileSync(path.resolve(root, entry.source), path.join(destination, `${card.id}.png`));
    }
  }
  for (const validator of ['validate-minor-composites.mjs', 'validate-aviary-composites.mjs']) {
    const result = spawnSync(process.execPath, [path.join(root, 'tools', validator), staging], { stdio: 'inherit', windowsHide: true });
    if (result.error) throw result.error;
    failed ||= result.status !== 0;
  }
} finally {
  // Only disposable copies in the exact directory allocated above are removed.
  if (path.dirname(staging) !== artifacts || !path.basename(staging).startsWith('canonical-card-check-')) {
    throw new Error('Refusing cleanup outside the owned canonical-art staging directory');
  }
  fs.rmSync(staging, { recursive: true, force: true });
}
const integrity = spawnSync('python', [path.join(root, 'tools', 'validate-card-export-integrity.py')], { stdio: 'inherit', windowsHide: true });
if (integrity.error) throw integrity.error;
if (failed || integrity.status !== 0) process.exitCode = 1;
