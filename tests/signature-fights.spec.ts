import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { signatureFights, signatureFormation } from '../src/game/signature-fights';
import { capstones } from '../src/game/signature-capstones';
import { normalizeFlyway } from '../src/game/flyway-rules';
import { resolveScriptedBattle } from './helpers/scripted-battle';
import { settleCanvas } from './helpers/settled-canvas';

const sizes = [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}];
const encounters = [2,3].flatMap(n=>JSON.parse(readFileSync(`data/game/map0${n}-content.json`,'utf8')).encounters);
const errors = new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{ const list:string[]=[]; errors.set(page,list); page.on('pageerror',e=>list.push(e.message)); });
test.afterEach(async({page})=>{ try { expect(errors.get(page)).toEqual([]); } finally { await page.goto('about:blank'); } });
async function ready(page:Page,map:number) {
  await page.waitForFunction(map=>{const g=(window as any).__birdSquadGame,r=g.scene.getScene('RouteScene');return g.scene.isActive('RouteScene')&&r.runState.mapIndex===map&&r.routeEssentialAssetsReady&&r.openFlyway;},map);
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');if(r.shouldChooseDistrictContract())r.chooseDistrictContract(r.districtContractChoices()[0].id);});
}
async function route(page:Page,map=1) {
  await page.goto('./?flight=signature-release&length=full');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.keyboard.press('Enter'); await ready(page,0);
  await page.evaluate(map=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.scene.restart({runState:{...r.runState,mapIndex:map}});},map); await ready(page,map);
}
async function battle(page:Page,id='enc_signature_ferry') {
  const encounter=encounters.find((e:any)=>e.id===id);
  await page.evaluate(encounter=>{const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene'),n=w.__birdSquadCurrentMap().nodes.find((n:any)=>n.type==='street');Object.assign(n,{payloadId:encounter.id,type:encounter.nodeType,label:encounter.name});r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:n.id});},encounter);
  await battleReady(page);
}
async function battleReady(page:Page) {
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,b=g.scene.getScene('BattleScene');return g.scene.isActive('BattleScene')&&b.livingPerformances?.ready&&b.combatPreviewModule&&b.discardChoiceModule&&b.returnChoiceModule&&!b.combatIntroActive&&!b.combatAnimationPending;});
}
for (const id of Object.keys(signatureFights)) test(`Signature Fights ${id} changes phases and matches every forecast`,async({page},info)=>{
  await route(page,id.includes('relay')?2:1); await battle(page,id);
  const results=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),initial=structuredClone(b.enemies),flock=structuredClone(b.flock),rows=[];
    for(const removed of [false,true])for(let beat=0;beat<10;beat++) {
      b.enemies=structuredClone(initial);b.enemies.forEach((e:any)=>{e.intentIndex=beat;e.block=0;e.nextAttackBonus=beat===3?6:0;});if(removed)b.enemies[1].hp=0;
      b.turn=beat+1;b.flock={...flock,hp:200,maxHp:200,block:5,exposed:false};
      const forecast=b.enemyDamageProjection(b.enemies,b.flock,false);b.resolveEnemyTurn();
      rows.push({beat,removed,hp:b.flock.hp,expected:forecast.afterHp,force:b.enemies[0].nextAttackBonus});
    }
    b.enemies=initial;b.flock=flock;b.turn=1;b.mode='battle';b.renderAll();return rows;
  });
  results.forEach(r=>expect(r.hp).toBe(r.expected));
  if(id.includes('relay')) {expect(results.find(r=>r.beat===2&&!r.removed)?.force).toBe(6);expect(results.find(r=>r.beat===2&&r.removed)?.force).toBe(0);}
  await expect(page.locator('#signature-fight')).toContainText(signatureFights[id as keyof typeof signatureFights].name);
  for(const size of sizes){ await page.setViewportSize(size);await settleCanvas(page);expect(await page.locator('#signature-fight').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`${id}-${size.width}.png`)}); }
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.enemies.forEach((e:any)=>e.intentIndex=3);b.renderAll();});
  await expect(page.locator('#signature-fight')).toContainText(signatureFights[id as keyof typeof signatureFights].phases[3]);
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.enemies.forEach((e:any)=>e.intentIndex=0);});
  const outcome=await page.evaluate(resolveScriptedBattle,'balanced');expect(outcome.mode).not.toBe('battle');
  await info.attach('forecast-and-outcome',{body:JSON.stringify({results,outcome}),contentType:'application/json'});
});

test('Signature Fights capstones are earned, exclusive, persistent and inspectable',async({page},info)=>{
  await route(page,2);await page.keyboard.press('j');
  await expect(page.locator('[data-signature-capstones]')).toContainText('Restore Canal');
  await expect(page.getByRole('button',{name:'Inspect Answerkeeper Knot',exact:true})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.runState.flyway.restored=[0,1];r.openFlyway();});
  await page.getByRole('button',{name:'Inspect Answerkeeper Knot',exact:true}).click();
  for(const size of sizes){await page.setViewportSize(size);await page.getByRole('button',{name:'Carry Answerkeeper Knot',exact:true}).scrollIntoViewIfNeeded();expect(await page.locator('#flyway-book').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`capstone-${size.width}.png`)});}
  await page.getByRole('button',{name:'Carry Answerkeeper Knot',exact:true}).click();
  await expect(page.locator('[data-signature-capstones]')).toContainText('Once per fight');
  await expect(page.getByRole('button',{name:'Inspect Answering Bell',exact:true})).toHaveCount(0);
  await page.reload();await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').continueRun());await ready(page,2);
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.flyway.capstone)).toBe('shelter');
});

for(const choice of Object.keys(capstones))test(`Signature Fights ${choice} capstone resolves once with forecast parity`,async({page})=>{
  await route(page);await page.evaluate(choice=>{(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.flyway.capstone=choice;},choice);await battle(page);
  const result=await page.evaluate(choice=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    if(choice==='shelter') {
      b.cardsPlayedThisTurn=2;b.pendingRetainHand=0;const count=b.projectedRoostRetainCount();
      const forecast=b.enemyDamageProjection(b.enemies,b.flock,true);
      b.checkRoostRestraintMarks(b.hand.length,b.energy,2);b.checkRoostRestraintMarks(b.hand.length,b.energy,2);
      return {count,retain:b.pendingRetainHand,energy:b.nextTurnEnergyBonus,unknown:forecast.unknown};
    }
    const c=b.allDeckCards().find((c:any)=>choice==='molt'?c.runtime.effects.some((e:string)=>e.includes('enterMolt')):c.id==='swords_ace');
    for(const zone of ['hand','drawPile','discardPile','clearedPile'])b[zone]=b[zone].filter((x:any)=>x.instanceId!==c.instanceId);b.hand.push(c);
    b.energy=20;if(choice==='tempo')b.cardsPlayedThisTurn=2;
    const f=b.simulateCardOutcome(c,b.enemies[0].id);b.playCard(c,b.enemies[0].id,{resolveDelayMs:0});
    const first={energy:b.energy,spark:b.spark,guard:b.flock.openSkyGuard,next:b.nextTurnEnergyBonus,hand:b.hand.length};
    if(choice==='molt')b.checkEnterMoltMarks();else b.checkNthCardMarks();
    return {first,second:{energy:b.energy,spark:b.spark,guard:b.flock.openSkyGuard,next:b.nextTurnEnergyBonus,hand:b.hand.length},expected:{energy:f.flockAfter.energy,spark:f.flockAfter.resonance,guard:f.flockAfter.openSkyGuard,next:f.nextTurnEnergyDelta}};
  },choice);
  if(choice==='shelter'){expect(result.retain).toBe(2);expect(result.count).toBe(2);expect(result.energy).toBe(2);}
  else {expect(result.first).toEqual(result.second);expect(result.first?.energy).toBe(result.expected?.energy);expect(result.first?.guard).toBe(result.expected?.guard);expect(result.first?.spark).toBe(result.expected?.spark);expect(result.first?.next).toBe(result.expected?.next);}
});

test('Signature Fights reward offers expose owned pairs, tradeoffs and exact deltas',async({page},info)=>{
  await route(page);await battle(page);
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.enemies.forEach((e:any)=>e.hp=0);b.checkOutcome();b.renderAll();});
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.mode==='cardReward'&&b.rewardPresentationReady();});
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);const fit=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.rewardChoices.map((c:any)=>{
      const get=(name:string)=>b.root.list.find((o:any)=>o.name===name&&o.getData('cardId')===c.id);
      const pair=get('reward-owned-pairing'),delta=get('reward-passive-delta'),trade=get('reward-main-tradeoff'),take=get('reward-card-take-hit');
      return {pair:pair?.getData('fullText'),delta:delta?.getData('fullText'),trade:trade?.getData('fullText'),clear:trade?.getBounds().bottom<=take?.getBounds().top+1};
    });
  });expect(fit).toHaveLength(3);for(const c of fit){expect(c.pair).toBeTruthy();expect(c.delta).toBeTruthy();expect(c.trade).toBeTruthy();expect(c.clear).toBe(true);}await page.screenshot({path:info.outputPath(`reward-${size.width}.png`)});}
});

test('Signature Fights lost-fight practice restores exact opening and never saves rewards',async({page},info)=>{
  await route(page);await battle(page);
  const opening=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {hand:b.hand.map((c:any)=>[c.id,c.upgraded,c.preenBranch]),draw:b.drawPile.map((c:any)=>[c.id,c.upgraded,c.preenBranch]),hp:b.flock.hp,energy:b.energy,enemies:b.enemies.map((e:any)=>[e.runtime.id,e.hp,e.intentIndex])};});
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.flock.hp=0;b.checkOutcome();b.renderAll();});
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.bossDossierModule&&b.mode==='defeat';});
  const disk=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()));
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').root.list.some((o:any)=>o.name==='run-outcome-command-hit'&&o.getData('label')==='Practice This Fight'));
  await settleCanvas(page);
  await page.screenshot({path:info.outputPath('defeat-buttons.png')});
  const point=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),hit=b.root.list.find((o:any)=>o.name==='run-outcome-command-hit'&&o.getData('label')==='Practice This Fight'),c=b.game.canvas.getBoundingClientRect();return {x:c.left+hit.x*c.width/1280,y:c.top+hit.y*c.height/720};});
  await page.mouse.click(point.x,point.y);await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').mode==='battle');await battleReady(page);
  const replay=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {hand:b.hand.map((c:any)=>[c.id,c.upgraded,c.preenBranch]),draw:b.drawPile.map((c:any)=>[c.id,c.upgraded,c.preenBranch]),hp:b.flock.hp,energy:b.energy,enemies:b.enemies.map((e:any)=>[e.runtime.id,e.hp,e.intentIndex])};});expect(replay).toEqual(opening);
  expect(await page.evaluate(()=>JSON.parse((window as any).render_game_to_text()).practice)).toBe(true);
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`rematch-${size.width}.png`)});}
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.enemies.forEach((e:any)=>e.hp=0);b.checkOutcome();b.renderAll();});
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').mode)).toBe('runComplete');
  expect(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()))).toBe(disk);
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').returnToMainMenu());
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.isActive('MenuScene'));
  expect(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()))).toBe(disk);
});

test('Signature Fights support glyphs are bounded and survive reduced-motion settings',async({page},info)=>{
  await route(page);await battle(page);
  for(const reduced of [false,true])for(const [beat,kind] of [[0,'shield'],[4,'recover']] as const){
    await page.evaluate(({beat,reduced})=>{localStorage.setItem('birdsquad.motionPreference',reduced?'reduced':'full');const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.enemies[1].intentIndex=beat;b.time.paused=true;b.events.emit('living-enemy-start',b.enemies[1].id,500);},{beat,reduced});
    const glyph=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),all=b.fxLayer.list.filter((o:any)=>o.name==='living-support-signature');return {count:all.length,kind:all[0]?.getData('kind')};});expect(glyph).toEqual({count:1,kind});
    if(reduced)expect(await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.tweens.getTweensOf(b.fxLayer.getByName('living-support-signature')).length;})).toBe(0);
    await page.screenshot({path:info.outputPath(`support-${kind}-${reduced}.png`)});
  }
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.time.paused=false;(window as any).advanceTime(1200);});
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').fxLayer.list.filter((o:any)=>o.name==='living-support-signature').length)).toBe(0);
});

test('Signature Fights route rewards show comparisons before any commitment',async({page},info)=>{
  await route(page);
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.openRouteRewardMenu({id:'signature-cache',type:'cache',label:'Signature Cache',payloadId:'signature-cache'}, {key:'choose',text:'Review the drawer.',effects:['addCard(chooseOneOfTwoUncommonOrRare)'],locked:false},structuredClone(r.runState));});
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').children.list.some((o:any)=>o.name==='route-reward-quick-read'));
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);const rows=await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return r.children.list.filter((o:any)=>o.name==='route-reward-quick-read').map((o:any)=>({text:o.getData('fullText'),right:o.getBounds().right,font:parseFloat(o.style.fontSize)*r.game.canvas.getBoundingClientRect().height/720}));});expect(rows).toHaveLength(6);expect(rows.every(r=>r.font>=14&&r.right<1280&&r.text)).toBe(true);await page.screenshot({path:info.outputPath(`route-comparison-${size.width}.png`)});}
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').routeRewardArmedCardId)).toBeFalsy();
});

test('Signature Fights capstone saves reject malformed choices and formation clones preserve canonical data',()=>{
  expect(normalizeFlyway({capstone:'unknown'}).capstone).toBeUndefined();expect(normalizeFlyway({capstone:'tempo'}).capstone).toBe('tempo');
  const canonical=JSON.parse(readFileSync('data/game/alpha-enemies.json','utf8')).normalEncounters.slice(0,2),before=JSON.stringify(canonical);
  const formation=signatureFormation('enc_signature_relay',canonical)!;formation[0].moves[0].effects.push('damage(flock, 99)');expect(JSON.stringify(canonical)).toBe(before);
});
