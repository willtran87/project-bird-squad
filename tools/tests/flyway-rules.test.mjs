import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../../src/game/flyway-rules.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const rules = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
const cards = JSON.parse(await readFile(new URL('../../data/game/alpha-cards.json', import.meta.url), 'utf8')).cards;

test('High Roost claimed favors normalize without duplicates or invented IDs', () => {
  assert.deepEqual(rules.normalizeFlyway({cityAid:['sella','sella','ivo']}).cityAid,['sella','ivo']);
  assert.deepEqual(rules.normalizeFlyway({cityAid:['prototype',99,'oren']}).cityAid,['oren']);
  assert.equal(rules.normalizeFlyway({cityAid:'ivo'}).cityAid,undefined);
});

test('Spires signatures reconstruct exact costs and active rules without mutating canonical cards', () => {
  for (const branch of rules.spirePreens) {
    const card=cards.find(c=>c.id===branch.card),before=JSON.stringify(card);
    assert.equal(rules.validBranch(card.id,branch.id),branch.id);
    assert.equal(rules.validBranch('major_00',branch.id),undefined);
    const upgrade=rules.branchUpgrade(card,branch.id);
    assert.deepEqual(upgrade.effects,branch.effects);assert.deepEqual(upgrade.moltEffects,branch.moltEffects);
    assert.equal(upgrade.cost,branch.cost??card.upgrade.cost);
    upgrade.effects.push('draw(99)');assert.equal(JSON.stringify(card),before);assert.ok(!branch.effects.includes('draw(99)'));
    for(const [key,value] of Object.entries(card.upgrade))if(!['cost','effects','moltEffects'].includes(key))assert.deepEqual(upgrade[key],value);
  }
});
test('Ivo relay progress rejects forged delivery flags and counts only unique Spires settlements', () => {
  const s=rules.normalizeFlyway({spireRelay:{pledge:'wires',startedAt:1,delivered:true},settledNodes:['1:a','2:a','2:a']});
  assert.equal(s.spireRelay.delivered,undefined);assert.equal(rules.spireRelayProgress(s).ready,false);
  s.settledNodes.push('2:b');assert.equal(rules.spireRelayProgress(s).ready,false);
  s.settledNodes.push('2:c');assert.equal(rules.spireRelayProgress(s).ready,true);
  for(const pledge of ['wires','lenses']){
    const saved=rules.normalizeFlyway({spireRelay:{pledge,startedAt:-4,rewarded:true,delivered:true}});
    assert.deepEqual(saved.spireRelay,{pledge,startedAt:0,rewarded:true,delivered:true});
    assert.deepEqual(rules.normalizeFlyway(JSON.parse(JSON.stringify(saved))),saved);
  }
  assert.equal(rules.normalizeFlyway({spireRelay:{pledge:'__proto__'}}).spireRelay,undefined);
  const defeated=rules.normalizeFlyway({spireRelay:{pledge:'lenses',startedAt:5},restored:[2]});assert.equal(rules.spireRelayProgress(defeated).ready,true);
});

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
test('Canal alternatives keep exclusive card identity, canonical stats and exact active rules', () => {
  assert.equal(rules.canalPreens.length, 6);
  for (const choice of rules.canalPreens) {
    const card = cards.find(card => card.id === choice.card), original = JSON.stringify(card);
    assert.equal(rules.validBranch(card.id, choice.id), choice.id);
    assert.equal(rules.validBranch('major_00', choice.id), undefined);
    const upgraded = rules.branchUpgrade(card, choice.id);
    assert.deepEqual(upgraded.effects, choice.effects);
    assert.deepEqual(upgraded.moltEffects, choice.moltEffects);
    assert.deepEqual(upgraded.flockStats, card.upgrade.flockStats);
    assert.notDeepEqual(upgraded.effects, card.upgrade.effects);
    upgraded.effects.push('tampered');
    assert.equal(rules.branchUpgrade(card, choice.id).effects.includes('tampered'), false);
    assert.equal(JSON.stringify(card), original);
  }
  assert.equal(rules.branchUpgrade(cards.find(c => c.id === 'aviary_25'), 'canal-harbor').cost, 1);
});
test('ferry progress counts unique Canal settlements after the pledge and survives normalization', () => {
  const s = rules.normalizeFlyway({canalFerry:{pledge:'lamps',startedAt:1,rewarded:'true'},settledNodes:['0:a','1:a','1:a','2:b']});
  assert.equal(s.canalFerry.rewarded, undefined);
  assert.deepEqual(rules.canalFerryProgress(s), {clears:1,ready:false});
  s.settledNodes.push('1:b'); assert.equal(rules.canalFerryProgress(s).ready,false);
  s.settledNodes.push('1:c'); assert.equal(rules.canalFerryProgress(s).ready,true);
  s.canalFerry.rewarded=true;
  assert.deepEqual(rules.normalizeFlyway(JSON.parse(JSON.stringify(s))).canalFerry,s.canalFerry);
  assert.equal(rules.normalizeFlyway({canalFerry:{pledge:'forged'}}).canalFerry,undefined);
  assert.equal(rules.normalizeFlyway({canalFerry:{pledge:'timber',startedAt:Infinity}}).canalFerry.startedAt,0);
});
test('Flight Stories require a victory and their own objective', () => {
  for(const story of rules.flightStories){const s=rules.newFlywayState(story.id);assert.equal(s.relic,story.relic);assert.equal(rules.finishStory(s,false,10),false);if(story.id!=='small-flock')assert.equal(rules.finishStory(s,true,10),false);s.survivedMolt=3;s.cleanFights=3;assert.equal(rules.finishStory(s,true,10),true);rules.finishStory(s,true,10);assert.deepEqual(s.medals,[story.id]);}
  const s=rules.newFlywayState('small-flock');assert.equal(rules.finishStory(s,true,11),false);
});
