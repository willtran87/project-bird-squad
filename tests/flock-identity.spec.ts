import {test,expect,type Page} from '@playwright/test';
import {resolveScriptedBattle} from './helpers/scripted-battle';
import {settleCanvas} from './helpers/settled-canvas';
const sizes=[{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}];
async function route(page:Page){
  await page.goto('./?flight=identity-acceptance&length=full');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.keyboard.press('Enter');await readyRoute(page);
}
async function readyRoute(page:Page){await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,r=g.scene.getScene('RouteScene');return g.scene.isActive('RouteScene')&&r.routeEssentialAssetsReady&&r.openFlyway;});}
async function battle(page:Page,leader='fledgling',wins?:number){
  await route(page);
  await page.evaluate(({leader,wins})=>{
    const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene'),run=structuredClone(r.runState);run.leaderId=leader;
    const nodes=w.__birdSquadCurrentMap().nodes,n=wins===undefined?nodes.find((n:any)=>n.type==='street'):nodes.find((n:any)=>n.type==='rival');
    if(!n)throw Error('Missing fixture node');if(wins!==undefined)run.flyway.rivalWins=wins;
    r.scene.start('BattleScene',{runState:run,routeNodeId:n.id});
  },{leader,wins});
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,b=g.scene.getScene('BattleScene');return g.scene.isActive('BattleScene')&&b.identityPacing&&b.combatPreviewModule&&b.discardChoiceModule&&b.returnChoiceModule&&b.fxLayer?.active&&!b.combatIntroActive&&!b.combatAnimationPending;});
}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const e:string[]=[];errors.set(page,e);page.on('pageerror',x=>e.push(x.message));});
test.afterEach(async({page})=>{try{expect(errors.get(page)).toEqual([]);}finally{await page.goto('about:blank');}});

test('Flock Identity direct Call previews, cancels, commits once and respects modal ownership',async({page},info)=>{
  await battle(page);await page.locator('#identity-call').click();
  await expect(page.locator('[data-call-preview]')).toContainText('Neighborhood Rally');await expect(page.getByRole('button',{name:'Use Leader call',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.isActive('BattleScene'));
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.flightCombat.charge=3;b.flightCombat.previousSuit='nests';b.enemies[0].hp=b.enemies[0].maxHp=200;});
  await expect(page.locator('#identity-sequence')).toContainText('Nests'.toLowerCase()+' → quills');
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await expect(page.locator('#identity-call')).toBeVisible();await page.screenshot({path:info.outputPath(`controls-${size.width}.png`)});
    const fit=await page.evaluate(()=>{const c=document.querySelector('#identity-call')!.getBoundingClientRect(),s=document.querySelector('#identity-sequence')!.getBoundingClientRect(),j=document.querySelector('#flyway-launch')!.getBoundingClientRect(),canvas=document.querySelector('canvas')!.getBoundingClientRect();return c.right<s.left&&s.right<canvas.right&&c.height>=44&&j.bottom+4<c.top;});expect(fit).toBe(true);}
  await page.keyboard.press('F9');await expect(page.locator('[data-call-preview]')).toBeVisible();await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').flightCombat.called)).toBe(false);
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.isActive('BattleScene'));await page.keyboard.press('F9');
  const energy=await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').energy);
  await expect(page.getByRole('button',{name:'Use Leader call',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#flyway-book')).toHaveCount(0);
  expect(await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {energy:b.energy,called:b.flightCombat.called,again:b.activateFlywayCall()};})).toEqual({energy:energy+2,called:true,again:false});
  await expect(page.locator('#identity-call')).toContainText('Call used');
  await page.keyboard.press('Escape');await expect(page.locator('#identity-call')).toBeHidden();await page.keyboard.press('F9');await expect(page.locator('#flyway-book')).toHaveCount(0);
});

for(const leader of ['fledgling','spark_caller','talon','tidewarden','roostkeeper'])test(`Flock Identity ${leader} specializations use live effects without duplicate Calls`,async({page},info)=>{
  await battle(page,leader);
  const results=await page.evaluate(leader=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),initial=structuredClone(b.enemies),flock=structuredClone(b.flock),results=[];
    for(const style of ['shelter','flight']){
      b.flyway.callStyle=style;b.flightCombat.called=false;b.flightCombat.charge=99;b.energy=1;
      b.flock={...flock,hp:10,maxHp:100,block:0};b.enemies=structuredClone(initial);b.enemies.forEach((e:any)=>{e.hp=e.maxHp=100;e.block=0;e.weak=0;});
      const hand=b.hand.length,used=b.activateFlywayCall(),again=b.activateFlywayCall();
      results.push({style,used,again,energy:b.energy,heal:b.flock.hp-10,cover:b.flock.block,damage:100-b.enemies[0].hp,winded:b.enemies[0].weak,draw:b.hand.length-hand});
      b.retireCombatFxForOutcome();
    }return results;
  },leader);
  await info.attach('live-specializations',{body:JSON.stringify(results),contentType:'application/json'});
  for(const r of results){expect(r.used).toBe(true);expect(r.again).toBe(false);}
  if(leader==='fledgling'){expect(results.map(r=>r.energy)).toEqual([2,4]);expect(results[0].cover).toBeGreaterThan(0);expect(results[1].cover).toBe(0);}
  if(leader==='spark_caller'){expect(results.map(r=>[r.energy,r.draw])).toEqual([[2,2],[4,0]]);}
  if(leader==='talon'){expect(results[0].winded).toBeGreaterThan(0);expect(results[1].winded).toBe(0);expect(results[1].damage).toBeGreaterThan(results[0].damage);}
  if(leader==='tidewarden'){expect(results.map(r=>r.heal)).toEqual([10,3]);expect(results[0].cover).toBe(0);expect(results[1].cover).toBeGreaterThan(0);}
  if(leader==='roostkeeper'){expect(results[0].damage).toBe(0);expect(results[0].cover).toBeGreaterThan(0);expect(results[1].damage).toBeGreaterThan(0);expect(results[1].cover).toBe(0);}
});

test('Flock Identity specialization waits for a boss, supports cancel and save rollback, and survives reload',async({page},info)=>{
  await route(page);await page.keyboard.press('j');await expect(page.locator('[data-flock-identity]')).toContainText('Defeat your first');await expect(page.getByRole('button',{name:/Inspect Gather/})).toHaveCount(0);
  await page.keyboard.press('Escape');await readyRoute(page);await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.runState.flyway.restored=[0];});await page.keyboard.press('j');
  await page.getByRole('button',{name:'Inspect Gather the Neighbors',exact:true}).click();await page.getByRole('button',{name:'Keep deciding',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.flyway.callStyle)).toBeUndefined();
  await page.getByRole('button',{name:'Inspect Gather the Neighbors',exact:true}).click();
  await page.evaluate(()=>{(window as any).identityWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('birdsquad.run.active'))throw new DOMException('Full','QuotaExceededError');(window as any).identityWrite.call(this,k,v);};});
  await page.getByRole('button',{name:'Commit Gather the Neighbors',exact:true}).click();await expect(page.getByRole('status')).toContainText('Could not save');
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.flyway.callStyle)).toBeUndefined();await page.evaluate(()=>{Storage.prototype.setItem=(window as any).identityWrite;});
  await page.getByRole('button',{name:'Inspect Lead the Crossing',exact:true}).click();await page.getByRole('button',{name:'Commit Lead the Crossing',exact:true}).click();
  await expect(page.locator('[data-flock-identity]')).toContainText('Lead the Crossing');await expect(page.getByRole('button',{name:/Inspect Gather/})).toHaveCount(0);
  for(const size of sizes){await page.setViewportSize(size);await page.screenshot({path:info.outputPath(`specialization-${size.width}.png`)});expect(await page.locator('#flyway-book').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);}
  await page.keyboard.press('Escape');await page.reload();await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').continueRun());await readyRoute(page);
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.flyway.callStyle)).toBe('flight');
});

for(const wins of [0,1,2])test(`Flock Identity rival chapter ${wins+1} has forecast parity, a counterplay window and resolves`,async({page},info)=>{
  await battle(page,'fledgling',wins);
  const parity=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),enemies=structuredClone(b.enemies),flock=structuredClone(b.flock),cases=[];
    for(const disabled of [false,true]){b.enemies=structuredClone(enemies);b.flock={...flock,hp:100,maxHp:100,block:0};if(disabled)b.enemies.slice(1).forEach((e:any)=>e.hp=0);const prediction=b.enemyDamageProjection(b.enemies,b.flock,false);b.resolveEnemyTurn();cases.push({predicted:prediction.afterHp,actual:b.flock.hp,cover:b.enemies[0].block,force:b.enemies[0].nextAttackBonus});}
    b.enemies=structuredClone(enemies);b.flock=flock;b.retireCombatFxForOutcome();b.renderAll();return {cases,ids:enemies.map((e:any)=>e.runtime.id),names:enemies.map((e:any)=>e.name),recovery:enemies.every((e:any)=>e.runtime.moves[2].effects.length===0)};
  });
  for(const c of parity.cases)expect(c.actual).toBe(c.predicted);expect(parity.recovery).toBe(true);expect(parity.ids.length).toBe(wins<2?2:3);
  expect(parity.names).toEqual(wins===0?['Captain','Watch']:wins===1?['Captain','Courier']:['Captain','Watch','Courier']);
  expect(parity.cases[1].cover).toBe(0);expect(parity.cases[1].force).toBe(0);expect(parity.cases[0].cover+parity.cases[0].force).toBeGreaterThan(0);
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`rival-${size.width}.png`)});}
  const result=await page.evaluate(resolveScriptedBattle,'balanced');await info.attach('rival-mechanics',{body:JSON.stringify(result),contentType:'application/json'});expect(result.mode).not.toBe('battle');expect(result.decisions.length).toBeGreaterThan(1);
});

for(const story of ['chorus-line','clean-cut'])test(`Flock Identity ${story} records live progress and keeps its narrative seal after reload`,async({page},info)=>{
  await battle(page,story==='chorus-line'?'spark_caller':'talon');
  const result=await page.evaluate(story=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.flyway.story=story;b.enemies[0].hp=b.enemies[0].maxHp=200;
    if(story==='chorus-line'){b.spark=3;b.spendResonance(3);}else{b.enemies[0].weak=1;b.damageEnemy(b.enemies[0].id,1,'Story fixture',b.allDeckCards().find((c:any)=>c.id==='swords_ace'));}
    const progress=story==='chorus-line'?b.flyway.resonanceSpent:b.flyway.windedHits;
    // Explicit ending-boundary fixture; unit cases cover incomplete/defeat thresholds.
    b.flyway.resonanceSpent=12;b.flyway.windedHits=12;b.flyway.leaderCalls=3;b.flyway.rivalWins=3;b.flyway.restored=[0,1,2,3];b.mode='runComplete';b.emitRunSummary('win');b.renderAll();return {progress,complete:b.flyway.storyComplete};
  },story);expect(result.progress).toBe(story==='chorus-line'?3:1);expect(result.complete).toBe(true);
  await page.reload();await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);await expect(page.locator('#flyway-launch')).toBeVisible();await page.keyboard.press('j');await page.getByRole('button',{name:'Flight journal',exact:true}).click();
  await expect(page.getByRole('heading',{name:story==='chorus-line'?'Every roof answers':'A path for smaller wings',exact:true})).toBeVisible();await expect(page.getByText(/Having yielded three wagers/)).toBeVisible();
  await expect(page.getByText(story==='chorus-line'?'Answering Chorus · amber wave journal seal':'Clear Passage · silver quill journal seal',{exact:true})).toBeVisible();
  for(const size of sizes){await page.setViewportSize(size);await page.getByRole('heading',{name:story==='chorus-line'?'Every roof answers':'A path for smaller wings',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`story-${size.width}.png`)});}
});

test('Flock Identity signatures and pacing stay bounded, support reduced motion and clean up',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await battle(page);
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').identityPacing.decisionMs)).toBeGreaterThan(0);
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.enemies=b.enemies.slice(0,1);b.enemies[0].hp=1;});
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').identityPacing.cleanupMs)).toBeGreaterThan(0);
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').mode='cardReward');
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').identityPacing.rewardMs)).toBeGreaterThan(0);
  await page.keyboard.press('j');await expect(page.locator('#flyway-book')).toBeVisible();
  const rewardBefore=await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').identityPacing.rewardMs);
  await page.waitForTimeout(600);
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').identityPacing.rewardMs)).toBe(rewardBefore);
  await page.keyboard.press('Escape');await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').mode='battle');
  const before=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');for(let i=0;i<30;i++){b.events.emit('flyway-call','Neighborhood Rally');b.events.emit('flyway-combination',{id:'brace-cut',name:'Brace & Cut'});}const roots=b.fxLayer.list.filter((o:any)=>o.name?.startsWith('identity-signature'));return {count:roots.length,tweens:roots.flatMap((o:any)=>o.list).reduce((n:number,o:any)=>n+b.tweens.getTweensOf(o).length,0),pacing:{...b.identityPacing}};});
  expect(before.count).toBeLessThanOrEqual(2);expect(before.tweens).toBe(0);await info.attach('native-clock-observation',{body:JSON.stringify(before.pacing),contentType:'application/json'});
  await page.setViewportSize(sizes[0]);await page.screenshot({path:info.outputPath('reduced-signatures.png')});
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').fxLayer.list.filter((o:any)=>o.name?.startsWith('identity-signature')).length)).toBe(0);
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').scene.stop());await expect(page.locator('#identity-call')).toHaveCount(0);await expect(page.locator('#identity-sequence')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').events.listenerCount('flyway-call'))).toBe(0);
});

for(const [story,title,leader] of [['chorus-line','Every Roof Answers','spark_caller'],['clean-cut','A Path Through the Watch','talon']])test(`Flock Identity ${story} launch honors unlocks, exact seeds and active-flight protection`,async({page})=>{
  await page.goto('./');await expect(page.locator('#flyway-launch')).toBeVisible();await page.keyboard.press('j');
  let box=page.locator('section').filter({has:page.getByRole('heading',{name:title,exact:true})});
  // Spark-Caller is a starting Leader; Talon follows the existing unlock gate.
  if(leader==='talon')await expect(box.getByRole('button',{name:'Begin Flight Story'})).toBeDisabled();else await expect(box.getByRole('button',{name:'Begin Flight Story'})).toBeEnabled();await page.keyboard.press('Escape');
  await page.evaluate(leader=>{const a=JSON.parse(localStorage.getItem('birdsquad.account')??'{}');a.unlockedLeaders=[...new Set([...(a.unlockedLeaders??[]),leader])];localStorage.setItem('birdsquad.account',JSON.stringify(a));},leader);
  await page.reload();await expect(page.locator('#flyway-launch')).toBeVisible();await page.keyboard.press('j');box=page.locator('section').filter({has:page.getByRole('heading',{name:title,exact:true})});await box.getByRole('button',{name:'Begin Flight Story'}).click();await readyRoute(page);
  const saved=await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene').runState;return {story:r.flyway.story,seed:r.seed,leader:r.leaderId,difficulty:r.difficulty,mode:r.runMode};});expect(saved).toEqual({story,seed:`story-${story}-v1`,leader,difficulty:0,mode:'full'});
  await page.reload();await expect(page.locator('#flyway-launch')).toBeVisible();await page.keyboard.press('j');await expect(page.getByRole('button',{name:'Begin Flight Story'})).toHaveCount(5);for(const b of await page.getByRole('button',{name:'Begin Flight Story'}).all())await expect(b).toBeDisabled();
  await page.keyboard.press('Escape');await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').continueRun());await readyRoute(page);expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.flyway.story)).toBe(story);
});

test('Flock Identity familiar recovery trims empty staging while retaining first-read and cinematic timing',async({page},info)=>{
  await battle(page,'fledgling',0);
  const timing=await page.evaluate(async()=>{
    localStorage.setItem('birdsquad.combatPace','standard');localStorage.setItem('birdsquad.motionPreference','full');
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),e=b.enemies[0],move=e.runtime.moves[2];
    const first=b.combatFxModule.enemyMoveTimings(b,e,move);b.runSeenEnemyMoves.add(b.enemyMovePacingKey(e,move));
    const repeat=b.combatFxModule.enemyMoveTimings(b,e,move),scale=b.enemyMoveTimingScale(e,move);
    const prior={windup:b.combatTimingDelay(1800,scale),release:b.combatTimingDelay(550,scale),anticipation:b.combatTimingDelay(0,scale),impact:b.combatTimingDelay(650,scale),recovery:b.combatTimingDelay(240,scale)};
    localStorage.setItem('birdsquad.combatPace','cinematic');const cinematic=b.combatFxModule.enemyMoveTimings(b,e,move);localStorage.setItem('birdsquad.combatPace','standard');
    b.enemies=b.enemies.slice(0,1);e.intentIndex=2;b.combatAnimationPending=true;const started=performance.now();await new Promise<void>(resolve=>b.resolveEnemyTurnAnimated(resolve));const elapsed=performance.now()-started;b.combatAnimationPending=false;b.renderAll();
    return {first,repeat,prior,cinematic,elapsed,pacing:b.identityPacing};
  });
  await info.attach('recovery-timing',{body:JSON.stringify(timing),contentType:'application/json'});
  expect(timing.first.windup).toBeGreaterThan(timing.repeat.windup);expect(timing.repeat.windup).toBeLessThan(timing.prior.windup);expect(timing.repeat.impact).toBe(timing.prior.impact);expect(timing.cinematic.windup).toBe(2600);expect(timing.elapsed).toBeGreaterThan(100);expect(timing.pacing.animationMs).toBeGreaterThan(0);
});

test('Flock Identity five Calls and three combinations have bounded signature presentation',async({page},info)=>{
  await battle(page);
  for(const [leader,kind,name] of [['fledgling','call','Neighborhood Rally'],['spark_caller','call','Chorus Break'],['talon','call','Decisive Dive'],['tidewarden','call','Sheltering Sweep'],['roostkeeper','call','Return the Pressure'],['fledgling','brace-cut','Brace & Cut'],['fledgling','rain-chorus','Rain Chorus'],['fledgling','safe-landing','Safe Landing']]){
    const result=await page.evaluate(({leader,kind,name})=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.fxLayer.list.filter((o:any)=>o.name?.startsWith('identity-signature')).forEach((o:any)=>o.destroy(true));b.runLeaderId=leader;const before={...(window as any).__birdSquadAudio().cueRequests};if(kind==='call')b.events.emit('flyway-call',name);else b.events.emit('flyway-combination',{id:kind,name});const root=b.fxLayer.getByName(`identity-signature-${kind}`);b.time.paused=true;b.tweens.pauseAll();return {children:root?.list.length,caption:root?.list.find((o:any)=>o.text)?.text,audio:JSON.stringify(before)!==JSON.stringify((window as any).__birdSquadAudio().cueRequests),protected:b.fxLayer.depth<b.root.depth};},{leader,kind,name});
    expect(result.children).toBeLessThanOrEqual(5);expect(result.caption).toBe(name);expect(result.audio).toBe(true);expect(result.protected).toBe(true);
    await page.setViewportSize(sizes[0]);await page.screenshot({path:info.outputPath(`${leader}-${kind}.png`)});
    await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.time.paused=false;b.tweens.resumeAll();});
  }
});

test('Flock Identity controller opens the focused Call and commits without playing a card',async({page})=>{
  await battle(page);await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.flightCombat.charge=3;(window as any).identityPad=[];Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[{index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:(window as any).identityPad.includes(i),value:(window as any).identityPad.includes(i)?1:0}))}]});});
  const press=async(id:number)=>{await page.evaluate(id=>{(window as any).identityPad=[id];},id);await page.waitForTimeout(120);await page.evaluate(()=>{(window as any).identityPad=[];});await page.waitForTimeout(120);};
  const before=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {energy:b.energy,hand:b.hand.length,turn:b.turn};});
  await press(8);await expect(page.getByRole('button',{name:'Use Leader call',exact:true})).toBeFocused();await press(0);await expect(page.locator('#flyway-book')).toHaveCount(0);
  expect(await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {energy:b.energy,hand:b.hand.length,turn:b.turn,calls:b.flyway.leaderCalls};})).toEqual({...before,energy:before.energy+2,calls:1});
});
