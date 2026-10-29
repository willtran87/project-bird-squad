import { test, expect, type Page } from '@playwright/test';
import { signatureVictory } from '../src/game/signature-fights';
import { primaryBenefit, decisionBrief } from '../src/game/decision-brief';
import { readFileSync } from 'node:fs';
const cards = JSON.parse(readFileSync('data/game/alpha-cards.json','utf8'));
import { settleCanvas } from './helpers/settled-canvas';
const sizes=[{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}];
const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const list:string[]=[];errors.set(page,list);page.on('pageerror',error=>list.push(error.message));});
test.afterEach(async({page})=>{try{expect(errors.get(page)).toEqual([]);}finally{await page.goto('about:blank');}});
async function route(page:Page) {
  await page.goto('./?flight=meaningful-release&length=full');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,r=g.scene.getScene('RouteScene');return g.scene.isActive('RouteScene')&&r.routeEssentialAssetsReady&&r.openFlyway;});
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');if(r.shouldChooseDistrictContract())r.chooseDistrictContract(r.districtContractChoices()[0].id);});
}
async function battleReady(page:Page) {
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,b=g.scene.getScene('BattleScene');return g.scene.isActive('BattleScene')&&b.livingPerformances?.ready&&b.combatPreviewModule&&!b.combatIntroActive&&!b.combatAnimationPending;});
}
async function battle(page:Page) {
  await route(page);
  await page.evaluate(()=>{const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene'),n=w.__birdSquadCurrentMap().nodes.find((n:any)=>n.type==='street');r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:n.id});});
  await battleReady(page);
}
async function workshop(page:Page) {
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return !b.combatAnimationPending&&!b.combatIntroActive&&!b.outcomeDetailsOpen;});
  await page.locator('#flyway-launch').click();
  await page.getByRole('button',{name:'Practice & feedback',exact:true}).click();
  await expect(page.locator('[data-feedback-markers]')).toBeVisible();
}
test('Meaningful Victories objective boundaries reject late interceptions and simultaneous defeat',()=>{
  const flock=[{hp:10,intentIndex:2},{hp:10,intentIndex:2}];
  expect(signatureVictory('enc_signature_ferry',flock,1)).toBeUndefined();
  flock.forEach(e=>e.intentIndex=3);
  expect(signatureVictory('enc_signature_ferry',flock,1)?.reason).toContain('safely');
  expect(signatureVictory('enc_signature_ferry',flock,0)).toBeUndefined();
  flock[1].hp=0; flock[1].intentIndex=2;
  expect(signatureVictory('enc_signature_relay',flock,1)?.reason).toContain('intercepted');
  flock[1].intentIndex=3;
  expect(signatureVictory('enc_signature_relay',flock,1)).toBeUndefined();
  expect(signatureVictory('enc_signature_watch',flock,1,new Map([['crow',3]]))?.reason).toContain('escapes');
  expect(signatureVictory('enc_signature_watch',flock,1,new Map([['crow',4]]))).toBeUndefined();
  flock[0].hp=0;expect(signatureVictory('enc_signature_ferry',flock,1)?.bonus).toBe(8);
});

test('Meaningful Victories reward benefits are complete and do not invent pairings',()=>{
  for(const runtime of cards.cards)for(const upgraded of [false,true]) {
    const card={id:runtime.id,name:runtime.displayName,runtime:runtime as any,upgraded};
    expect(primaryBenefit(card)).not.toMatch(/\.\.\.|…/);
    expect(primaryBenefit(card)).toMatch(/[.]$/);
    expect(decisionBrief(card,[]).pairing).toBe('Read for full rules and Molt ability.');
  }
});

test('Meaningful Victories ferry ends on survival and grants rewards once',async({page})=>{
  await battle(page);
  expect(await page.evaluate(()=>{const random=(window as any).__birdSquadGame.scene.getScene('BattleScene').combatRandom,checkpoint=random.snapshot(),first=Array.from({length:20},random);random.restore(checkpoint);const second=Array.from({length:20},random);random.restore(checkpoint);return JSON.stringify(first)===JSON.stringify(second);})).toBe(true);
  const result=await page.evaluate(()=>{const w=window as any,b=w.__birdSquadGame.scene.getScene('BattleScene');w.__birdSquadCurrentMap().nodes.find((n:any)=>n.id===b.battleStartingData.routeNodeId).payloadId='enc_signature_ferry';b.enemies.forEach((e:any)=>e.intentIndex=3);b.checkOutcome();const scrap=b.scrap;b.checkOutcome();return {mode:b.mode,alive:b.enemies.some((e:any)=>e.hp>0),scrap,same:b.scrap===scrap};});
  expect(result.alive).toBe(true);expect(result.mode).not.toBe('battle');expect(result.same).toBe(true);
});

test('Meaningful Victories every reward primary clause fits without ellipsis',async({page},info)=>{
  await battle(page);
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.enemies.forEach((e:any)=>e.hp=0);b.checkOutcome();b.renderAll();});
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.rewardPresentationReady()&&b.root.getByName('reward-card-effect');});
  const benefits=cards.cards.flatMap((runtime:any)=>[false,true].map(upgraded=>({id:runtime.id,upgraded,text:primaryBenefit({id:runtime.id,name:runtime.displayName,runtime,upgraded})})));
  const overflow=await page.evaluate(benefits=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),source=b.root.getByName('reward-card-effect'),issues:any[]=[];
    for(const benefit of benefits){const text=b.add.text(0,0,benefit.text,{fontFamily:source.style.fontFamily,fontSize:21,wordWrap:{width:232,useAdvancedWrap:true},lineSpacing:2});if(text.getWrappedText().length>2)issues.push(benefit);text.destroy();}return issues;
  },benefits);expect(overflow).toEqual([]);
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`reward-${size.width}.png`)});}
});

test('Meaningful Victories final-turn retry restores state and never writes real progression',async({page},info)=>{
  await battle(page);
  const original=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.flock.hp=1;b.turnCheckpoint.values.flock.hp=1;const start=structuredClone(b.turnCheckpoint);b.endTurn();return start;});
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').mode==='defeat');
  await workshop(page);await expect(page.getByRole('button',{name:'Retry this turn',exact:true})).toBeVisible();
  const disk=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()));
  await page.getByRole('button',{name:'Retry this turn',exact:true}).click();await battleReady(page);
  const replay=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {values:b.turnCheckpoint.values,random:b.combatRandom.snapshot(),practice:b.practiceTurn};});
  expect(replay.values).toEqual(original.values);expect(replay.random).toBe(original.random);expect(replay.practice).toBe(true);
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.endTurn();});
  await workshop(page);await expect(page.locator('#flyway-book table')).not.toContainText('Awaiting');
  for(const size of sizes){await page.setViewportSize(size);await page.getByRole('button',{name:'Retry this turn',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`retry-${size.width}.png`)});}
  expect(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()))).toBe(disk);
});

test('Meaningful Victories earned gift offers a reversible real combat demo',async({page},info)=>{
  await route(page);
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.runState.flyway.restored=[0,1];r.runState.flyway.canalGiftPending=true;});
  await expect(page.getByRole('heading',{name:'The Canal carries your flock forward'})).toBeVisible();
  for(const size of sizes){await page.setViewportSize(size);await page.getByRole('button',{name:'Try Storm Anchor',exact:true}).scrollIntoViewIfNeeded();expect(await page.locator('#flyway-book').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`gift-${size.width}.png`)});}
  const disk=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()));
  await page.getByRole('button',{name:'Try Storm Anchor',exact:true}).click();await battleReady(page);
  expect(await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {capstone:b.flyway.capstone,cards:b.allDeckCards().map((c:any)=>c.id).sort()};})).toEqual({capstone:'molt',cards:['swords_ace','wands_ace','cups_ace','pentacles_ace','aviary_25'].sort()});
  await page.keyboard.press('j');
  await page.getByRole('button',{name:'Practice & feedback',exact:true}).click();
  await page.getByRole('button',{name:'Return to the Canal gift',exact:true}).click();
  await expect(page.getByRole('heading',{name:'The Canal carries your flock forward'})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.flyway.capstone)).toBeUndefined();
  expect(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()))).toBe(disk);
  await page.getByRole('button',{name:'Try Answerkeeper Knot',exact:true}).click();await battleReady(page);
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').returnToMainMenu());
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.isActive('MenuScene'));
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.isSleeping('RouteScene'))).toBe(false);
  expect(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()))).toBe(disk);
});

test('Meaningful Victories supporting flock stays bounded and uses still poses',async({page},info)=>{
  await battle(page);
  for(const reduced of [false,true]) {
    await page.evaluate(reduced=>{localStorage.setItem('birdsquad.motionPreference',reduced?'reduced':'full');const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.events.emit('living-cast',500,'swoop',b.enemies[0].id);},reduced);
    await page.waitForTimeout(150);
    const actors=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.children.list.filter((o:any)=>o.name.startsWith('supporting-flock')).map((o:any)=>({x:o.x,visible:o.visible,pose:o.getData('pose')}));});
    expect(actors).toHaveLength(2);expect(actors.every(a=>a.visible)).toBe(true);if(reduced)expect(actors[0].x).toBe(440);
    await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.events.emit('flyway-combination',{id:'brace-cut',name:'Brace & Cut'});b.events.emit('flyway-card',b.hand[0],b.enemies[0].id);});
    for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`flock-${reduced}-${size.width}.png`)});}
  }
});

test('Meaningful Victories feedback exports visible state without future draws',async({page})=>{
  await battle(page);await workshop(page);
  await page.getByRole('button',{name:'Confusing',exact:true}).click();await expect(page.locator('[data-feedback-markers]')).toContainText('1 local markers.');
  const markers=await page.evaluate(()=>JSON.parse(localStorage.getItem('birdsquad.feedback.v1')??'[]'));
  expect(markers[0].hand.length).toBeGreaterThan(0);expect(JSON.stringify(markers)).not.toMatch(/drawPile|random|turnCheckpoint/);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export feedback',exact:true}).click();expect((await download).suggestedFilename()).toBe('bird-squad-feedback.json');
  await page.getByRole('button',{name:'Clear local markers',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('birdsquad.feedback.v1'))).toBe('[]');
});
