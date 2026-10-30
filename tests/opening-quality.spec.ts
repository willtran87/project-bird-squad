import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { encounterDecision } from '../src/game/combat-reading';
import { settleCanvas } from './helpers/settled-canvas';

const sizes=[{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}];
const encounters=[2,3].flatMap(n=>JSON.parse(readFileSync(`data/game/map0${n}-content.json`,'utf8')).encounters);
async function battle(page:Page, encounter?:string, guided=false){
  await page.goto('./?flight=opening-quality&length=full');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,r=g.scene.getScene('RouteScene');return g.scene.isActive('RouteScene')&&r.routeEssentialAssetsReady;});
  if(encounter){
    await page.evaluate(map=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.scene.restart({runState:{...r.runState,mapIndex:map}});},encounter.includes('relay')?2:1);
    await page.waitForFunction(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return r.runState.mapIndex>0&&r.routeEssentialAssetsReady;});
  }
  await page.evaluate(({data,guided})=>{
    const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene');
    if(r.shouldChooseDistrictContract())r.chooseDistrictContract(r.districtContractChoices()[0].id);
    if(guided)localStorage.setItem('birdsquad.firstFlightGuide',JSON.stringify({enabled:true,completed:false,routeCommits:1,cardsPlayed:0,roosts:0,rewardsResolved:0}));
    const n=w.__birdSquadCurrentMap().nodes.find((n:any)=>n.type==='street');if(data)Object.assign(n,{payloadId:data.id,type:data.nodeType,label:data.name});
    r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:n.id});
  },{data:encounters.find((e:any)=>e.id===encounter),guided});
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.livingPerformances?.ready&&b.combatPreviewModule&&!b.combatIntroActive&&!b.combatAnimationPending;});
}
async function advance(page:Page,ms:number){await page.evaluate(ms=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.time.paused=false;b.tweens.resumeAll();(window as any).advanceTime(ms);b.time.paused=true;b.tweens.pauseAll();},ms);}

for(const reduced of [false,true])test(`Opening quality actual attack and shelter identify one owned actor, target and result (reduced ${reduced})`,async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});await battle(page);
  for(const id of ['swords_ace','pentacles_fledgling']){
    await page.evaluate(id=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.queueCardArtLoad([b.allDeckCards().find((c:any)=>c.id===id)]);},id);
    await page.waitForFunction(id=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return !!b.battleHandCardView(b.allDeckCards().find((c:any)=>c.id===id)).preview.artKey;},id);
    const played=await page.evaluate(id=>{
      const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),card=b.allDeckCards().find((c:any)=>c.id===id);
      for(const zone of ['hand','drawPile','discardPile','clearedPile'])b[zone]=b[zone].filter((c:any)=>c.instanceId!==card.instanceId);
      b.hand.unshift(card);b.energy=20;b.enemies[0].hp=b.enemies[0].maxHp=1000;b.renderAll();
      b.time.paused=false;b.tweens.resumeAll();b.playCard(card,b.enemies[0].id,{resolveDelayMs:650});b.time.paused=true;b.tweens.pauseAll();
      return {name:card.name,bird:card.bird,instanceId:card.instanceId,target:id==='swords_ace'?b.enemies[0].name:'Your flock'};
    },id);
    await expect(page.locator('#identity-sequence')).toBeVisible();
    await expect(page.locator('#identity-sequence')).toContainText(`${played.name} → ${played.target}`);
    await expect(page.locator('#identity-sequence')).toHaveAttribute('aria-label',new RegExp(played.bird));
    await expect(page.locator('#identity-call')).toBeHidden();
    const start=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),a=b.fxLayer.getByName('combat-card-cast-ghost');return {x:a.x,y:a.y};});
    await advance(page,240);
    await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').combatReading?.actor?.phase)).toBe('commit');
    const action=await page.evaluate(()=>{
      const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),a=b.fxLayer.getByName('combat-card-cast-ghost'),p=b.root.getByName('combat-leader-art').getByName('combat-leader-pose');
      return {x:a.x,y:a.y,actor:b.combatReading.actor,leader:{x:p.x,y:p.y,angle:p.angle},count:b.fxLayer.list.filter((o:any)=>o.name==='combat-card-cast-ghost').length,canonical:!!a.getByName('flock-action-canonical-art')};
    });
    expect(action.actor.instanceId).toBe(played.instanceId);expect(action.canonical).toBe(true);expect(action.count).toBe(1);expect(Math.hypot(action.leader.x,action.leader.y,action.leader.angle)).toBe(0);
    if(reduced)expect({x:action.x,y:action.y}).toEqual(start);else expect(Math.hypot(action.x-start.x,action.y-start.y)).toBeGreaterThan(0);
    for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);expect(await page.locator('#identity-sequence').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`${id}-${size.width}.png`)});}
    await advance(page,440);
    await expect(page.locator('#identity-sequence')).toContainText(`Resolved: ${played.name}`);
    expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').fxLayer.getByName('combat-card-cast-ghost')?.active??false)).toBe(false);
    await advance(page,400);
    expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').combatAnimationPending)).toBe(false);
  }
  expect(errors).toEqual([]);
});

test('Opening quality combination detail names the actual flock pair once',async({page})=>{
  await battle(page);
  const result=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.energy=50;b.enemies[0].hp=b.enemies[0].maxHp=1000;
    const play=(id:string)=>{const c=b.allDeckCards().find((c:any)=>c.id===id);for(const z of ['hand','drawPile','discardPile','clearedPile'])b[z]=b[z].filter((v:any)=>v.instanceId!==c.instanceId);b.hand.unshift(c);b.playCard(c,b.enemies[0].id);return {name:c.name,detail:b.motionPayoff.detail};};
    const nest=play('pentacles_fledgling'),strike=play('swords_ace'),repeat=play('swords_ace');return {nest,strike,repeat};
  });
  expect(result.strike.detail).toContain(`${result.nest.name} → ${result.strike.name}`);expect(result.strike.detail).toContain('Brace & Cut');expect(result.repeat.detail).not.toContain('Brace & Cut');
});

test('Opening quality first guide teaches target and cost before contextual combinations',async({page},info)=>{
  await battle(page,undefined,true);
  const guide=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.battleHudGuidanceView().text;});
  expect(guide).toContain('Wingbeat');expect(guide).not.toContain('Flow');await expect(page.locator('#identity-sequence')).toBeHidden();
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`first-guide-${size.width}.png`)});}
  await page.evaluate(()=>{localStorage.setItem('birdsquad.firstFlightGuide',JSON.stringify({enabled:false,completed:true}));const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.flightCombat.previousSuit='nests';b.flightCombat.combos=[];const card=b.allDeckCards().find((c:any)=>c.id==='swords_ace');b.hand=[card];b.energy=0;b.renderAll();});
  await expect(page.locator('#identity-sequence')).not.toContainText('Brace & Cut');
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').energy=3);
  await expect(page.locator('#identity-sequence')).toContainText('Brace & Cut');
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').flyway.coachingOff=true);
  await expect(page.locator('#identity-sequence')).toBeHidden();
});

for(const id of ['enc_signature_ferry','enc_signature_relay','enc_signature_watch'])test(`Opening quality ${id} offers contextual tactical choices in the existing lane`,async({page},info)=>{
  await battle(page,id);await expect(page.locator('#identity-sequence')).toHaveAttribute('data-feedback','decision');
  const expected=id.includes('ferry')?'Survive 3':id.includes('relay')?'Stop the relay':'Break either perch';
  await expect(page.locator('#identity-sequence')).toContainText(expected);
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);expect(await page.locator('#identity-sequence').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`decision-${size.width}.png`)});}
});

test('Opening quality tactical choices respect elapsed beats and earned escape gaps',()=>{
  const e=[{hp:32,intentIndex:2},{hp:20,intentIndex:2}];
  expect(encounterDecision('enc_signature_ferry',e,new Map())).toContain('1 more beat');
  expect(encounterDecision('enc_signature_relay',e,new Map())).toContain('before Tell 3');
  e[1].intentIndex=3;expect(encounterDecision('enc_signature_relay',e,new Map())).toContain('Stored force');
  e.forEach(v=>v.intentIndex=3);e[0].hp=0;
  expect(encounterDecision('enc_signature_watch',e,new Map([['defender',4]]))).toContain('missed');
  expect(encounterDecision('enc_signature_watch',e,new Map([['defender',3]]))).toContain('Gap opened');
});
