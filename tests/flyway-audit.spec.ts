import { test, expect, type Page } from '@playwright/test';

async function boot(page: Page) {
  await page.goto('/');
  await expect(page.locator('#flyway-launch')).toBeVisible();
}
async function route(page: Page) {
  await boot(page);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').startRun());
  await page.waitForFunction(() => { const s=(window as any).__birdSquadGame.scene.getScene('RouteScene'); return s?.routeEssentialAssetsReady && s.openFlyway; });
}
async function battle(page: Page) {
  await route(page);
  await page.evaluate(() => {const s=(window as any).__birdSquadGame.scene.getScene('RouteScene'); s.scene.start('BattleScene',{runState:structuredClone(s.runState),routeNodeId:'m1_entry'});});
  await page.waitForFunction(() => {const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');return s?.openFlyway && s.combatPreviewModule && s.fxLayer?.active && !s.combatIntroActive && !s.combatAnimationPending;});
}

test('audit: malformed archived birds cannot crash or trap the journal',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('birdsquad.flyway.journal',JSON.stringify({flyway:{restored:[0]},birds:[null,3,{id:'unknown'},{id:'major_00'}]})));
  await boot(page);await page.keyboard.press('j');await page.getByRole('button',{name:'Flight journal',exact:true}).click();
  await expect(page.getByRole('heading',{name:'First Flight',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);expect(errors).toEqual([]);
});

test('audit: journal preserves keyboard focus when changing sections',async({page})=>{
  await route(page);await page.keyboard.press('j');
  const tab=page.getByRole('button',{name:'City & crossings',exact:true});await tab.click();
  await expect(tab).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Flight Stories',exact:true})).toBeFocused();
});

test('audit: exit confirmation and recovery dialogs retain exclusive input',async({page})=>{
  await route(page);
  await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');s.confirmExitOpen=true;s.renderAll();});
  await page.keyboard.press('j');await expect(page.locator('#flyway-book')).toHaveCount(0);
  await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');s.confirmExitOpen=false;s.renderAll();const d=document.createElement('dialog');d.id='save-recovery';d.innerHTML='<button>Retry saving</button>';document.body.append(d);d.showModal();});
  await page.keyboard.press('j');await expect(page.locator('#flyway-book')).toHaveCount(0);await expect(page.locator('#save-recovery')).toBeVisible();
});

test('audit: Storm Pin forecast includes its Wingbeat only on entering Molt',async({page})=>{
  await battle(page);
  const result=await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.flyway.relic='storm-pin';s.energy=10;
    const card=s.hand[0];card.runtime={...card.runtime,effects:['enterMolt()'],moltEffects:['enterMolt()']};
    const preview=s.simulateCardOutcome(card,s.enemies[0].id);const before=s.energy;s.playCard(card,s.enemies[0].id);
    const actual=s.energy-before;const molted=s.flock.molt;const energy=s.energy;s.enterMolt('Already molting');return {expected:preview.energyDelta,actual,repeated:s.energy-energy,molted};
  });
  expect(result.molted).toBe(true);expect(result.actual).toBe(result.expected);expect(result.repeated).toBe(0);
});

test('audit: rain and Woven Roost reduce Waymark and overflow Cover consistently',async({page})=>{
  await battle(page);
  const result=await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.flyway.relic='woven-roost';s.flyway.condition='rain';s.flock.block=0;
    s.resolveMarkEffect('gainCover(5)','Audit');const mark=s.flock.block;s.flock.block=0;s.flock.hp=s.flock.maxHp;
    s.healFlock(5,'Audit',true);const overflow=s.flock.block;
    s.flock.block=0;const card=s.hand[0];card.runtime={...card.runtime,effects:['overhealCover(5)']};
    const preview=s.simulateCardOutcome(card,s.enemies[0].id);s.energy=10;s.playCard(card,s.enemies[0].id);
    return {mark,overflow,preview:preview.coverGain,actual:s.flock.block};
  });
  expect(result.mark).toBe(2);expect(result.overflow).toBe(2);expect(result.actual).toBe(result.preview);expect(result.preview).toBe(2);
});

test('audit: a failed journal download recovers through explicit checkpoint reload',async({page})=>{
  let failed=false;
  await page.route(/\/assets\/flyway-expansion-.*\.js$/,async r=>{if(!failed){failed=true;await r.abort('failed');}else await r.continue();});
  await page.goto('/');await expect(page.locator('#flyway-retry')).toBeVisible();
  await page.getByRole('button',{name:'Keep playing',exact:true}).click();
  await page.locator('#flyway-retry').click();
  await page.getByRole('button',{name:'Reload options',exact:true}).click();
  await page.getByRole('button',{name:'Reload saved checkpoint',exact:true}).click();
  await expect(page.locator('#flyway-launch')).toBeVisible({timeout:10000});
  await page.keyboard.press('j');await expect(page.getByRole('heading',{name:'The Flyway Journal'})).toBeVisible();
});

test('audit: phase-change disruption forecast uses the new first boss intent',async({page})=>{
  await battle(page);
  const result=await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');const enemy=s.enemies[0];
    enemy.runtime={...enemy.runtime,type:'boss',phaseTwoMoveIds:['audit-hit','audit-guard'],moves:[{id:'audit-hit',label:'Attack',effects:['damage(flock,5)']},{id:'audit-guard',label:'Cover',effects:['gainCover(5)']}],attackPattern:{type:'cycle',moveIds:['audit-hit','audit-guard']}};
    enemy.phase=1;enemy.intentIndex=1;enemy.maxHp=100;enemy.hp=51;enemy.block=0;enemy.weak=1;
    const card=s.hand[0];card.runtime={...card.runtime,effects:['damage(3)']};s.energy=10;
    const preview=s.simulateCardOutcome(card,enemy.id);s.playCard(card,enemy.id);
    return {predicted:preview.bossDisruptions,actual:enemy.flywayBroken,name:enemy.name,index:enemy.intentIndex,hp:enemy.hp,phase:enemy.phase,played:s.cardsPlayedThisTurn,contract:s.activeCardContract(card)};
  });
  expect(result,result && JSON.stringify(result)).toMatchObject({actual:true,index:0,phase:2,played:1});expect(result.predicted).toContain(result.name);
});

test('audit: holding controller confirm after a Leader call cannot play a card',async({page})=>{
  await battle(page);
  await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.flightCombat.charge=3;
    (window as any).__padButtons=[];Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[{index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:(window as any).__padButtons.includes(i),value:(window as any).__padButtons.includes(i)?1:0}))}]});
  });
  await page.keyboard.press('j');await page.getByRole('button',{name:'Use Leader call',exact:true}).focus();
  const before=await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {energy:s.energy,played:s.cardsPlayedThisTurn};});
  await page.evaluate(()=>{(window as any).__padButtons=[0];});await page.waitForTimeout(400);
  await expect(page.locator('#flyway-book')).toHaveCount(0);
  const after=await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {energy:s.energy,played:s.cardsPlayedThisTurn,called:s.flightCombat.called};});
  expect(after).toEqual({energy:before.energy+2,played:before.played,called:true});
});

test('audit: failed outcome download keeps recovery and a safe menu exit available',async({page},testInfo)=>{
  await page.route(/\/assets\/battle-outcome-scene-.*\.js$/,r=>r.abort('failed'));
  await battle(page);
  await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.flock.hp=0;s.checkOutcome();s.renderAll();});
  await page.getByRole('button',{name:'Keep playing',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    const walk=(items:any[]):any[]=>items.flatMap(o=>[o,...walk(o.list??[])]);
    return walk(s.children.list).filter(o=>['pending-overlay-close','pending-overlay-recovery'].includes(o.name)&&o.input?.enabled&&o.getData('enabled')!==false).length;
  })).toBe(2);
  for(const [width,height] of [[2560,1600],[1440,900],[1000,560]]){
    await page.setViewportSize({width,height});await page.screenshot({path:testInfo.outputPath(`outcome-recovery-${width}.png`)});
  }
  const point=await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');const hit=s.root.getByName('pending-overlay').getByName('pending-overlay-close');const b=hit.getBounds();return {x:b.centerX,y:b.centerY};});
  const canvas=(await page.locator('canvas').boundingBox())!;
  await page.mouse.click(canvas.x+point.x*canvas.width/1280,canvas.y+point.y*canvas.height/720);
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.isActive('MenuScene'));
});

test('audit: a Winded Supply fulfills the boss disruption rule without an extra card',async({page})=>{
  await battle(page);
  const result=await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');const enemy=s.enemies[0];
    enemy.runtime={...enemy.runtime,type:'boss',attackPattern:{type:'cycle',moveIds:['audit-hit']},moves:[{id:'audit-hit',label:'Attack',effects:['damage(flock,5)']}]};
    s.runSupplies=['rooftop_decoy'];s.selectedEnemyId=enemy.id;s.useSupply(0);
    return {winded:enemy.weak,disrupted:enemy.flywayBroken,used:s.runSuppliesUsed};
  });
  expect(result.winded).toBeGreaterThan(0);expect(result.disrupted).toBe(true);expect(result.used).toContain('rooftop_decoy');
});
