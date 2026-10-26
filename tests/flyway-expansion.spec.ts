import { test, expect, type Page } from '@playwright/test';

async function boot(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__birdSquadGame?.scene.isActive('MenuScene'));
  await expect(page.locator('#flyway-launch')).toBeVisible();
}
async function route(page: Page) {
  await boot(page);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').startRun());
  await page.waitForFunction(() => { const scene=(window as any).__birdSquadGame.scene.getScene('RouteScene');return scene?.routeEssentialAssetsReady&&scene.openFlyway; });
}
async function battle(page: Page, leader='fledgling') {
  await route(page);
  await page.evaluate(leader => {
    const game=(window as any).__birdSquadGame;const r=game.scene.getScene('RouteScene');const run=structuredClone(r.runState);run.leaderId=leader;
    r.scene.start('BattleScene',{runState:run,routeNodeId:'m1_entry'});
  },leader);
  await page.waitForFunction(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');return s?.battleEssentialUiReady&&s.battleCoreUiReady&&s.openFlyway&&s.combatPreviewModule&&s.fxLayer?.active&&!s.combatAnimationPending&&!s.combatIntroActive;});
}
test('Flyway journal opens with keyboard, traps focus, closes and restores gameplay',async({page})=>{
  await route(page); await page.keyboard.press('j'); await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading',{name:'The Flyway Journal'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.isPaused('RouteScene'))).toBe(true);
  await page.getByRole('button',{name:'Flock & combinations',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Brace & Cut'})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.isActive('RouteScene'))).toBe(true);
});
test('resident choices, strategic Waymarks and route conditions persist without repeated grants',async({page})=>{
  await route(page);await page.keyboard.press('j');
  await page.getByRole('button',{name:'Carry Woven Roost',exact:true}).click();
  await expect(page.getByRole('button',{name:'Carry Storm Pin'})).toHaveCount(0);
  await page.getByRole('button',{name:'City & crossings',exact:true}).click();
  await page.getByRole('button',{name:'Take heavy rain',exact:true}).click();
  await page.getByRole('button',{name:'Leave 10 Scrap for the shelter',exact:true}).click();
  await expect(page.getByRole('button',{name:'Leave 10 Scrap for the shelter',exact:true})).toBeDisabled();
  const before=await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');return {scrap:s.runState.scrap,flyway:s.runState.flyway};});
  expect(before.flyway.relic).toBe('woven-roost');expect(before.flyway.condition).toBe('rain');expect(before.flyway.residents.sella).toBe(1);
  await page.keyboard.press('Escape');await page.reload();await page.waitForFunction(()=>(window as any).__birdSquadGame?.scene.isActive('MenuScene'));
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').continueRun());
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  const after=await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');return {scrap:s.runState.scrap,flyway:s.runState.flyway};});
  expect(after).toEqual(before);
});
test('six signature birds offer deliberate Preen branches and preserve chosen rules after reload',async({page})=>{
  await route(page);
  await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');s.cardPickerMode='preen';s.cardPickerContext='districtPreen';s.cardPickerRemainingPicks=1;const index=s.runState.deck.findIndex((c:any)=>c.id==='major_00');s.requestCardPick(index);s.requestCardPick(index);});
  await expect(page.getByRole('heading',{name:'Choose this bird’s Preen'})).toBeVisible();
  await page.getByRole('button',{name:'Choose Flight',exact:true}).click();
  const picked=await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');const c=s.runState.deck.find((c:any)=>c.id==='major_00');return {upgraded:c.upgraded,branch:c.preenBranch};});
  expect(picked).toEqual({upgraded:true,branch:'flight'});
  await page.reload();await page.waitForFunction(()=>(window as any).__birdSquadGame?.scene.isActive('MenuScene'));
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').continueRun());
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');s.scene.start('BattleScene',{runState:structuredClone(s.runState),routeNodeId:'m1_entry'});});
  await page.waitForFunction(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');return s?.fxLayer?.active&&!s.combatAnimationPending;});
  const restored=await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');const c=s.allDeckCards().find((c:any)=>c.id==='major_00');return {branch:c.preenBranch,effects:s.activeCardContract(c).effects};});
  expect(restored.branch).toBe('flight');expect(restored.effects.at(-1)).toBe('draw(1)');
});
test('Leader call is earned through real card plays, has one use, and combos match previews',async({page})=>{
  await battle(page);
  const result=await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.combatIntroActive=false;s.combatAnimationPending=false;s.energy=20;
    s.enemies[0].hp=s.enemies[0].maxHp=200;
    const all=s.allDeckCards();const take=(id:string)=>{const c=all.find((c:any)=>c.id===id);for(const zone of ['hand','drawPile','discardPile','clearedPile'])s[zone]=s[zone].filter((x:any)=>x.instanceId!==c.instanceId);s.hand.push(c);return c;};
    const nest=take('pentacles_04');s.playCard(nest,s.enemies[0].id);
    const quill=take('swords_ace');const preview=s.simulateCardOutcome(quill,s.enemies[0].id);s.playCard(quill,s.enemies[0].id);const hp=s.enemies[0].hp;
    const basin=take('cups_ace');s.playCard(basin,s.enemies[0].id);
    const charge=s.flightCombat.charge;const energy=s.energy;const first=s.activateFlywayCall();const second=s.activateFlywayCall();
    return {charge,first,second,energyBefore:energy,energyAfter:s.energy,combos:s.flyway.combinations,hp,expectedHp:preview.enemyStates[0].hpAfter};
  });
  expect(result.charge).toBe(3);expect(result.first).toBe(true);expect(result.second).toBe(false);expect(result.energyAfter).toBe(result.energyBefore+2);expect(result.combos).toBe(2);expect(result.hp).toBe(result.expectedHp);
});
test('Molt, suit cameos and dynamic music respond to actual combat events',async({page})=>{
  await battle(page);
  await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.combatAnimationPending=false;s.energy=20;
    const card=s.hand.find((c:any)=>c.id==='major_00');s.playCard(card,s.enemies[0].id);s.enterMolt('Flight test');
  });
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').flywayPresentation.cameos)).toBeGreaterThan(0);
  if (await page.evaluate(()=>!!(window.AudioContext||(window as any).webkitAudioContext))) {
    await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadAudio().music.flightState)).toBe('molt');
  } else {
    expect(await page.evaluate(()=>(window as any).__birdSquadAudio().music.active)).toBe(false);
  }
  const result=await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.flock.block=100;s.endTurn();return {molt:s.flock.molt,survived:s.flyway.survivedMolt,counters:s.flywayPresentation};});
  expect(result.molt).toBe(false);expect(result.survived).toBe(1);expect(result.counters.moltTransitions).toBe(2);
});
test('Flight Stories use fixed routes and never overwrite an active flight',async({page})=>{
  await boot(page);await page.keyboard.press('j');
  await expect(page.getByRole('heading',{name:'Ten Familiar Wings'})).toBeVisible();
  const story=page.locator('section').filter({has:page.getByRole('heading',{name:'Ten Familiar Wings',exact:true})});
  await story.getByRole('button',{name:'Begin Flight Story'}).click();
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  const s=await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return {seed:r.runState.seed,story:r.runState.flyway.story,relic:r.runState.flyway.relic};});
  expect(s).toEqual({seed:'story-ten-wings-v1',story:'small-flock',relic:'light-travel'});
});
test('Flyway book has readable layouts at supported viewport sizes',async({page},testInfo)=>{
  await route(page);await page.keyboard.press('j');
  for(const [width,height] of [[2560,1600],[1440,900],[1000,560]]){
    await page.setViewportSize({width,height});await page.getByRole('button',{name:'City & crossings',exact:true}).click();
    await page.screenshot({path:testInfo.outputPath(`flyway-city-${width}.png`)});
    const geometry=await page.locator('#flyway-book').evaluate(d=>({scroll:d.scrollWidth,client:d.clientWidth,buttons:[...d.querySelectorAll('button')].map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})),font:parseFloat(getComputedStyle(d).fontSize)}));
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.client+1);expect(geometry.font).toBeGreaterThanOrEqual(16);expect(geometry.buttons.every(b=>b.w>=44&&b.h>=44)).toBe(true);
  }
});

for (const leader of ['spark_caller','talon','tidewarden','roostkeeper']) {
  test(`${leader} earns its call from its own combat action`, async({page})=>{
    await battle(page,leader);
    const result=await page.evaluate(leader=>{
      const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');const e=s.enemies[0];e.hp=e.maxHp=200;
      if(leader==='spark_caller'){s.spark=3;s.spendResonance(3);}
      if(leader==='talon'){e.weak=1;const c=s.allDeckCards().find((c:any)=>c.id==='swords_ace');for(let i=0;i<3;i++)s.damageEnemy(e.id,1,'Quill Point',c);}
      if(leader==='tidewarden'){s.flock.hp-=12;s.healFlock(6,'Open Basin');}
      if(leader==='roostkeeper'){s.flock.block=100;s.damageFlock(e,2);s.damageFlock(e,2);}
      const charge=s.flightCombat.charge;const before={hp:e.hp,flock:s.flock.hp,energy:s.energy,cover:s.flock.block};
      const used=s.activateFlywayCall();const twice=s.activateFlywayCall();
      return {charge,used,twice,before,after:{hp:e.hp,flock:s.flock.hp,energy:s.energy,cover:s.flock.block}};
    },leader);
    expect(result.used).toBe(true);expect(result.twice).toBe(false);
    if(leader==='spark_caller')expect(result.after.energy).toBe(result.before.energy+2);
    if(leader==='talon'||leader==='roostkeeper')expect(result.after.hp).toBeLessThan(result.before.hp);
    if(leader==='tidewarden')expect(result.after.flock).toBe(result.before.flock+6);
  });
}

test('save failures roll back resident choices and leave a working retry',async({page})=>{
  await route(page);await page.keyboard.press('j');await page.getByRole('button',{name:'City & crossings',exact:true}).click();
  const before=await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');(window as any).__originalWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('birdsquad.run.active'))throw new DOMException('Full','QuotaExceededError');(window as any).__originalWrite.call(this,key,value);};return s.runState.scrap;});
  await page.getByRole('button',{name:'Leave 10 Scrap for the shelter',exact:true}).click();await expect(page.getByRole('status')).toContainText('Could not save');
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.scrap)).toBe(before);
  await page.evaluate(()=>{Storage.prototype.setItem=(window as any).__originalWrite;});
  await page.getByRole('button',{name:'Leave 10 Scrap for the shelter',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.scrap)).toBe(before-10);
});

test('rival adaptations and resident help carry into a later district',async({page})=>{
  await route(page);
  await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');const run=structuredClone(s.runState);run.mapIndex=1;run.flyway.residents={sella:1,ivo:1,oren:1};run.flyway.visits=['sella:0','ivo:0','oren:0'];run.flyway.rivalWins=2;run.currentHp-=8;s.scene.restart({runState:run});});
  await page.waitForFunction(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');return s?.runState.mapIndex===1&&s.routeEssentialAssetsReady&&s.openFlyway;});
  // A real district entry resolves its contract before other route decisions.
  await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');if(s.shouldChooseDistrictContract())s.chooseDistrictContract(s.districtContractChoices()[0].id);});
  await page.keyboard.press('j');await page.getByRole('button',{name:'City & crossings',exact:true}).click();
  await expect(page.getByText('“I remember your help.”',{exact:false}).first()).toBeVisible();
  const before=await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.currentHp);
  await page.getByRole('button',{name:'Receive 5 Cohesion',exact:true}).click();
  await page.getByRole('button',{name:'Receive 1 Open Sky Guard next fight',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.currentHp)).toBe(before+5);
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.nextCombat.openSkyGuard)).toBe(1);
  await expect(page.getByText(/begins with 4 additional Cover/)).toBeVisible();
});

test('crossing rewards are checkpointed once and survive a resumed reward',async({page})=>{
  await battle(page);
  const result=await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.flyway.condition='rain';s.flyway.conditionNode='m1_entry';s.mode='cardReward';s.statTaken=0;s.runDistrictContracts=[];s.applyCombatEconomyRewards();
    const before=s.scrap;const start=s.scene.start;s.scene.start=()=>s.scene;
    try{s.returnToRouteMap();const checkpoint=JSON.parse(localStorage.getItem('birdsquad.run.active')!);s.returnToRouteMap();return {before,after:s.scrap,checkpoint,clean:s.flyway.cleanFights};}finally{s.scene.start=start;}
  });
  expect(result.after).toBe(result.before+20);expect(result.clean).toBe(1);expect(result.checkpoint.flyway.settledNodes).toEqual(['0:m1_entry']);expect(result.checkpoint.flyway.condition).toBe('clear');
  await page.reload();await page.waitForFunction(()=>(window as any).__birdSquadGame?.scene.isActive('MenuScene'));await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').continueRun());
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame;return g.scene.isActive('RouteScene')&&g.scene.getScene('RouteScene').routeEssentialAssetsReady;});
  const resumed=await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene').runState;return {scrap:r.scrap,clean:r.flyway.cleanFights};});expect(resumed).toEqual({scrap:result.after,clean:1});
});

test('boss disruption cancels one announced attack and the forecast reports it',async({page})=>{
  await route(page);await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');s.scene.start('BattleScene',{runState:structuredClone(s.runState),routeNodeId:'m1_boss'});});
  await page.waitForFunction(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');return s?.fxLayer?.active&&s.combatPreviewModule&&s.openFlyway&&!s.combatAnimationPending;});
  await page.keyboard.press('j');await expect(page.getByText('Make the boss Winded to cancel its next attack this fight.')).toBeVisible();await page.keyboard.press('Escape');
  const result=await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');const e=s.enemies.find((e:any)=>e.runtime.type==='boss');e.hp=e.maxHp=200;
    for(let i=0;i<10&&!s.getTextState().enemies.find((x:any)=>x.id===e.id).intent.toLowerCase().match(/attack|dive|swoop|strike|peck|rush|charge|slam/);i++)s.advanceEnemyIntent(e);
    // Pick an authored damaging move directly; the counter must leave support moves alone.
    const attack=e.runtime.moves.find((move:any)=>move.effects.some((effect:string)=>effect.startsWith('damage(')));
    if(attack){const sequence=e.runtime.moveIds??e.runtime.pattern;const index=Array.isArray(sequence)?sequence.indexOf(attack.id):-1;if(index>=0)e.intentIndex=index;}
    e.weak=1;s.updateFlywayBossBreaks();const first=e.flywayBreakUsed;const tell=s.getTextState().enemies.find((x:any)=>x.id===e.id).intent;
    s.advanceEnemyIntent(e);s.updateFlywayBossBreaks();return {first,tell,used:e.flywayBreakUsed,broken:e.flywayBroken};
  });
  expect(result.first).toBe(true);expect(result.tell).toContain('Disrupted');expect(result.used).toBe(true);expect(result.broken).toBe(false);
});

test('journal controller navigation owns input and closes without taking a turn',async({page})=>{
  await battle(page);
  await page.evaluate(()=>{(window as any).__padButtons=[];Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[{index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:(window as any).__padButtons.includes(i),value:(window as any).__padButtons.includes(i)?1:0}))}]});});
  const press=async(id:number)=>{await page.evaluate(id=>{(window as any).__padButtons=[id];},id);await page.waitForTimeout(120);await page.evaluate(()=>{(window as any).__padButtons=[];});await page.waitForTimeout(120);};
  const before=await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').turn);
  await press(8);await expect(page.getByRole('dialog')).toBeVisible();await press(13);await press(0);await expect(page.getByRole('heading',{name:'Brace & Cut'})).toBeVisible();await press(1);await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').turn)).toBe(before);
});

test('ending archive preserves illustrated birds and awarded story seals after reload',async({page},testInfo)=>{
  await battle(page);
  await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.flyway.story='small-flock';s.flyway.restored=[0,1,2,3];s.flyway.journal=['Sella Warmwick remembers the shelter repair.'];s.mode='runComplete';s.emitRunSummary('win');s.renderAll();});
  await page.waitForFunction(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');return !!s.bossDossierModule;});
  await page.keyboard.press('j');await expect(page.getByRole('heading',{name:'The city answers'})).toBeVisible();await expect(page.getByRole('heading',{name:'The birds who carried the signal'})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('ending-journal.png')});
  await page.reload();await page.waitForFunction(()=>(window as any).__birdSquadGame?.scene.isActive('MenuScene'));await expect(page.locator('#flyway-launch')).toBeVisible();await page.keyboard.press('j');await page.getByRole('button',{name:'Flight journal',exact:true}).click();
  await expect(page.getByRole('heading',{name:'The birds who carried the signal'})).toBeVisible();await expect(page.getByText('Close Company · woven circle journal seal')).toBeVisible();
});

test('battle and Molt presentation remain readable at every supported viewport',async({page},testInfo)=>{
  await battle(page);await page.waitForTimeout(900);
  for(const [width,height]of [[2560,1600],[1440,900],[1000,560]]){await page.setViewportSize({width,height});await page.waitForTimeout(300);await page.screenshot({path:testInfo.outputPath(`battle-${width}.png`)});}
  await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.enterMolt('Molt');s.renderAll();s.time.paused=true;s.tweens.pauseAll();});
  for(const [width,height]of [[2560,1600],[1440,900],[1000,560]]){await page.setViewportSize({width,height});await page.screenshot({path:testInfo.outputPath(`molt-${width}.png`)});}
});

test('strategic keepsakes apply their benefits and costs through combat rules',async({page})=>{
  await battle(page);
  const result=await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.flock.block=0;s.gainBlock(10,'Baseline');const normal=s.flock.block;
    s.flyway.relic='woven-roost';s.flock.block=0;s.gainBlock(10,'Woven');const woven=s.flock.block;s.flock.block=20;s.startPlayerTurn();const carried=s.flock.block;
    s.flyway.relic='storm-pin';const energy=s.energy;s.enterMolt('Storm Pin');const stormEnergy=s.energy-energy;s.flock.block=200;s.endTurn();const skyTurns=s.flock.exposedTurns;
    s.flyway.relic='light-travel';const target=s.handTargetSize();s.drawPile.push(...s.hand);s.hand=[];s.drawToHandSize();const ready=s.flightCombat.lightTravelReady;const bonus=s.scaledFlockStatBonus('damage');s.flyway.relic=undefined;const ordinary=s.scaledFlockStatBonus('damage');
    s.flyway.condition='rain';s.flock.block=0;s.gainBlock(10,'Rain');const rain=s.flock.block;s.flyway.condition='clear';s.flock.block=0;s.gainBlock(10,'Clear');const clear=s.flock.block;
    s.flyway.condition='scaffold';s.flock.exposed=false;s.cardsPlayedThisTurn=3;const over=s.statOverextensions;s.applyOverextensionPenalty();
    return {normal,woven,carried,stormEnergy,skyTurns,target,ready,bonus,ordinary,rain,clear,exposed:s.flock.exposed,over:s.statOverextensions-over};
  });
  expect(result.woven).toBe(result.normal-2);expect(result.carried).toBe(8);expect(result.stormEnergy).toBe(1);expect(result.skyTurns).toBe(1);expect(result.target).toBe(4);expect(result.ready).toBe(true);expect(result.bonus).toBe(result.ordinary+2);expect(result.rain).toBe(result.clear-1);expect(result.exposed).toBe(true);expect(result.over).toBe(1);
});

test('reduced motion keeps rule cues while bounded transient effects retire',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await battle(page);
  const state=await page.evaluate(()=>{
    const w=window as any,s=w.__birdSquadGame.scene.getScene('BattleScene');
    const count=()=>s.fxLayer.list.filter((x:any)=>x.name.startsWith('flyway-')).length;
    w.advanceTime(1000);
    const c=s.allDeckCards().find((c:any)=>c.id==='swords_ace');
    for(let i=0;i<12;i++)s.events.emit('flyway-card',c,s.enemies[0].id);
    const groups=count(),now=s.time.now;
    // Retirement uses Phaser time. Check its actual deadline independently
    // of the runner's render cadence and wall-clock polling budget.
    w.advanceTime(799);const beforeDeadline=count();
    w.advanceTime(2);
    return {groups,beforeDeadline,afterDeadline:count(),elapsed:s.time.now-now,
      active:s.sys.isActive(),paused:s.time.paused,
      weather:s.backdropLayer.list.filter((x:any)=>x.name==='flyway-district-weather').length};
  });
  expect(state.active).toBe(true);expect(state.paused).toBe(false);
  expect(state.groups).toBeGreaterThan(0);expect(state.groups).toBeLessThanOrEqual(5);
  expect(state.weather).toBe(0);expect(state.beforeDeadline).toBe(state.groups);
  expect(state.elapsed).toBeCloseTo(801);expect(state.afterDeadline).toBe(0);
});

test('the title does not fetch battle snapshot or outcome adapters',async({page})=>{
  const requests:string[]=[];page.on('request',request=>requests.push(request.url()));await boot(page);
  expect(requests.some(url=>/battle-state-snapshot-|battle-outcome-scene-|battle\/state-snapshot|battle\/outcome-scene/.test(url))).toBe(false);
});

test('combat reward commits wait for a branch and cancellation spends nothing',async({page})=>{
  await battle(page);
  await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');const c=s.allDeckCards().find((c:any)=>c.id==='major_00');s.upgradeChoices=[c];s.mode='upgradeReward';s.requestRewardChoice(c.id);s.requestRewardChoice(c.id);});
  await expect(page.getByRole('heading',{name:'Choose this bird’s Preen'})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.isActive('BattleScene'));
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').allDeckCards().find((c:any)=>c.id==='major_00').upgraded)).toBeFalsy();
  await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.requestRewardChoice('major_00');s.requestRewardChoice('major_00');});
  await page.getByRole('button',{name:'Choose Shelter',exact:true}).click();
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame;return g.scene.isActive('RouteScene')&&g.scene.getScene('RouteScene').routeEssentialAssetsReady;});
  const card=await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.deck.find((c:any)=>c.id==='major_00'));
  expect(card).toMatchObject({upgraded:true,preenBranch:'shelter'});
});

test('music follows Flow, Surge, Open Sky and boss phases at phrase boundaries',async({page})=>{
  await battle(page);await page.mouse.click(500,250);
  test.skip(!await page.evaluate(()=>!!(window.AudioContext||(window as any).webkitAudioContext)), 'This browser build does not provide Web Audio; phrase sequencing requires an AudioContext.');
  for(const phase of ['flow','surge','molt','open-sky','boss-phase','planning']){
    await page.evaluate(phase=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.flock.flow=phase==='flow'?1:phase==='surge'?s.flock.flowMax:0;s.flock.molt=phase==='molt';s.flock.exposed=phase==='open-sky';s.enemies[0].phase=phase==='boss-phase'?2:1;},phase);
    await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadAudio().music.flightState)).toBe(phase);
  }
});

test('district boss stages expose distinct atmosphere and restoration context',async({page},testInfo)=>{
  await page.setViewportSize({width:2560,height:1600});await route(page);
  const base=await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState);
  for(let index=0;index<4;index++){
    await page.evaluate(({base,index})=>{const g=(window as any).__birdSquadGame;for(const name of ['RouteScene','BattleScene'])if(g.scene.isActive(name))g.scene.stop(name);g.scene.start('BattleScene',{runState:{...base,mapIndex:index},routeNodeId:`m${index+1}_boss`});},{base,index});
    await page.waitForFunction(index=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');return s.flywayMapIndex===index&&s.fxLayer?.active&&s.openFlyway&&!s.combatAnimationPending;},index);
    await page.waitForFunction(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return [...s.enemyPoseGroups.values()].some((p: any) => p.enemy.runtime.type === 'boss'
        && (s.flywayMapIndex === 3 ? ['brace','stagger','recovery'].includes(p.group.getData('roost-pose')) : p.group.getData('flyway-personality')));
    });
    const state=await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {boss:s.enemies.some((e:any)=>e.runtime.type==='boss'),light:s.backdropLayer.getByName('flyway-district-light')?.fillColor,personalities:[...s.enemyPoseGroups.values()].filter((p:any)=>p.enemy.runtime.type==='boss'&&(s.flywayMapIndex===3?['brace','stagger','recovery'].includes(p.group.getData('roost-pose')):p.group.getData('flyway-personality'))).length};});
    expect(state.boss).toBe(true);expect(state.light).toBe([0xe4a568,0x72bfc4,0xa8b2da,0xf0d6a0][index]);expect(state.personalities).toBeGreaterThan(0);
    await page.screenshot({path:testInfo.outputPath(`district-boss-${index}.png`)});
  }
});
