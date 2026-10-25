import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../../src/game/flyway-rules.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const rules = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
const cards = JSON.parse(await readFile(new URL('../../data/game/alpha-cards.json', import.meta.url), 'utf8')).cards;

test('Rooftops strategies survive saves, reject malformed plans and classify actual active rules', () => {
  for (const plan of ['shelter', 'tempo', 'molt']) {
    const state = rules.normalizeFlyway({rooftopPlan: plan, coachingOff: true});
    assert.equal(rules.normalizeFlyway(JSON.parse(JSON.stringify(state))).rooftopPlan, plan);
    assert.equal(state.coachingOff, true);
  }
  assert.equal(rules.normalizeFlyway({rooftopPlan:'__proto__',coachingOff:'true'}).rooftopPlan, undefined);
  assert.equal(rules.normalizeFlyway({coachingOff:'true'}).coachingOff, undefined);
  const byId = id => cards.find(c => c.id === id);
  assert.equal(rules.rooftopPlanMatch('shelter',byId('pentacles_04')),true);
  assert.equal(rules.rooftopPlanMatch('tempo',byId('wands_ace')),true);
  assert.equal(rules.rooftopPlanMatch('molt',byId('aviary_25')),true);
  assert.equal(rules.rooftopPlanMatch('molt',byId('pentacles_04')),false);
  assert.equal(rules.rooftopPlanMatch(undefined,byId('wands_ace')),false);
  assert.equal(rules.rooftopPlanMatch(undefined,{}),false);
  assert.equal(rules.rooftopPlanMatch('shelter',{}),false);
});
test('legacy and malformed expansion saves normalize without shared references', () => {
  const a = rules.normalizeFlyway({ restored:[0,0,-1,4,'2'], residents:{sella:Infinity,ivo:3}, rivalWins:-4, condition:'prototype', journal:['safe',99], medals:['forged','open-sky'] });
  assert.deepEqual(a.restored,[0]); assert.equal(a.residents.sella,0); assert.equal(a.residents.ivo,3); assert.equal(a.condition,'clear');
  assert.deepEqual(a.medals,['open-sky']); assert.deepEqual(a.journal,['safe']);
  const b=rules.normalizeFlyway(a);b.journal.push('later');assert.equal(a.journal.length,1);
  assert.equal(rules.normalizeFlyway(undefined).version,1);
});

test('fresh and story saves retain their exact serialized state after checkpoint normalization', () => {
  for (const story of [undefined, ...rules.flightStories.map(entry => entry.id)]) {
    const original = JSON.stringify(rules.newFlywayState(story));
    assert.equal(JSON.stringify(rules.normalizeFlyway(JSON.parse(original))), original);
  }
});
test('each Leader earns only its own call and can spend it once', () => {
  const cases=[['spark_caller','spend',3],['talon','winded',3],['tidewarden','heal',6],['roostkeeper','block',2]];
  for(const [leader,kind,amount] of cases){const c=rules.newFlightCombat();rules.chargeCall(c,leader,'suit',99,'plumes');assert.equal(c.charge,0);assert.equal(rules.takeCall(c,leader),false);rules.chargeCall(c,leader,kind,amount);assert.equal(rules.takeCall(c,leader),true);assert.equal(rules.takeCall(c,leader),false);}
  const c=rules.newFlightCombat(); for(const suit of ['nests','nests','quills','basins'])rules.chargeCall(c,'fledgling','suit',1,suit);assert.equal(c.charge,3);assert.equal(rules.takeCall(c,'fledgling'),true);
});
test('combinations require consecutive suits and cannot repeat in a turn', () => {
  const c=rules.newFlightCombat();assert.equal(rules.playCombination(c,'nests'),undefined);assert.equal(rules.playCombination(c,'quills').id,'brace-cut');
  rules.playCombination(c,'nests');assert.equal(rules.playCombination(c,'quills'),undefined);
  rules.playCombination(c,'basins');rules.playCombination(c,null);assert.equal(rules.playCombination(c,'plumes'),undefined);
  c.combos=[];rules.playCombination(c,'nests');assert.equal(rules.playCombination(c,'quills').effect,'damage');
});
test('six Preen branches preserve canonical card data and both Molt variants', () => {
  for(const id of rules.branchCards){const card=cards.find(c=>c.id===id);assert.ok(card,id);const before=JSON.stringify(card);const a=rules.branchUpgrade(card,'shelter');const b=rules.branchUpgrade(card,'flight');assert.equal(a.effects.at(-1),'gainCover(2)');assert.equal(b.effects.at(-1),'draw(1)');assert.equal(a.moltEffects.at(-1),'gainCover(2)');assert.equal(b.moltEffects.at(-1),'draw(1)');assert.equal(JSON.stringify(card),before);}
  assert.equal(rules.validBranch('not-a-card','flight'),undefined);
});
test('boss disruption requirements differ across districts and exclude normal enemies', () => {
  const boss={runtime:{type:'boss'},weak:1,hitThisTurn:false,block:4};assert.equal(rules.bossDisruption(boss,0).met,true);assert.equal(rules.bossDisruption(boss,1).met,false);assert.equal(rules.bossDisruption(boss,2).met,false);assert.equal(rules.bossDisruption(boss,3).met,false);
  boss.weak=2;boss.hitThisTurn=true;boss.block=0;for(let i=0;i<4;i++)assert.equal(rules.bossDisruption(boss,i).met,true);
  assert.equal(rules.bossDisruption({...boss,runtime:{type:'normal'}},0),undefined);
});
test('restoration is idempotent and records the actual district', () => {
  const s=rules.newFlywayState();assert.equal(rules.restoreDistrict(s,2),true);assert.equal(rules.restoreDistrict(s,2),false);assert.equal(rules.restoreDistrict(s,9),false);assert.deepEqual(s.restored,[2]);assert.equal(s.journal.length,1);
});
test('Flight Stories require a victory and their own objective', () => {
  for(const story of rules.flightStories){const s=rules.newFlywayState(story.id);assert.equal(s.relic,story.relic);assert.equal(rules.finishStory(s,false,10),false);if(story.id!=='small-flock')assert.equal(rules.finishStory(s,true,10),false);s.survivedMolt=3;s.cleanFights=3;assert.equal(rules.finishStory(s,true,10),true);rules.finishStory(s,true,10);assert.deepEqual(s.medals,[story.id]);}
  const s=rules.newFlywayState('small-flock');assert.equal(rules.finishStory(s,true,11),false);
});
