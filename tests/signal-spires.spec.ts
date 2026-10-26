import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { spirePreens } from '../src/game/flyway-rules';
import { resolveScriptedBattle } from './helpers/scripted-battle';
import { settleCanvas } from './helpers/settled-canvas';

const content=JSON.parse(readFileSync('data/game/map03-content.json','utf8'));
const sizes=[{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}];
async function readyRoute(page:Page,map=2){
  await page.waitForFunction(map=>{const g=(window as any).__birdSquadGame,r=g.scene.getScene('RouteScene');return g.scene.isActive('RouteScene')&&r.runState.mapIndex===map&&r.routeEssentialAssetsReady&&r.openFlyway&&r.signalSpires;},map);
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');if(r.shouldChooseDistrictContract())r.chooseDistrictContract(r.districtContractChoices()[0].id);});
}
async function route(page:Page){
  await page.goto('./?flight=spire-acceptance&length=full');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.keyboard.press('Enter');await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.scene.restart({runState:{...r.runState,mapIndex:2}});});await readyRoute(page);
}
async function reload(page:Page,map=2){
  await page.reload();await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').continueRun());await readyRoute(page,map);
}
async function battle(page:Page,id:string,ordinal=0){
  const encounter=content.encounters.find((e:any)=>e.id===id);if(!encounter)throw Error(id);
  // Explicit encounter fixture; combat/resource/reward resolution uses live rules.
  await page.evaluate(({encounter,ordinal})=>{const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene');const n=w.__birdSquadCurrentMap().nodes.filter((n:any)=>n.type==='street')[ordinal];Object.assign(n,{payloadId:encounter.id,type:encounter.nodeType,label:encounter.name});r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:n.id});},{encounter,ordinal});
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,b=g.scene.getScene('BattleScene');return g.scene.isActive('BattleScene')&&b.signalSpires&&b.combatPreviewModule&&b.discardChoiceModule&&b.returnChoiceModule&&b.fxLayer?.active&&!b.combatIntroActive&&!b.combatAnimationPending;});
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

for(const branch of spirePreens)for(const molt of [false,true])test(`Spires ${branch.name} commits and executes saved ${molt?'Molt':'normal'} rules`,async({page},info)=>{
  await route(page);
  await page.evaluate(card=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.cardPickerMode='preen';r.cardPickerContext='districtPreen';r.cardPickerRemainingPicks=1;const i=r.runState.deck.findIndex((c:any)=>c.id===card);r.requestCardPick(i);r.requestCardPick(i);},branch.card);
  await expect(page.getByRole('button',{name:`Choose ${branch.name}`,exact:true})).toBeVisible();
  if(!molt)for(const size of sizes){await page.setViewportSize(size);await page.getByRole('button',{name:`Choose ${branch.name}`,exact:true}).scrollIntoViewIfNeeded();expect(await page.locator('#flyway-book').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`preen-${size.width}.png`)});}
  await page.getByRole('button',{name:`Choose ${branch.name}`,exact:true}).click();await reload(page);await battle(page,'enc_spire_relay_starling');
  const result=await page.evaluate(({card,molt})=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),c=b.allDeckCards().find((c:any)=>c.id===card);
    b.flock.molt=molt;
    // Arrange a legal known hand and prior suit for the conditional branch fixture.
    for(const z of ['hand','drawPile','discardPile','clearedPile'])b[z]=b[z].filter((x:any)=>x.instanceId!==c.instanceId);b.hand.push(c);
    const cold=b.simulateCardOutcome(c,b.enemies[0].id);b.playedSuitsThisTurn.add(molt?'quills':'basins');
    const forecast=b.simulateCardOutcome(c,b.enemies[0].id),effects=b.activeCardContract(c).effects,cost=b.effectiveCost(c),before=b.energy;
    b.playCard(c,b.enemies[0].id,{resolveDelayMs:0});
    return {branch:c.preenBranch,cost,effects,energy:b.energy,expected:forecast.flockAfter.energy,before,hp:b.enemies.map((e:any)=>e.hp),expectedHp:forecast.enemyStates.map((e:any)=>e.hpAfter),cover:b.flock.block,expectedCover:forecast.flockAfter.block,nextEnergy:b.nextTurnEnergyBonus,delta:forecast.nextTurnEnergyDelta,coldEnergy:cold.flockAfter.energy,played:b.cardsPlayedThisTurn};
  },{card:branch.card,molt});
  await info.attach('live-rule-result',{body:JSON.stringify(result),contentType:'application/json'});
  expect(result.branch).toBe(branch.id);expect(result.effects).toEqual(molt?branch.moltEffects:branch.effects);expect(result.cost).toBe(Math.max(0,(branch.cost??1)-(molt&&branch.card!=='aviary_25'?1:0)));
  expect(result.energy).toBe(result.expected);expect(result.hp).toEqual(result.expectedHp);expect(result.cover).toBe(result.expectedCover);expect(result.played).toBe(1);
  if(branch.id==='spire-watch')expect(result.nextEnergy).toBe(1);
  if(branch.id==='spire-chorus'&&!molt)expect(result.energy-result.coldEnergy).toBe(1);
});

for(const suffix of ['relay_swarm','relay_starling','aerial_kite','tower_pigeon','static_swift','beacon_grackle'])test(`Spires curated ${suffix} resolves with readable tactical purpose`,async({page},info)=>{
  await route(page);await battle(page,`enc_spire_${suffix}`);
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.introPlayed=false;b.playBattleIntro();b.time.timeScale=0;b.tweens.timeScale=0;b.fxLayer.list.forEach((o:any)=>{if(o.list?.some((x:any)=>x.name==='opening-encounter-purpose'))o.alpha=1;});});
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);const fit=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),all=b.fxLayer.list.flatMap((o:any)=>o.list??[]),p=all.find((o:any)=>o.name==='opening-encounter-purpose'),d=all.find((o:any)=>o.name==='combat-intro-dismiss-label');return {text:p.text,clear:p.getBounds().bottom<d.getBounds().top,depth:b.fxLayer.depth>b.root.depth};});expect(fit.text).toBe(content.encounters.find((e:any)=>e.id===`enc_spire_${suffix}`).lesson);expect(fit.clear).toBe(true);expect(fit.depth).toBe(true);await page.screenshot({path:info.outputPath(`crossing-${size.width}.png`)});}
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.combatIntroFinish?.(true);b.time.timeScale=1;b.tweens.timeScale=1;});
  const result=await page.evaluate(resolveScriptedBattle,'balanced');await info.attach('mechanical-outcome',{body:JSON.stringify(result),contentType:'application/json'});expect(result.mode).not.toBe('battle');expect(result.decisions.length).toBeGreaterThan(1);expect(Number.isFinite(result.hp)).toBe(true);
});

for(const pledge of ['wires','lenses'])test(`Spires Ivo ${pledge} earns a durable relay and High Roost delivery`,async({page},info)=>{
  test.setTimeout(180000);await route(page);await page.keyboard.press('j');
  const before=await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.scrap);
  await page.getByRole('button',{name:`Repair relay ${pledge} · 18 Scrap`,exact:true}).click();
  const collect=page.getByRole('button',{name:/Reconnect relay/});await expect(collect).toBeDisabled();await page.keyboard.press('Escape');await reload(page);
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.scrap)).toBe(before-18);
  for(let fight=0;fight<2;fight++){
    await battle(page,'enc_spire_relay_starling',fight);const result=await page.evaluate(resolveScriptedBattle,'balanced');expect(result.mode).not.toBe('defeat');await settleReward(page);await page.keyboard.press('j');
    if(!fight){await expect(collect).toBeDisabled();await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.isActive('RouteScene'))).toBe(true);}else await expect(collect).toBeEnabled();
  }
  const pending=await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.nextCombat??{});
  await collect.click();await expect(collect).toHaveCount(0);await page.keyboard.press('Escape');await reload(page);
  const state=await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return {relay:r.runState.flyway.spireRelay,next:r.runState.nextCombat,visible:r.signalSpires.restored};});
  expect(state.relay).toMatchObject({pledge,rewarded:true});expect(state.visible).toBe(true);
  const key=pledge==='wires'?'wingbeatBonus':'openSkyGuard';expect(state.next[key]).toBe((pending[key]??0)+(pledge==='wires'?1:2));
  // Cross-district fixture preserves the earned relay; an already-restored ferry
  // supplies the independently tested Canal contribution to the final delivery.
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.runState.flyway.canalFerry={pledge:'lamps',startedAt:0,rewarded:true};r.scene.restart({runState:{...r.runState,mapIndex:3}});});await readyRoute(page,3);await page.keyboard.press('j');
  await page.getByRole('button',{name:'Receive High Roost relay delivery',exact:true}).click();await expect(page.getByRole('button',{name:'Receive High Roost relay delivery',exact:true})).toHaveCount(0);
  await page.keyboard.press('Escape');await reload(page,3);
  const delivered=await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return {relay:r.runState.flyway.spireRelay,next:r.runState.nextCombat};});
  expect(delivered.relay.delivered).toBe(true);expect(delivered.next.wingbeatBonus).toBe((state.next.wingbeatBonus??0)+1);expect(delivered.next.openSkyGuard).toBe((state.next.openSkyGuard??0)+2);
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`delivery-${size.width}.png`)});}
  await page.keyboard.press('j');await expect(page.getByRole('button',{name:'Receive High Roost relay delivery',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');
  // Start a real High Roost encounter and verify that the saved opening-turn
  // Wingbeat modifier is consumed by combat, not merely displayed in the journal.
  await page.evaluate(()=>{const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene'),n=w.__birdSquadCurrentMap().nodes.find((n:any)=>n.type==='street');r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:n.id});});
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,b=g.scene.getScene('BattleScene');return g.scene.isActive('BattleScene')&&b.fxLayer?.active&&!b.combatAnimationPending&&!b.combatIntroActive;});
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').energy)).toBe(3+delivered.next.wingbeatBonus);
});

for(const branch of spirePreens)test(`Spires retraining ${branch.name} preserves the current Preen on cancel and save failure`,async({page})=>{
  await route(page);await page.evaluate(card=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene'),c=r.runState.deck.find((c:any)=>c.id===card);c.upgraded=true;c.preenBranch='flight';},branch.card);await page.keyboard.press('j');
  const train=page.getByRole('button',{name:`Retrain ${branch.name} · 25 Scrap`,exact:true});await train.click();await page.getByRole('button',{name:'Keep current Preen',exact:true}).click();
  const before=await page.evaluate(card=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return {scrap:r.runState.scrap,card:r.runState.deck.find((c:any)=>c.id===card)};},branch.card);expect(before.card.preenBranch).toBe('flight');
  await train.click();await page.evaluate(()=>{(window as any).originalWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('birdsquad.run.active'))throw new DOMException('Full','QuotaExceededError');(window as any).originalWrite.call(this,key,value);};});
  await page.getByRole('button',{name:`Confirm ${branch.name} · 25 Scrap`,exact:true}).click();await expect(page.getByRole('status')).toContainText('Could not save');
  expect(await page.evaluate(card=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return {scrap:r.runState.scrap,card:r.runState.deck.find((c:any)=>c.id===card)};},branch.card)).toEqual(before);
  await page.evaluate(()=>{Storage.prototype.setItem=(window as any).originalWrite;});await train.click();await page.getByRole('button',{name:`Confirm ${branch.name} · 25 Scrap`,exact:true}).click();await page.keyboard.press('Escape');await reload(page);
  const after=await page.evaluate(card=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return {scrap:r.runState.scrap,card:r.runState.deck.find((c:any)=>c.id===card)};},branch.card);expect(after.scrap).toBe(before.scrap-25);expect(after.card).toMatchObject({upgraded:true,preenBranch:branch.id});
});

test('Spires Beacon-Breaker exposes a recovery beat, matches its forecast and keeps Tells above phase effects',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await route(page);await battle(page,content.encounters.find((e:any)=>e.nodeType==='boss').id);
  const result=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),e=b.enemies.find((e:any)=>e.runtime.type==='boss');
    b.enemies.filter((x:any)=>x!==e).forEach((x:any)=>x.hp=0);e.nextAttackBonus=9;e.block=0;b.damageEnemy(e.id,Math.ceil(e.maxHp/2),'phase boundary');
    const reset={phase:e.phase,force:e.nextAttackBonus,cover:e.block};const charge=e.runtime.moves.find((m:any)=>m.id==='relay_charge');charge.effects.forEach((x:string)=>b.resolveEnemyEffect(e,x,charge.label));b.advanceEnemyIntent(e);
    const forecast=b.incomingFlockDamagePreview().hpLoss,before=b.flock.hp,attack=e.runtime.moves.find((m:any)=>m.id==='relay_broadcast');attack.effects.forEach((x:string)=>b.resolveEnemyEffect(e,x,attack.label));b.advanceEnemyIntent(e);
    const recovery=b.getTextState().enemies.find((x:any)=>x.id===e.id).intent,recoveryLoss=b.incomingFlockDamagePreview().hpLoss;
    e.intentIndex=1;e.weak=2;b.updateFlywayBossBreaks();const disrupted=b.getTextState().enemies.find((x:any)=>x.id===e.id).intent;b.advanceEnemyIntent(e);e.intentIndex=1;b.updateFlywayBossBreaks();const repeated=b.getTextState().enemies.find((x:any)=>x.id===e.id).intent;
    for(let i=0;i<30;i++)b.events.emit('flyway-combination');b.renderAll();return {reset,forecast,loss:before-b.flock.hp,recovery,recoveryLoss,disrupted,repeated,active:b.signalSpires.active,children:b.fxLayer.list.filter((o:any)=>o.name==='spire-signal-fx').map((o:any)=>o.list.length),protected:b.root.depth>b.fxLayer.depth&&b.handLayer.depth>b.fxLayer.depth};
  });
  expect(result.reset).toEqual({phase:2,force:0,cover:0});expect(result.forecast).toBe(16);expect(result.loss).toBe(16);expect(result.recovery).toContain('Exposed');expect(result.recoveryLoss).toBe(0);expect(result.disrupted).toContain('Disrupted');expect(result.repeated).not.toContain('Disrupted');expect(result.protected).toBe(true);expect(result.active).toBeLessThanOrEqual(2);expect(result.children.every(n=>n===1)).toBe(true);
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`boss-clarity-${size.width}.png`)});}
  await page.evaluate(()=>(window as any).advanceTime(1200));await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').signalSpires.active)).toBe(0);
});

test('Spires clarity keeps selected resource forecasts and full rules above ordinary effects',async({page},info)=>{
  await route(page);await battle(page,'enc_spire_relay_starling');
  const expected=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),c=b.hand.find((c:any)=>c.id==='wands_ace')??b.hand[0];b.onCardClicked(c.instanceId);b.combatBossPhaseBreak(840,270);const out=b.simulateCardOutcome(c,b.selectedEnemyId);return {before:out.flockBefore.energy,after:out.flockAfter.energy};});
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);const result=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),p=b.root.getByName('combat-selection-preview');return {summary:p.getByName('combat-selection-summary').text,protected:b.root.depth>b.fxLayer.depth&&b.handLayer.depth>b.fxLayer.depth,reader:b.cardPreview?.active,inspectParent:b.cardPreview?.parentContainer===b.root};});expect(result.summary).toContain(`Wingbeats ${expected.before} → ${expected.after}`);expect(result.protected).toBe(true);expect(result.reader).toBe(true);expect(result.inspectParent).toBe(true);await page.screenshot({path:info.outputPath(`decision-${size.width}.png`)});}
  await page.keyboard.press('h');await expect.poll(()=>page.evaluate(()=>!!(window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active)).toBe(true);
});

test('Spires relay payment rolls back failed saves and recovers exactly once',async({page})=>{
  await route(page);await page.keyboard.press('j');const before=await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');(window as any).originalWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('birdsquad.run.active'))throw new DOMException('Full','QuotaExceededError');(window as any).originalWrite.call(this,key,value);};return r.runState.scrap;});
  await page.getByRole('button',{name:'Repair relay wires · 18 Scrap',exact:true}).click();await expect(page.getByRole('status')).toContainText('Could not save');expect(await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return {scrap:r.runState.scrap,relay:r.runState.flyway.spireRelay??null};})).toEqual({scrap:before,relay:null});
  await page.evaluate(()=>{Storage.prototype.setItem=(window as any).originalWrite;});await page.getByRole('button',{name:'Repair relay wires · 18 Scrap',exact:true}).click();await page.keyboard.press('Escape');await reload(page);expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.scrap)).toBe(before-18);
});

test('Spires title stays lazy and a failed district download leaves a playable recovery path',async({page})=>{
  const requests:string[]=[];page.on('request',r=>requests.push(r.url()));await page.goto('./');await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);expect(requests.some(u=>/signal-spires-.*\.js/.test(u))).toBe(false);
  await page.route('**/signal-spires-*.js',r=>r.abort());await page.keyboard.press('Enter');await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.scene.restart({runState:{...r.runState,mapIndex:2}});});
  await page.waitForFunction(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return r.runState.mapIndex===2&&r.routeEssentialAssetsReady&&r.openFlyway;});await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');if(r.shouldChooseDistrictContract())r.chooseDistrictContract(r.districtContractChoices()[0].id);});await expect(page.getByRole('dialog',{name:'Download recovery'})).toBeVisible();await page.getByRole('button',{name:'Keep playing',exact:true}).click();await page.keyboard.press('j');await expect(page.getByRole('button',{name:'Signal recovery options'})).toBeVisible();await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.isActive('RouteScene'))).toBe(true);
});

test('Spires muted calls and bounded lamps retire without leaking into High Roost',async({page})=>{
  await page.addInitScript(()=>{if(location.protocol.startsWith('http'))localStorage.setItem('birdsquad.audioMuted','1');});await route(page);await page.keyboard.press('j');await page.getByRole('button',{name:'Repair relay lenses · 18 Scrap',exact:true}).click();await page.keyboard.press('Escape');await battle(page,'enc_spire_relay_starling');
  const state=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');for(let i=0;i<50;i++)b.events.emit('flyway-combination');b.events.emit('flyway-phase');return {audio:(window as any).__birdSquadAudio(),active:b.signalSpires.active,count:b.fxLayer.list.filter((o:any)=>o.name==='spire-signal-fx').length};});expect(state.audio.muted).toBe(true);expect(state.audio.sfx.played).toBe(0);expect(state.audio.cueRequests.spireAnswer).toBeGreaterThan(0);expect(state.audio.cueRequests.spireBroadcast).toBeGreaterThan(0);expect(state.audio.cueRequests.spireRepair).toBeGreaterThan(0);expect(state.active).toBeLessThanOrEqual(2);expect(state.count).toBe(state.active);
  await page.evaluate(()=>(window as any).advanceTime(1200));await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').signalSpires.active)).toBe(0);await page.evaluate(()=>{const g=(window as any).__birdSquadGame,b=g.scene.getScene('BattleScene'),r=g.scene.getScene('RouteScene');b.scene.start('RouteScene',{runState:{...r.runState,mapIndex:3}});});await readyRoute(page,3);
  expect(await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene'),before=JSON.stringify((window as any).__birdSquadAudio().cueRequests);r.events.emit('flyway-phase');r.events.emit('flyway-combination');return {quiet:before===JSON.stringify((window as any).__birdSquadAudio().cueRequests),pulses:r.signalSpires.pulses};})).toEqual({quiet:true,pulses:0});
});
