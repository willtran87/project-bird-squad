import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const urls = new Map();
async function load(name) {
  if (urls.has(name)) return urls.get(name);
  let js = ts.transpileModule(await readFile(new URL(`../../src/game/${name}.ts`,import.meta.url),'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  for (const m of [...js.matchAll(/from ['"]\.\/([^'"]+)['"]/g)]) js=js.replace(m[0],`from '${await load(m[1])}'`);
  const url=`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;urls.set(name,url);return url;
}
const rules=await import(await load('flyway-rules')), guidance=await import(await load('build-guidance')), highlights=await import(await load('flight-highlights')), formations=await import(await load('tactical-formations'));
const cards=JSON.parse(await readFile(new URL('../../data/game/alpha-cards.json',import.meta.url),'utf8')).cards;
const bird=id=>{const runtime=cards.find(c=>c.id===id);return {id,name:runtime.name,runtime};};

test('six complementary alternatives are legal, exclusive, immutable and round-trip on their own birds',()=>{
  assert.equal(rules.buildPreens.length,6);
  for(const b of rules.buildPreens){
    const card=cards.find(c=>c.id===b.card),before=JSON.stringify(card),up=rules.branchUpgrade(card,b.id);
    assert.deepEqual(up.effects,b.effects);assert.deepEqual(up.moltEffects,b.moltEffects);
    assert.equal(rules.validBranch(card.id,b.id),b.id);assert.equal(rules.validBranch('aviary_25',b.id),undefined);
    up.effects.push('fixture');assert.equal(JSON.stringify(card),before);assert.ok(!b.effects.includes('fixture'));
    assert.match(b.tradeoff,/Trade|Give up|Deal/);
  }
});
test('reward reading uses the owned branch and distinguishes potential from observed results',()=>{
  const a=bird('cups_ace');a.upgraded=true;a.runtime={...a.runtime,upgrade:rules.branchUpgrade(a.runtime,'build-chorus')};
  const flash=bird('wands_ace');flash.upgraded=true;
  const read=guidance.candidateBuildReading(flash,[a,flash],[]);
  assert.match(read.potential,/Resonance setup/);assert.match(read.potential,/Potential only/);assert.match(read.observed,/no recorded plays/);
  const none=guidance.candidateBuildReading(flash,[bird('cups_ace'),flash],[]);
  assert.match(none.potential,/No other owned card generates/);
});
test('legacy and malformed highlight saves do not invent moments or rewards',()=>{
  const s=rules.normalizeFlyway({comboMoment:{id:'invented'},cardMoment:{cardId:'x',plays:Infinity}});
  assert.equal(s.comboMoment,undefined);assert.equal(s.cardMoment,undefined);
  const text=highlights.flightHighlights(s,id=>id).join('\n');assert.match(text,/No card contribution/);assert.match(text,/No resident visits/);
  const valid=rules.normalizeFlyway({comboMoment:{id:'brace-cut',turn:2,damage:1,cover:0,resonance:0,defeated:true},cardMoment:{cardId:'major_00',plays:3,damage:9,cover:4},cityAid:['oren']});
  assert.deepEqual(rules.normalizeFlyway(JSON.parse(JSON.stringify(valid))),valid);
  assert.match(highlights.flightHighlights(valid,()=> 'First Flight').join('\n'),/combination defeated its target/);
});
test('formation overrides clone canonical birds and share disclosed three-beat cycles',()=>{
  const canonical=[{id:'bird',health:99,moves:[{id:'original',effects:[]}]} ,{id:'support',health:99,moves:[]}];
  for(const id of ['enc_canal_open_perch','enc_canal_alternating_watch','enc_spire_quiet_beat']){
    const out=formations.tacticalFormation(id,id.includes('spire')?canonical.slice(0,1):canonical);
    assert.equal(out[0].moves.length,3);assert.deepEqual(out[0].moves[2].effects,[]);assert.equal(canonical[0].health,99);
    assert.equal(out[0].attackPattern.moveIds.length,3);
  }
  assert.equal(formations.tacticalFormation('original',canonical),canonical);
});
