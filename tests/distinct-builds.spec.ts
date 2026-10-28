import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildPreens } from '../src/game/flyway-rules';
import { settleCanvas } from './helpers/settled-canvas';
import { resolveScriptedBattle } from './helpers/scripted-battle';
const sizes=[{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}];
const encounters=[2,3].flatMap(n=>JSON.parse(readFileSync(`data/game/map0${n}-content.json`,'utf8')).encounters);
const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const e:string[]=[];errors.set(page,e);page.on('pageerror',error=>e.push(error.message));});
test.afterEach(async({page})=>{try{expect(errors.get(page)).toEqual([]);}finally{await page.goto('about:blank');}});
async function ready(page:Page,map=1){
  await page.waitForFunction(map=>{const g=(window as any).__birdSquadGame,r=g.scene.getScene('RouteScene');return g.scene.isActive('RouteScene')&&r.runState.mapIndex===map&&r.routeEssentialAssetsReady&&r.openFlyway;},map);
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');if(r.shouldChooseDistrictContract())r.chooseDistrictContract(r.districtContractChoices()[0].id);});
}
async function route(page:Page,map=1){
  await page.goto('./?flight=living-builds-acceptance&length=full');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.keyboard.press('Enter');await ready(page,0);
  await page.evaluate(map=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.scene.restart({runState:{...r.runState,mapIndex:map}});},map);await ready(page,map);
}
async function battle(page:Page,id='enc_canal_open_perch',rival=false){
  const encounter=encounters.find((e:any)=>e.id===id);
  await page.evaluate(({encounter,rival})=>{const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene'),n=w.__birdSquadCurrentMap().nodes.find((n:any)=>n.type==='street');Object.assign(n,{payloadId:encounter.id,type:rival?'rival':encounter.nodeType,label:encounter.name});r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:n.id});},{encounter,rival});
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,b=g.scene.getScene('BattleScene');return g.scene.isActive('BattleScene')&&b.livingPerformances?.ready&&b.combatPreviewModule&&b.discardChoiceModule&&b.returnChoiceModule&&!b.combatIntroActive&&!b.combatAnimationPending;});
}
for(const branch of buildPreens)for(const molt of [false,true])test(`Distinct Builds ${branch.name} saves and executes ${molt?'Molt':'normal'} rules`,async({page},info)=>{
  await route(page);
  await page.evaluate(card=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.cardPickerMode='preen';r.cardPickerContext='districtPreen';r.cardPickerRemainingPicks=1;const i=r.runState.deck.findIndex((c:any)=>c.id===card);r.requestCardPick(i);r.requestCardPick(i);},branch.card);
  await expect(page.getByRole('button',{name:`Choose ${branch.name}`,exact:true})).toBeVisible();
  if(!molt)for(const size of sizes){await page.setViewportSize(size);await page.getByRole('button',{name:`Choose ${branch.name}`,exact:true}).scrollIntoViewIfNeeded();expect(await page.locator('#flyway-book').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`preen-${size.width}.png`)});}
  await page.getByRole('button',{name:`Choose ${branch.name}`,exact:true}).click();
  await page.reload();await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').continueRun());await ready(page);
  await page.keyboard.press('j');await page.getByRole('button',{name:'Flock & combinations',exact:true}).click();
  await expect(page.locator('#flyway-book')).toContainText(`${branch.name} Preen`);
  await expect(page.locator('#flyway-book')).not.toContainText(`${branch.id} Preen`);
  await page.keyboard.press('Escape');await battle(page);
  const result=await page.evaluate(({id,molt})=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),c=b.allDeckCards().find((c:any)=>c.id===id);
    b.flock.molt=molt;b.energy=20;b.spark=2;b.flock.hp=b.flock.maxHp;b.flock.block=0;
    for(const zone of ['hand','drawPile','discardPile','clearedPile'])b[zone]=b[zone].filter((x:any)=>x.instanceId!==c.instanceId);b.hand.push(c);
    const forecast=b.simulateCardOutcome(c,b.enemies[0].id),effects=b.activeCardContract(c).effects;
    b.playCard(c,b.enemies[0].id,{resolveDelayMs:0});
    return {effects,branch:c.preenBranch,energy:b.energy,expectedEnergy:forecast.flockAfter.energy,cover:b.flock.block,expectedCover:forecast.flockAfter.block,hp:b.enemies.map((e:any)=>e.hp),expectedHp:forecast.enemyStates.map((e:any)=>e.hpAfter),played:b.cardsPlayedThisTurn};
  },{id:branch.card,molt});
  expect(result.branch).toBe(branch.id);expect(result.effects).toEqual(molt?branch.moltEffects:branch.effects);expect(result.energy).toBe(result.expectedEnergy);expect(result.cover).toBe(result.expectedCover);expect(result.hp).toEqual(result.expectedHp);expect(result.played).toBe(1);
  await info.attach('live-preen-parity',{body:JSON.stringify(result),contentType:'application/json'});
});

for(const id of ['enc_canal_open_perch','enc_canal_alternating_watch','enc_spire_quiet_beat'])test(`Distinct Builds ${id} discloses purpose and forecasts all beats`,async({page},info)=>{
  await route(page,id.includes('spire')?2:1);await battle(page,id);
  const parity=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),initial=structuredClone(b.enemies),flock=structuredClone(b.flock),cases=[];
    for(const removed of [false,true])for(let beat=0;beat<3;beat++){
      b.enemies=structuredClone(initial);b.enemies.forEach((e:any)=>{e.intentIndex=beat;e.block=0;e.nextAttackBonus=beat===1?3:0;});if(removed&&b.enemies[1])b.enemies[1].hp=0;
      b.flock={...flock,hp:200,maxHp:200,block:5,exposed:false};b.statBlocked=0;
      const f=b.enemyDamageProjection(b.enemies,b.flock,false);b.resolveEnemyTurn();cases.push({beat,removed,hp:b.flock.hp,expected:f.afterHp,force:b.enemies[0].nextAttackBonus});
    }
    b.enemies=initial;b.flock=flock;b.mode='battle';b.renderAll();return cases;
  });
  for(const c of parity)expect(c.hp).toBe(c.expected);
  if(id==='enc_canal_open_perch'){expect(parity[0].force).toBe(3);expect(parity[3].force).toBe(0);}
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.introPlayed=false;b.playBattleIntro();b.time.timeScale=0;b.tweens.timeScale=0;b.fxLayer.list.forEach((o:any)=>{if(o.list?.some((x:any)=>x.name==='opening-encounter-purpose'))o.alpha=1;});});
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);const fit=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),all=b.fxLayer.list.flatMap((o:any)=>o.list??[]),p=all.find((o:any)=>o.name==='opening-encounter-purpose'),d=all.find((o:any)=>o.name==='combat-intro-dismiss-label');return {text:p.text,clear:p.getBounds().bottom<d.getBounds().top};});expect(fit.text).toBe(encounters.find((e:any)=>e.id===id).lesson);expect(fit.clear).toBe(true);await page.screenshot({path:info.outputPath(`formation-${size.width}.png`)});}
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.combatIntroFinish?.(true);b.time.timeScale=1;b.tweens.timeScale=1;});
  const outcome=await page.evaluate(resolveScriptedBattle,'balanced');expect(outcome.mode).not.toBe('battle');expect(outcome.decisions.length).toBeGreaterThan(1);
  await info.attach('formation-outcome',{body:JSON.stringify({parity,outcome}),contentType:'application/json'});
});

test('Distinct Builds strategy recipes remain available after Rooftops with honest weaknesses',async({page},info)=>{
  await route(page);await page.keyboard.press('j');
  await expect(page.locator('.rooftop-plans')).toContainText('Patient Answer');await expect(page.locator('.rooftop-plans')).toContainText('Weakness:');
  await expect(page.locator('.rooftop-plans')).toContainText('(not owned)');
  for(const size of sizes){await page.setViewportSize(size);await page.locator('.rooftop-plans').scrollIntoViewIfNeeded();expect(await page.locator('#flyway-book').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`recipes-${size.width}.png`)});}
});

test('Distinct Builds candidate reading keeps observed and potential separate',async({page},info)=>{
  await route(page);await battle(page);
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),c=b.allDeckCards().find((c:any)=>c.id==='major_00');for(const zone of ['hand','drawPile','discardPile','clearedPile'])b[zone]=b[zone].filter((x:any)=>x.instanceId!==c.instanceId);b.hand.push(c);b.energy=20;b.enemies.forEach((e:any)=>{e.hp=1;e.block=0;});b.enemies.slice(1).forEach((e:any)=>e.hp=0);b.playCard(c);});
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.mode==='cardReward'&&b.rewardPresentationReady();});
  const read=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.openRewardCardInspection(b.rewardChoices[0].id);b.renderAll();const p=b.cardPreview,pages=[];for(let i=0;i<p.getData('reading').total;i++){pages.push({...p.getData('reading')});p.getData('turnRulesPage')(1);}return {pages,mode:b.mode,deck:b.allDeckCards().length};});
  expect(read.pages.some(p=>p.title==='FITS THIS FLOCK · POTENTIAL'&&p.text.includes('Potential only'))).toBe(true);
  expect(read.pages.some(p=>p.title==='THIS BIRD · OBSERVED')).toBe(true);expect(read.mode).toBe('cardReward');
  for(const size of sizes){
    await page.setViewportSize(size);await settleCanvas(page);
    for(const title of ['FITS THIS FLOCK · POTENTIAL','THIS BIRD · OBSERVED']){
      const shown=await page.evaluate(title=>{const p=(window as any).__birdSquadGame.scene.getScene('BattleScene').cardPreview;for(let i=0;i<p.getData('reading').total;i++)p.getData('turnRulesPage')(-1);for(let i=0;i<p.getData('reading').total&&p.getData('reading').title!==title;i++)p.getData('turnRulesPage')(1);return p.getData('reading').title;},title);
      expect(shown).toBe(title);
      await page.screenshot({path:info.outputPath(`candidate-${title.includes('POTENTIAL')?'potential':'observed'}-${size.width}.png`)});
    }
  }
  await info.attach('candidate-reading',{body:JSON.stringify(read),contentType:'application/json'});
});

test('Distinct Builds six birds use bounded distinct poses, impact timing and still alternatives',async({page},info)=>{
  await route(page);await battle(page,'enc_canal_open_perch',true);
  for(const leader of ['fledgling','spark_caller','talon','tidewarden','roostkeeper']){
    await page.evaluate(leader=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.time.paused=true;b.runLeaderId=leader;b.events.emit('living-cast',900);},leader);
    await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').livingPerformances.active[0]?.pose)).toBe('anticipation');
    await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.time.paused=false;(window as any).advanceTime(400);b.time.paused=true;});
    await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').livingPerformances.active[0]?.pose)).toBe('wingbeat');
    for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`${leader}-${size.width}.png`)});}
    await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.events.emit('flyway-card',b.hand[0],b.enemies[0].id);});
    await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').livingPerformances.active[0]?.pose)).toBe('contact');
    await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.time.paused=false;(window as any).advanceTime(180);b.time.paused=true;});
    await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').livingPerformances.active[0]?.pose)).toBe('recovery');
    await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.queueFlockMotion('hit');});
    await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').livingPerformances.active[0]?.pose)).toBe('recoil');
    await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.time.paused=false;(window as any).advanceTime(800);b.time.paused=true;});
    await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').livingPerformances.active.length)).toBe(0);
  }
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.events.emit('living-enemy-start',b.enemies[0].id,800);b.time.paused=false;(window as any).advanceTime(350);b.time.paused=true;});
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').livingPerformances.active[0])).toEqual({bird:'caldra',pose:'wingbeat'});
  await page.screenshot({path:info.outputPath('caldra-wingbeat.png')});
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.time.paused=false;(window as any).advanceTime(1600);b.time.paused=true;localStorage.setItem('birdsquad.motionPreference','reduced');b.events.emit('living-cast',900);});
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').livingPerformances.active.find((a:any)=>a.bird==='roostkeeper')?.pose)).toBe('contact');
  const still=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),a=b.fxLayer.getByName('living-bird-leader');return b.tweens.getTweensOf(a).length;});expect(still).toBe(0);
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.scene.stop();});await expect(page.locator('#identity-sequence')).toHaveCount(0);
});

test('Distinct Builds flight highlights use actual combinations and survive the journal archive',async({page},info)=>{
  await route(page);await battle(page);
  const evidence=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),cards=b.allDeckCards(),nest=cards.find((c:any)=>c.runtime.suit==='nests'),quill=cards.find((c:any)=>c.id==='swords_ace');
    for(const zone of ['hand','drawPile','discardPile','clearedPile'])b[zone]=b[zone].filter((c:any)=>c.instanceId!==nest.instanceId&&c.instanceId!==quill.instanceId);
    b.hand.push(nest,quill);b.energy=20;b.enemies[0].hp=b.enemies[0].maxHp=1000;b.playCard(nest);b.playCard(quill);
    b.flyway.cityAid=['oren'];b.flyway.canalFerry={pledge:'timber',startedAt:0,rewarded:true};b.flock.hp=0;b.checkOutcome();b.renderAll();
    return {moment:b.flyway.comboMoment,card:b.flyway.cardMoment,summary:(window as any).__birdSquadLastRun.flyway,archive:JSON.parse((window as any).__birdSquadExportRuns()).at(-1).flyway};
  });
  expect(evidence.moment.id).toBe('brace-cut');expect(evidence.moment.damage).toBeGreaterThan(0);expect(evidence.card.plays).toBeGreaterThan(0);expect(evidence.summary.comboMoment).toEqual(evidence.moment);
  expect(evidence.archive).toEqual(evidence.summary);
  await expect(page.locator('#flyway-launch')).toBeVisible();await page.keyboard.press('j');await page.getByRole('button',{name:'Flight journal',exact:true}).click();
  await expect(page.locator('#flyway-book')).toContainText('most-played recorded bird');await expect(page.locator('#flyway-book')).toContainText('claimed its Guard');
  await page.screenshot({path:info.outputPath('flight-highlights.png')});
  await page.reload();await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);await expect(page.locator('#flyway-launch')).toBeVisible();await page.keyboard.press('j');await page.getByRole('button',{name:'Flight journal',exact:true}).click();
  await expect(page.locator('#flyway-book')).toContainText('most-played recorded bird');await expect(page.locator('#flyway-book')).toContainText('Brace & Cut');
  await info.attach('flight-moments',{body:JSON.stringify(evidence),contentType:'application/json'});
});

test('Distinct Builds performances follow real card and rival impacts and distinct Leader calls',async({page},info)=>{
  await route(page);await battle(page,'enc_canal_open_perch',true);
  const first=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),card=b.hand[0];
    b.enemies.forEach((e:any)=>{e.hp=e.maxHp=1000;});b.energy=20;
    b.playCard(card,b.enemies[0].id,{resolveDelayMs:600});b.time.paused=true;
    return {id:card.id,damage:b.enemies[0].hp};
  });
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').livingPerformances.active[0]?.pose)).toBe('anticipation');
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').enemies[0].hp)).toBe(first.damage);
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').time.paused=false);
  await page.waitForFunction(()=>!(window as any).__birdSquadGame.scene.getScene('BattleScene').combatAnimationPending);
  const calls=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),results=[];
    for(const [leader,cue] of [['fledgling','flockSparrow'],['spark_caller','flockChorus'],['talon','flockShrike'],['tidewarden','flockHeron'],['roostkeeper','flockFinch']]){
      b.runLeaderId=leader;b.flightCombat.charge=99;b.flightCombat.called=false;
      const before=(window as any).__birdSquadAudio().cueRequests[cue]??0;
      const used=b.activateFlywayCall();results.push({leader,used,count:((window as any).__birdSquadAudio().cueRequests[cue]??0)-before});
    }
    b.runLeaderId='fledgling';b.flock.hp=b.flock.maxHp=200;b.flock.block=100;
    b.performanceEvents=[];
    b.events.on('living-enemy-start',(id:string)=>b.performanceEvents.push({id,phase:'start'}));
    b.events.on('living-enemy-impact',(id:string)=>b.performanceEvents.push({id,phase:'impact'}));
    b.endTurn({enemyPacing:true});return results;
  });
  expect(calls.every(c=>c.used&&c.count===1)).toBe(true);
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.performanceEvents.some((e:any)=>e.id.startsWith('tarline_jackdaw')&&e.phase==='impact')&&!b.combatAnimationPending;});
  const result=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {events:b.performanceEvents,cues:(window as any).__birdSquadAudio().cueRequests,contributions:b.cardContributions,actors:b.livingPerformances.active};});
  expect(result.cues.flockJackdaw).toBeGreaterThan(0);expect(result.contributions.find((r:any)=>r.cardId===first.id).plays).toBe(1);
  await info.attach('real-performance-events',{body:JSON.stringify({calls,result}),contentType:'application/json'});
});
