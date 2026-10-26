import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolveScriptedBattle } from './helpers/scripted-battle';
import { settleCanvas } from './helpers/settled-canvas';

const content=JSON.parse(readFileSync('data/game/map04-content.json','utf8'));
const sizes=[{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}];
async function readyRoute(page:Page,map=3){
  await page.waitForFunction(map=>{const g=(window as any).__birdSquadGame,r=g.scene.getScene('RouteScene');return g.scene.isActive('RouteScene')&&r.runState.mapIndex===map&&r.routeEssentialAssetsReady&&r.openFlyway&&r.highRoost;},map);
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');if(r.shouldChooseDistrictContract())r.chooseDistrictContract(r.districtContractChoices()[0].id);});
}
async function route(page:Page){
  await page.goto('./?flight=roost-acceptance&length=full');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.keyboard.press('Enter');await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.scene.restart({runState:{...r.runState,mapIndex:3}});});await readyRoute(page);
}
async function reload(page:Page,map=3){
  await page.reload();await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').continueRun());await readyRoute(page,map);
}
async function battle(page:Page,id:string,ordinal=0){
  const encounter=content.encounters.find((e:any)=>e.id===id);if(!encounter)throw Error(id);
  // Explicit encounter fixture; combat/resource/reward resolution uses live rules.
  await page.evaluate(({encounter,ordinal})=>{const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene');const n=w.__birdSquadCurrentMap().nodes.filter((n:any)=>n.type==='street')[ordinal];Object.assign(n,{payloadId:encounter.id,type:encounter.nodeType,label:encounter.name});r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:n.id});},{encounter,ordinal});
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,b=g.scene.getScene('BattleScene');return g.scene.isActive('BattleScene')&&b.highRoost&&b.combatPreviewModule&&b.discardChoiceModule&&b.returnChoiceModule&&b.fxLayer?.active&&!b.combatIntroActive&&!b.combatAnimationPending;});
}
async function settleReward(page:Page){
  for(let i=0;i<5;i++){
    await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame;if(g.scene.isActive('RouteScene'))return true;const b=g.scene.getScene('BattleScene');return b.rewardPresentationReady()&&(b.mode==='cardReward'&&b.rewardChoices.length>0||b.mode==='upgradeReward'&&b.upgradeChoices.length>0||b.mode==='waymarkReward'&&b.waymarkChoices.length>0);});
    if(await page.evaluate(()=>(window as any).__birdSquadGame.scene.isActive('RouteScene')))break;
    await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');if(b.mode==='cardReward')b.skipCardReward();else if(b.mode==='upgradeReward')b.chooseUpgradeCard(b.upgradeChoices[0].id);else if(b.mode==='waymarkReward')b.chooseWaymarkReward(b.waymarkChoices[0].id);});
  }
  await readyRoute(page);
}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const e:string[]=[];errors.set(page,e);page.on('pageerror',error=>e.push(error.message));});
test.afterEach(async({page})=>{try{expect(errors.get(page)).toEqual([]);}finally{await page.goto('about:blank');}});

for(const suffix of ['perch_gang','perch_thug','tar_drifter','wind_shrike','spire_sentinel','relay_falcon'])test(`High Roost ${suffix} offers its tactical purpose and resolves`,async({page},info)=>{
  await route(page);await battle(page,`enc_roost_${suffix}`);
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.introPlayed=false;b.playBattleIntro();b.time.timeScale=0;b.tweens.timeScale=0;b.fxLayer.list.forEach((o:any)=>{if(o.list?.some((x:any)=>x.name==='opening-encounter-purpose'))o.alpha=1;});});
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);const fit=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),all=b.fxLayer.list.flatMap((o:any)=>o.list??[]),p=all.find((o:any)=>o.name==='opening-encounter-purpose'),d=all.find((o:any)=>o.name==='combat-intro-dismiss-label');return {text:p.text,clear:p.getBounds().bottom<d.getBounds().top};});expect(fit.text).toBe(content.encounters.find((e:any)=>e.id===`enc_roost_${suffix}`).lesson);expect(fit.clear).toBe(true);await page.screenshot({path:info.outputPath(`crossing-${size.width}.png`)});}
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.combatIntroFinish?.(true);b.time.timeScale=1;b.tweens.timeScale=1;});
  const result=await page.evaluate(resolveScriptedBattle,'balanced');await info.attach('mechanical-outcome',{body:JSON.stringify(result),contentType:'application/json'});expect(result.mode).not.toBe('battle');expect(result.decisions.length).toBeGreaterThan(1);
});

test('High Roost perches change live support and preserve forecast and phase parity',async({page},info)=>{
  await route(page);await battle(page,'enc_roost_warden');
  const results=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),initial=structuredClone(b.enemies),flock=structuredClone(b.flock);
    const cases=[];
    for(const remove of ['none','shield','signal','both']){
      b.enemies=structuredClone(initial);b.flock={...flock,hp:100,maxHp:100,block:0,exposed:false};b.statBlocked=0;
      const [boss,shield,signal]=b.enemies;if(remove==='shield'||remove==='both')shield.hp=0;if(remove==='signal'||remove==='both')signal.hp=0;
      const forecast=b.enemyDamageProjection(b.enemies,b.flock,false);b.resolveEnemyTurn();
      cases.push({remove,cover:boss.block,force:boss.nextAttackBonus,hp:b.flock.hp,expected:forecast.afterHp});
    }
    b.enemies=structuredClone(initial);b.flock={...flock,hp:100,maxHp:100,block:40};const boss=b.enemies[0];
    boss.nextAttackBonus=9;boss.block=0;b.damageEnemy(boss.id,Math.ceil(boss.maxHp/2),'phase boundary');
    const phase={phase:boss.phase,force:boss.nextAttackBonus,cover:boss.block};
    b.enemies.slice(1).forEach((e:any)=>e.hp=0);boss.intentIndex=1;boss.weak=1;b.damageEnemy(boss.id,1,'disruption');b.updateFlywayBossBreaks();
    const disrupted=b.getTextState().enemies.find((e:any)=>e.id===boss.id).intent;b.renderAll();b.events.emit('roost-backdrop');
    return {cases,phase,disrupted,protected:b.root.depth>b.fxLayer.depth,poses:[...b.enemyPoseGroups.values()].map((v:any)=>v.group.getData('roost-pose'))};
  });
  await info.attach('perch-parity',{body:JSON.stringify(results),contentType:'application/json'});
  expect(results.cases.map(c=>[c.cover,c.force])).toEqual([[12,3],[4,3],[12,0],[4,0]]);
  for(const c of results.cases)expect(c.hp).toBe(c.expected);
  expect(results.phase).toEqual({phase:2,force:0,cover:0});expect(results.disrupted).toContain('Disrupted');expect(results.protected).toBe(true);expect(results.poses).toContain('stagger');
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`warden-${size.width}.png`)});}
});

test('High Roost resident consequences save once, survive reload and roll back failed claims',async({page},info)=>{
  await route(page);await page.keyboard.press('j');
  await expect(page.getByRole('button',{name:/Rest at Sella/})).toBeDisabled();await expect(page.getByRole('button',{name:/Collect Oren/})).toBeDisabled();await expect(page.getByRole('button',{name:/Listen to Ivo/})).toBeDisabled();await page.keyboard.press('Escape');
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene'),s=r.runState.flyway;s.residents.sella=1;s.visits=['sella:0'];s.canalFerry={pledge:'timber',startedAt:0,rewarded:true};s.spireRelay={pledge:'lenses',startedAt:0,rewarded:true};r.runState.currentHp=r.runMaxHp()-10;});await page.keyboard.press('j');
  const before=await page.evaluate(()=>structuredClone((window as any).__birdSquadGame.scene.getScene('RouteScene').runState));
  await page.evaluate(()=>{(window as any).originalWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('birdsquad.run.active'))throw new DOMException('Full','QuotaExceededError');(window as any).originalWrite.call(this,key,value);};});
  await page.getByRole('button',{name:/Rest at Sella/}).click();await expect(page.getByRole('status')).toContainText('Could not save');
  expect(await page.evaluate(()=>structuredClone((window as any).__birdSquadGame.scene.getScene('RouteScene').runState))).toEqual(before);
  await page.evaluate(()=>{Storage.prototype.setItem=(window as any).originalWrite;});
  for(const name of [/Rest at Sella/,/Collect Oren/,/Listen to Ivo/])await page.getByRole('button',{name}).click();
  await expect(page.locator('[data-high-roost]')).toContainText('Final Signal');
  for(const size of sizes){await page.setViewportSize(size);expect(await page.locator('#flyway-book').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`residents-${size.width}.png`)});}
  await page.keyboard.press('Escape');await reload(page);
  const saved=await page.evaluate(()=>structuredClone((window as any).__birdSquadGame.scene.getScene('RouteScene').runState));
  expect(saved.currentHp).toBe(before.currentHp+8);expect(saved.nextCombat.openSkyGuard).toBe((before.nextCombat?.openSkyGuard??0)+3);expect(saved.flyway.cityAid.sort()).toEqual(['ivo','oren','sella']);
  await page.keyboard.press('j');for(const name of [/Rest at Sella/,/Collect Oren/,/Listen to Ivo/])await expect(page.getByRole('button',{name})).toHaveCount(0);await page.keyboard.press('Escape');
  await battle(page,'enc_roost_warden');expect(await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.flock.openSkyGuard-b.getTextState().flockStats.find((s:any)=>s.label==='Open Sky Guard').flock;})).toBe(saved.nextCombat.openSkyGuard);
});

for(const restored of [false,true])test(`High Roost ending reflects ${restored?'completed':'unfinished'} choices and can be skipped`,async({page},info)=>{
  await route(page);await page.evaluate(restored=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene'),s=r.runState.flyway;s.restored=[0,1,2,3];if(restored){s.residents.sella=1;s.visits=['sella:0'];s.canalFerry={pledge:'lamps',startedAt:0,rewarded:true};s.spireRelay={pledge:'wires',startedAt:0,rewarded:true};s.cityAid=['ivo'];}r.openFlyway('journal');},restored);
  const ending=page.locator('[data-city-ending]');await expect(ending).toContainText(restored?'became blankets':'still needs neighbors');
  await ending.getByRole('button',{name:'Continue the morning'}).click();await expect(ending).toContainText(restored?'lamps guide':'ferry remains');
  await ending.getByRole('button',{name:'Continue the morning'}).click();await expect(ending).toContainText(restored?'rewired line':'far mast is quiet');
  for(const size of sizes){await page.setViewportSize(size);await page.screenshot({path:info.outputPath(`ending-${size.width}.png`)});}
  await ending.getByRole('button',{name:'Skip to the finishing flock'}).click();await expect(ending).toContainText(restored?'Ten Familiar Wings':'help Sella');await expect(page.getByRole('heading',{name:'The birds who carried the signal'})).toBeVisible();
  await ending.getByRole('button',{name:'Replay the city’s morning'}).click();await expect(ending).toContainText('1/3');
});

test('High Roost reduced-motion scenery stays bounded and purpose is available before commitment',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await route(page);
  const purpose=await page.evaluate(()=>{const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene'),node=w.__birdSquadCurrentMap().nodes.find((n:any)=>n.id===r.selectedNodeId);return r.nodeDetail(node).lesson;});
  expect(purpose).toBeTruthy();await page.keyboard.press('j');await expect(page.locator('[data-high-roost]')).toContainText(purpose);await page.keyboard.press('Escape');
  await battle(page,'enc_roost_warden');
  const result=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.flyway.settledNodes=['3:a','3:b','3:c','3:d','3:e'];for(let i=0;i<50;i++)b.events.emit('roost-backdrop');const root=b.backdropLayer.getByName('roost-morning');return {count:b.backdropLayer.list.filter((o:any)=>o.name==='roost-morning').length,children:root.list.length,tweens:root.list.reduce((n:number,o:any)=>n+b.tweens.getTweensOf(o).length,0),dawn:b.highRoost.dawn,protected:b.fxLayer.depth<b.root.depth};});
  expect(result).toMatchObject({count:1,children:6,tweens:0,protected:true});expect(result.dawn).toBeGreaterThan(.8);
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`morning-${size.width}.png`)});}
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').scene.stop());
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').events.listenerCount('roost-backdrop'))).toBe(0);
});

