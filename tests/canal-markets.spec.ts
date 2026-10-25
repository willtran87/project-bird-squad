import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { canalPreens } from '../src/game/flyway-rules';
import { resolveScriptedBattle } from './helpers/scripted-battle';
import { settleCanvas } from './helpers/settled-canvas';

const content = JSON.parse(readFileSync('data/game/map02-content.json', 'utf8'));
const curated = ['dock_swarm', 'net_barricade', 'barge_gull', 'dredge_eel', 'feint_line', 'lock_keeper'];
const sizes = [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}];
async function route(page: Page) {
  await page.goto('./?flight=canal-acceptance&length=full');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.evaluate(() => { const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.scene.restart({runState:{...r.runState,mapIndex:1}}); });
  await readyRoute(page);
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');if(r.shouldChooseDistrictContract())r.chooseDistrictContract(r.districtContractChoices()[0].id);});
}
async function readyRoute(page: Page) {
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,r=g.scene.getScene('RouteScene');return g.scene.isActive('RouteScene')&&r.runState.mapIndex===1&&r.routeEssentialAssetsReady&&r.openFlyway&&r.canalMarkets;});
}
async function readyBattle(page: Page) {
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,b=g.scene.getScene('BattleScene');return g.scene.isActive('BattleScene')&&b.flywayMapIndex===1&&b.canalMarkets&&b.combatPreviewModule&&b.discardChoiceModule&&b.returnChoiceModule&&b.fxLayer?.active&&!b.combatIntroActive&&!b.combatAnimationPending;});
}
async function battle(page: Page, id: string, ordinal=0) {
  const encounter=content.encounters.find((e:any)=>e.id===id);
  if(!encounter) throw Error(`Missing encounter ${id}`);
  await page.evaluate(({encounter,ordinal})=>{
    const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene'),map=w.__birdSquadCurrentMap();
    // Explicit encounter fixture; all combat, resource and reward rules stay live.
    const node=map.nodes.filter((n:any)=>n.type==='street')[ordinal];
    node.payloadId=encounter.id;node.type=encounter.nodeType;node.label=encounter.name;
    r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:node.id});
  },{encounter,ordinal});
  await readyBattle(page);
}
async function reload(page: Page) {
  await page.reload();
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').continueRun());
  await readyRoute(page);
}
const errors = new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const entries:string[]=[];errors.set(page,entries);page.on('pageerror',e=>entries.push(e.message));});
test.afterEach(async({page})=>{await page.goto('about:blank');expect(errors.get(page)).toEqual([]);});

for(const branch of canalPreens) test(`Canal Preen ${branch.name} commits, reloads and executes its written rules`,async({page},info)=>{
  await route(page);
  await page.evaluate(card=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.cardPickerMode='preen';r.cardPickerContext='districtPreen';r.cardPickerRemainingPicks=1;const i=r.runState.deck.findIndex((c:any)=>c.id===card);r.requestCardPick(i);r.requestCardPick(i);},branch.card);
  await expect(page.getByRole('heading',{name:'Choose this bird’s Preen'})).toBeVisible();
  for(const size of sizes) {
    await page.setViewportSize(size);await page.getByRole('button',{name:`Choose ${branch.name}`,exact:true}).scrollIntoViewIfNeeded();
    expect(await page.locator('#flyway-book').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath(`preen-${size.width}.png`)});
  }
  await page.getByRole('button',{name:`Choose ${branch.name}`,exact:true}).click();
  await reload(page);
  await battle(page,'enc_canal_dock_swarm');
  const result=await page.evaluate(({id,card})=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),c=b.allDeckCards().find((c:any)=>c.id===card);
    const normal=b.activeCardContract(c).effects,cost=b.effectiveCost(c);
    b.flock.molt=true;const molt=b.activeCardContract(c).effects;b.flock.molt=false;
    // Arrange only a known hand; no energy, health or damage grants.
    for(const zone of ['hand','drawPile','discardPile','clearedPile'])b[zone]=b[zone].filter((x:any)=>x.instanceId!==c.instanceId);
    b.hand.push(c);const before=b.energy,preview=b.simulateCardOutcome(c,b.enemies[0].id);
    b.playCard(c,b.enemies[0].id,{resolveDelayMs:0});
    return {branch:c.preenBranch,upgraded:c.upgraded,normal,molt,cost,energy:before-b.energy,played:b.cardsPlayedThisTurn,
      hp:b.enemies.map((e:any)=>e.hp),expected:preview.enemyStates.map((e:any)=>e.hpAfter),id};
  },branch);
  expect(result.branch).toBe(branch.id);expect(result.upgraded).toBe(true);
  expect(result.normal).toEqual(branch.effects);expect(result.molt).toEqual(branch.moltEffects);
  expect(result.cost).toBe(branch.cost??(branch.card==='aviary_25'?0:1));
  expect(result.energy).toBe(result.cost);expect(result.played).toBe(1);expect(result.hp).toEqual(result.expected);
});

for(const suffix of curated) test(`Canal curated crossing ${suffix} resolves with live rules and readable purpose`,async({page},info)=>{
  await route(page);await battle(page,`enc_canal_${suffix}`);
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.introPlayed=false;b.playBattleIntro();b.time.timeScale=0;b.tweens.timeScale=0;b.fxLayer.list.forEach((o:any)=>{if(o.list?.some((x:any)=>x.name==='opening-encounter-purpose'))o.alpha=1;});});
  for(const size of sizes) {
    await page.setViewportSize(size);await settleCanvas(page);
    const bounds=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');const items=b.fxLayer.list.flatMap((o:any)=>o.list??[]),purpose=items.find((o:any)=>o.name==='opening-encounter-purpose'),dismiss=items.find((o:any)=>o.name==='combat-intro-dismiss-label');return {text:purpose.text,bottom:purpose.getBounds().bottom,top:dismiss.getBounds().top};});
    expect(bounds.text).toBe(content.encounters.find((e:any)=>e.id===`enc_canal_${suffix}`).lesson);expect(bounds.bottom).toBeLessThan(bounds.top);
    await page.screenshot({path:info.outputPath(`crossing-${size.width}.png`)});
  }
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.combatIntroFinish?.(true);b.time.timeScale=1;b.tweens.timeScale=1;});
  const result=await page.evaluate(resolveScriptedBattle,'balanced');
  await info.attach('mechanical-outcome',{body:JSON.stringify(result),contentType:'application/json'});
  expect(result.mode).not.toBe('battle');expect(result.decisions.length).toBeGreaterThan(1);expect(Number.isFinite(result.hp)).toBe(true);
});

for(const pledge of ['timber','lamps']) test(`Canal ferry ${pledge} survives reload and pays only after two real victories`,async({page},info)=>{
  test.setTimeout(180000);await route(page);await page.keyboard.press('j');
  const before=await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.scrap);
  await page.getByRole('button',{name:`Fund ferry ${pledge} · 15 Scrap`,exact:true}).click();
  const reopen=page.getByRole('button',{name:/Reopen ferry/});await expect(reopen).toBeDisabled();
  await page.keyboard.press('Escape');await reload(page);
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.scrap)).toBe(before-15);
  for(let fight=0;fight<2;fight++) {
    await battle(page,'enc_canal_dock_swarm',fight);
    const result=await page.evaluate(resolveScriptedBattle,'balanced');expect(result.mode).not.toBe('defeat');
    for(let i=0;i<5;i++) {
      if(await page.evaluate(()=>(window as any).__birdSquadGame.scene.isActive('RouteScene')))break;
      await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').rewardPresentationReady());
      await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');if(b.mode==='cardReward')b.skipCardReward();else if(b.mode==='upgradeReward')b.chooseUpgradeCard(b.upgradeChoices[0].id);else if(b.mode==='waymarkReward')b.chooseWaymarkReward(b.waymarkChoices[0].id);});
    }
    await readyRoute(page);await page.keyboard.press('j');
    if(fight===0)await expect(reopen).toBeDisabled();else await expect(reopen).toBeEnabled();
    await page.keyboard.press('Escape');
  }
  const rewardBefore=await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return {hp:r.runState.currentHp,max:r.runMaxHp(),guard:r.runState.nextCombat?.openSkyGuard??0,trust:r.runState.flyway.residents.oren};});
  await page.keyboard.press('j');await reopen.click();await expect(reopen).toHaveCount(0);
  await page.keyboard.press('Escape');await reload(page);
  const after=await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return {hp:r.runState.currentHp,guard:r.runState.nextCombat?.openSkyGuard??0,trust:r.runState.flyway.residents.oren,ferry:r.runState.flyway.canalFerry,visible:r.canalMarkets.restored};});
  expect(after.ferry).toMatchObject({pledge,rewarded:true});expect(after.trust).toBe(rewardBefore.trust+1);expect(after.visible).toBe(true);
  expect(after.hp).toBe(pledge==='timber'?Math.min(rewardBefore.max,rewardBefore.hp+8):rewardBefore.hp);
  expect(after.guard).toBe(rewardBefore.guard+(pledge==='lamps'?2:0));
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`ferry-${size.width}.png`)});}
});

test('Canal Gatekeeper phase resets force, discloses charge and recovery, and limits effects',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await route(page);
  const boss=content.encounters.find((e:any)=>e.nodeType==='boss');await battle(page,boss.id);
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.introPlayed=false;b.playBattleIntro();b.time.timeScale=0;});
  for(const size of sizes) {
    await page.setViewportSize(size);await settleCanvas(page);
    const fit=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),items=b.fxLayer.list.flatMap((o:any)=>o.list??[]),purpose=items.find((o:any)=>o.name==='opening-encounter-purpose'),dismiss=items.find((o:any)=>o.name==='combat-intro-dismiss-label');return {text:purpose.text,clear:purpose.getBounds().bottom<dismiss.getBounds().top};});
    expect(fit.text).toBe(boss.lesson);expect(fit.clear).toBe(true);
    await page.screenshot({path:info.outputPath(`gatekeeper-purpose-${size.width}.png`)});
  }
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.combatIntroFinish?.(true);b.time.timeScale=1;});
  const result=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),e=b.enemies.find((e:any)=>e.runtime.type==='boss');
    b.enemies.filter((x:any)=>x!==e).forEach((x:any)=>x.hp=0); // Isolate the boss rule fixture.
    e.nextAttackBonus=9;e.block=0;b.damageEnemy(e.id,Math.ceil(e.maxHp/2),'phase boundary');
    const phase={phase:e.phase,force:e.nextAttackBonus,cover:e.block,tell:b.getTextState().enemies.find((x:any)=>x.id===e.id).intent};
    const charge=e.runtime.moves.find((m:any)=>m.id==='sluice_charge');
    charge.effects.forEach((effect:string)=>b.resolveEnemyEffect(e,effect,charge.label));b.advanceEnemyIntent(e);
    const release=b.getTextState().enemies.find((x:any)=>x.id===e.id).intent;
    const before=b.flock.hp,preview=b.incomingFlockDamagePreview().hpLoss;
    const attack=e.runtime.moves.find((m:any)=>m.id==='sluice_release');attack.effects.forEach((effect:string)=>b.resolveEnemyEffect(e,effect,attack.label));b.advanceEnemyIntent(e);
    const recovery=b.getTextState().enemies.find((x:any)=>x.id===e.id).intent;
    for(let i=0;i<20;i++)b.events.emit('flyway-combination');
    const active=b.canalMarkets.active,children=b.fxLayer.list.filter((o:any)=>o.name==='canal-current-fx').map((o:any)=>o.list.length);
    e.intentIndex=1;e.block=6;b.damageEnemy(e.id,6,'strip the gate');b.updateFlywayBossBreaks();
    const disrupted=b.getTextState().enemies.find((x:any)=>x.id===e.id).intent;
    b.advanceEnemyIntent(e);e.intentIndex=1;b.updateFlywayBossBreaks();
    const repeated=b.getTextState().enemies.find((x:any)=>x.id===e.id).intent;
    b.renderAll();return {phase,release,recovery,loss:before-b.flock.hp,preview,active,children,disrupted,repeated,used:e.flywayBreakUsed};
  });
  expect(result.phase).toMatchObject({phase:2,force:0,cover:0});expect(result.phase.tell).toContain('Charge');
  expect(result.release).toContain('Release');expect(result.preview).toBe(16);expect(result.loss).toBe(result.preview);expect(result.recovery).toContain('Reset');
  expect(result.active).toBeLessThanOrEqual(2);expect(result.children.every(n=>n===1)).toBe(true);
  expect(result.disrupted).toContain('Disrupted');expect(result.repeated).not.toContain('Disrupted');expect(result.used).toBe(true);
  await page.screenshot({path:info.outputPath('open-sluice.png')});
  await page.evaluate(()=>(window as any).advanceTime(1200));
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').canalMarkets.active)).toBe(0);
});

test('Canal content stays lazy on title and offers recovery after a failed download',async({page})=>{
  const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
  await page.goto('./');await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  expect(requests.some(u=>/canal-markets-/.test(u))).toBe(false);
  await page.route('**/canal-markets-*.js',r=>r.abort());
  await page.keyboard.press('Enter');await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.scene.restart({runState:{...r.runState,mapIndex:1}});});
  await page.waitForFunction(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return r.runState.mapIndex===1&&r.routeEssentialAssetsReady&&r.openFlyway;});
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');if(r.shouldChooseDistrictContract())r.chooseDistrictContract(r.districtContractChoices()[0].id);});
  const recovery=page.getByRole('dialog',{name:'Download recovery'});
  await expect(recovery).toBeVisible();await page.getByRole('button',{name:'Keep playing',exact:true}).click();
  await page.keyboard.press('j');await expect(page.getByRole('button',{name:'Canal recovery options'})).toBeVisible();
  await page.keyboard.press('Escape');expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.isActive('RouteScene'))).toBe(true);
});

test('Canal ferry save failure rolls back payment and permits one durable retry',async({page})=>{
  await route(page);await page.keyboard.press('j');
  const before=await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');(window as any).originalWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('birdsquad.run.active'))throw new DOMException('Full','QuotaExceededError');(window as any).originalWrite.call(this,key,value);};return r.runState.scrap;});
  await page.getByRole('button',{name:'Fund ferry timber · 15 Scrap',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Could not save');
  expect(await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return {scrap:r.runState.scrap,ferry:r.runState.flyway.canalFerry??null};})).toEqual({scrap:before,ferry:null});
  await page.evaluate(()=>{Storage.prototype.setItem=(window as any).originalWrite;});
  await page.getByRole('button',{name:'Fund ferry timber · 15 Scrap',exact:true}).click();await page.keyboard.press('Escape');await reload(page);
  expect(await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return {scrap:r.runState.scrap,pledge:r.runState.flyway.canalFerry.pledge};})).toEqual({scrap:before-15,pledge:'timber'});
});

test('Canal audio honors mute and effects retire without leaking into other districts',async({page})=>{
  await page.addInitScript(()=>{if(location.protocol.startsWith('http'))localStorage.setItem('birdsquad.audioMuted','1');});
  await route(page);await page.keyboard.press('j');
  await page.getByRole('button',{name:'Fund ferry lamps · 15 Scrap',exact:true}).click();await page.keyboard.press('Escape');
  await battle(page,'enc_canal_dock_swarm');
  const state=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');for(let i=0;i<50;i++)b.events.emit('flyway-combination');b.events.emit('flyway-phase');return {audio:(window as any).__birdSquadAudio(),active:b.canalMarkets.active,count:b.fxLayer.list.filter((o:any)=>o.name==='canal-current-fx').length};});
  expect(state.audio.muted).toBe(true);expect(state.audio.sfx.played).toBe(0);
  expect(state.audio.cueRequests.canalRepair).toBeGreaterThan(0);expect(state.audio.cueRequests.canalBell).toBeGreaterThan(0);expect(state.audio.cueRequests.canalSurge).toBeGreaterThan(0);
  expect(state.active).toBeLessThanOrEqual(2);expect(state.count).toBe(state.active);
  await page.evaluate(()=>(window as any).advanceTime(1200));
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').canalMarkets.active)).toBe(0);
  await page.evaluate(()=>{const g=(window as any).__birdSquadGame,b=g.scene.getScene('BattleScene'),r=g.scene.getScene('RouteScene');b.scene.start('RouteScene',{runState:{...r.runState,mapIndex:2}});});
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,r=g.scene.getScene('RouteScene');return g.scene.isActive('RouteScene')&&r.runState.mapIndex===2&&r.routeEssentialAssetsReady&&r.canalMarkets;});
  expect(await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene'),before=JSON.stringify((window as any).__birdSquadAudio().cueRequests);r.events.emit('flyway-phase');r.events.emit('flyway-combination');return {quiet:before===JSON.stringify((window as any).__birdSquadAudio().cueRequests),pulses:r.canalMarkets.pulses,ferry:!!r.children.getByName('canal-ferry')};})).toEqual({quiet:true,pulses:0,ferry:false});
});
