import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Read existing art directly; never resample, regenerate, or overwrite masters.
const root = process.cwd();
const output = path.resolve(root, '.artifacts/coherent-city/reference.html');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const image = (file, cls = '') => {
  const full = path.resolve(root, file);
  if (!fs.existsSync(full)) throw new Error(`Missing canonical asset: ${file}`);
  return `<a href="${pathToFileURL(full)}"><img class="${cls}" src="${pathToFileURL(full)}" alt="${escape(path.basename(file))}"></a>`;
};
const bible = fs.readFileSync('docs/art/art-bible.md', 'utf8');
const anchors = bible.slice(bible.indexOf('## Character identity and transition gates')).split('\n')
  .filter(line => /^\| (Fledgling|Spark-Caller|Talon|Tidewarden|Roostkeeper|Caldra Pinion) \|/.test(line));
const prefixes = ['fledgling-flock','spark-caller','talon','tidewarden','roostkeeper'];
const leader = prefixes.map((id, i) => `<section><h2>${escape(anchors[i]?.split('|')[1]?.trim() ?? id)}</h2>
  <p>${escape(anchors[i]?.split('|').slice(2,4).join(' · '))}</p><div class="views">
  ${['front-3q','back-ne'].map(view => image(`assets/runtime/flock/leaders/${id}-combat-${view}.webp`)).join('')}</div></section>`).join('');
const residents = ['sella-warmwick-v2','marn-valeclip-v3','ivo-tallymast-v3','oren-shearbright-v3','caldra-pinion-v3'];
const resident = residents.map(id => `<section><h2>${escape(id)}</h2>${image(`assets/runtime/route-events/${id}.webp`)}
  <p>Approved resident cutout. Match the anatomy correction record; Caldra is the peafowl patron, never the jackdaw Captain.</p></section>`).join('');
const manifest = JSON.parse(fs.readFileSync('assets/runtime/cards/card-art-manifest.json', 'utf8'));
const cards = manifest.cards.filter(c => c.status === 'approved');
const card = cards.map(c => `<section data-card="${escape(c.cardId)}"><h2>${escape(c.cardId)}</h2><div class="views cards">
  ${image(c.thumbnail,'hand')}${image(c.portrait,'full')}</div><p>72 × 108 hand-size reference beside full portrait. Click either for its unmodified source.</p></section>`).join('');
const districts = ['rooftop-blocks','canal-markets','signal-spires','high-roost'];
const district = districts.map(id => `<section><h2>${id}</h2>${image(`assets/runtime/backdrops/${id}-route-map-v1.webp`,'landscape')}
  ${image(`assets/runtime/backdrops/${id==='rooftop-blocks'?'rooftop-blocks-readability-v2':id}.webp`,'landscape')}</section>`).join('');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Bird Squad · canonical reference review</title>
<style>body{background:#09121c;color:#e8f1f7;font:18px system-ui;margin:32px}h1{font-size:32px}h2{font-size:21px}p{max-width:80ch;line-height:1.5}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(480px,1fr));gap:20px}section{background:#142330;padding:20px;border:1px solid #516574}img{max-width:100%;height:300px;object-fit:contain}a{color:#99e3ed}.views{display:flex;gap:20px;align-items:end}.views a{min-width:0;flex:1}.cards a:first-child{flex:0 0 72px}.hand{width:72px;height:108px}.full{height:384px}.landscape{height:auto;width:100%}</style>
<h1>Bird Squad · canonical reference review</h1><p>Original runtime artwork. This gallery is a review aid, not automatic identity approval. Compare each bird with the art bible, then verify its live presentation and transitions.</p>
<nav><a href="#leaders">Leaders</a> · <a href="#residents">Residents</a> · <a href="#districts">Districts</a> · <a href="#cards">${cards.length} approved cards</a></nav>
<h1 id="leaders">Leader views and locked anchors</h1><main>${leader}</main>
<h1 id="residents">Recurring residents</h1><main>${resident}</main>
<h1 id="districts">District route and battle framing</h1><main>${district}</main>
<h1 id="cards">Card-size readability</h1><main>${card}</main></html>`;
fs.mkdirSync(path.dirname(output), {recursive:true}); fs.writeFileSync(output,html);
fs.writeFileSync(path.join(path.dirname(output),'reference-inventory.json'),JSON.stringify({leaders:prefixes,residents,districts,cards:cards.map(c=>c.cardId)},null,2));
console.log(JSON.stringify({output,leaders:prefixes.length,residents:residents.length,cards:cards.length}));
