import { test, expect, type Page } from '@playwright/test';
import { setTextureFilter } from '../src/game/texture-filter';
import { tacticalFormation } from '../src/game/tactical-formations';
import { settleCanvas } from './helpers/settled-canvas';

test('Tactical payoffs filtering skips unchanged pixels and handles replacements and data sources', () => {
  let uploads = 0;
  const texture: any = { source: [{scaleMode: 1}], dataSource: [{scaleMode: 1}], setFilter(mode: number) {
    uploads++; [...this.source, ...this.dataSource].forEach(s => s.scaleMode = mode);
  }};
  expect(setTextureFilter(texture, 1)).toBe(texture); expect(uploads).toBe(0);
  texture.dataSource[0].scaleMode = 0; setTextureFilter(texture, 1); expect(uploads).toBe(1);
  texture.source = [{scaleMode: 0}]; setTextureFilter(texture, 1); expect(uploads).toBe(2);
  setTextureFilter(texture, 0); expect(uploads).toBe(3);
  setTextureFilter(texture, 0); expect(uploads).toBe(3);
});

async function battle(page: Page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] }));
  await page.goto('./?flight=tactical-payoffs&length=full');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => { const g=(window as any).__birdSquadGame,r=g.scene.getScene('RouteScene'); return g.scene.isActive('RouteScene')&&r.routeEssentialAssetsReady; });
  await page.evaluate(() => { const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:'m1_entry'}); });
  await page.waitForFunction(() => { const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.combatPreviewModule&&b.battleHudRendererModule&&b.battleHandRendererModule&&!b.combatInteractionLocked(); });
}

for (const scenario of [
  {name:'Cover',effects:['gainCover(6)']},
  {name:'healing',effects:['heal(5)']},
  {name:'Winded',effects:['applyWinded(target, 2)']},
  {name:'Molt',effects:['enterMolt()','gainCover(6)']},
  {name:'overextension',effects:['gainCover(6)'],played:3},
  {name:'last kill',effects:['damage(target, 999)']},
  {name:'phase change',effects:['damage(target, 16)'],boss:true},
  {name:'disruption',effects:['applyWinded(target, 2)'],boss:true},
]) test(`Tactical payoffs survival matches actual ${scenario.name} then Roost`, async ({page}) => {
  await battle(page);
  const result=await page.evaluate(scenario=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.routeMarks=[];b.runLeaderId='fledgling';b.flyway.condition='clear';b.flyway.capstone=undefined;
    b.flock={...b.flock,hp:30,maxHp:50,block:0,molt:false,exposed:false,weak:0,regen:0,fouled:0};
    b.energy=3;b.cardsPlayedThisTurn=scenario.played??0;b.zeroCostThisTurn=0;
    b.enemies=[b.enemies[0]]; const enemy=b.enemies[0];
    enemy.hp=enemy.maxHp=30;enemy.block=0;enemy.weak=0;enemy.nextAttackBonus=0;
    enemy.runtime={...enemy.runtime,type:'street',moves:[{id:'test-strike',label:'Strike',effects:['damage(flock, 9)']}],attackPattern:{type:'cycle',moveIds:['test-strike']}};enemy.intentIndex=0;
    if(scenario.boss){enemy.runtime.type='boss';enemy.runtime.moves.push({id:'phase-two',label:'Phase II strike',effects:['damage(flock, 17)']});enemy.runtime.phaseTwoMoveIds=['phase-two'];enemy.phase=1;enemy.flywayBreakUsed=false;b.flywayMapIndex=0;}
    const c=b.hand[0];c.runtime={...c.runtime,kind:'skill',cost:1,suit:null,effects:scenario.effects,moltEffects:[],upgrade:{effects:scenario.effects}};c.upgraded=false;c.cost=1;
    b.hand=[c];b.drawPile=[];b.discardPile=[];b.selectedInstanceId=c.instanceId;
    const snapshot=()=>JSON.stringify({flock:b.flock,enemies:b.enemies,hand:b.hand,energy:b.energy,played:b.cardsPlayedThisTurn});
    const before=snapshot(),forecast=b.selectedCardOutcomePreview().survival,unchanged=before===snapshot();
    b.playCard(c,enemy.id,{resolveDelayMs:0});if(b.mode==='battle')b.endTurn();
    return {forecast,unchanged,hp:b.flock.hp,mode:b.mode};
  },scenario);
  expect(result.unchanged).toBe(true);
  expect(result.forecast.uncertainty).toEqual([]);
  expect(result.hp).toBe(result.forecast.remaining);
  if(scenario.name==='last kill')expect(result.forecast.detail).toContain('Combat ends before Roost');
});

test('Tactical payoffs uncertainty, cancellation and independent Roost remain honest',async({page})=>{
  await battle(page);
  const result=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),c=b.hand[0];b.selectedInstanceId=c.instanceId;
    c.runtime={...c.runtime,effects:['draw(1)'],moltEffects:[],cost:1};c.cost=1;c.upgraded=false;
    const draw=b.selectedCardOutcomePreview().survival;
    c.runtime.effects=['discard(1)','gainCover(99)'];
    const choice=b.selectedCardOutcomePreview().survival;
    c.runtime.effects=['gainCover(99)'];b.energy=0;
    const unaffordable=b.selectedCardOutcomePreview().survival;
    b.energy=3;b.renderAll();b.refreshCombatSelectionPreview();
    const selected=b.root.getByName('combat-roost-preview').text;
    b.selectedInstanceId=undefined;b.refreshCombatSelectionPreview();
    const cancelled=b.root.getByName('combat-roost-preview').text;
    b.selectedInstanceId=c.instanceId;const now=b.incomingFlockDamagePreview();
    let hp=b.flock.hp;const start=b.startPlayerTurn;
    b.startPlayerTurn=function(...args:any[]){hp=this.flock.hp;return start.apply(this,args);};
    b.endTurn();b.startPlayerTurn=start;
    return {draw,choice,unaffordable,selected,cancelled,now,hp};
  });
  expect(result.draw.uncertainty.join(' ')).toContain('Draw-dependent');
  expect(result.choice.after).toBeUndefined();expect(result.unaffordable.after).toBeUndefined();
  expect(result.selected).toContain('Then:');expect(result.cancelled).not.toContain('Then:');
  expect(result.hp).toBe(result.now.afterHp);
});

test('Tactical payoffs survival fits the existing Roost control at all supported sizes',async({page},info)=>{
  await battle(page);
  for(const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(size);
    await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.selectedInstanceId=b.hand[0].instanceId;b.renderAll();});
    await settleCanvas(page);
    const fit=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),t=b.root.getByName('combat-roost-preview'),box=b.root.getByName('combat-roost-hit').getBounds(),r=t.getBounds();return {text:t.text,fits:r.left>=box.left&&r.right<=box.right&&r.top>=box.top&&r.bottom<=box.bottom};});
    expect(fit.text).toContain('Then:');expect(fit.fits).toBe(true);
    await page.screenshot({path:info.outputPath(`survival-${size.width}.png`)});
  }
});

test('Tactical payoffs Quiet Beat supports interruption or prepared Cover with live parity',async({page})=>{
  await battle(page);
  const formation=tacticalFormation('enc_spire_quiet_beat',[{id:'test',health:34} as any]);
  const result=await page.evaluate(runtime=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),base=structuredClone(b.enemies[0]),flock=structuredClone(b.flock),out=[];
    for(const interrupt of [true,false]) {
      b.enemies=[{...structuredClone(base),runtime,hp:34,maxHp:34,intentIndex:0,block:0,nextAttackBonus:0,damageBonus:0,hitThisTurn:false}];
      b.flock={...flock,hp:40,maxHp:40,block:0,exposed:false};b.cardsPlayedThisTurn=0;b.energy=3;
      const c=structuredClone(b.allDeckCards()[0]);c.upgraded=false;c.cost=1;c.runtime={...c.runtime,kind:'skill',cost:1,suit:null,effects:interrupt?['damage(target, 4)']:['gainCover(4)'],moltEffects:[]};b.hand=[c];
      b.playCard(c,b.enemies[0].id,{resolveDelayMs:0});
      b.resolveEnemyTurn();const force=b.enemies[0].nextAttackBonus;
      b.enemies[0].intentIndex=1;b.flock.block=interrupt?10:13;
      const expected=b.enemyDamageProjection(b.enemies,b.flock,false);b.resolveEnemyTurn();
      out.push({interrupt,force,hp:b.flock.hp,expected:expected.afterHp});
    }
    return out;
  },formation[0]);
  expect(result.map(r=>r.force)).toEqual([0,3]);
  for(const row of result){expect(row.hp).toBe(40);expect(row.hp).toBe(row.expected);}
});

test('Tactical payoffs real actions defer coaching and history without hiding Tells',async({page},info)=>{
  await page.setViewportSize({width:2560,height:1600});await battle(page);
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').livingPerformances?.ready);
  const redundant=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.renderAll();let redundant=0;
    const originals:any[]=[];
    for(const t of Object.values(b.textures.list) as any[]){const fn=t.setFilter;originals.push([t,fn]);t.setFilter=function(mode:number){if([...t.source,...t.dataSource].every((s:any)=>s.scaleMode===mode))redundant++;return fn.call(this,mode);};}
    try{b.renderAll();b.renderAll();}finally{for(const [t,fn] of originals)t.setFilter=fn;}
    b.enemies.forEach((e:any)=>e.hp=e.maxHp=1000);b.energy=3;
    b.playCard(b.hand[0],b.enemies[0].id,{resolveDelayMs:450});return redundant;
  });
  expect(redundant).toBe(0);
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.motionPayoff&&!b.combatAnimationPending;});
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.time.paused=true;});
  await expect.poll(()=>page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.root.getByName('combat-log-latest')?.visible;})).toBe(false);
  const reading=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {reading:b.combatReading,vitals:b.root.list.filter((c:any)=>c.name==='combat-enemy-vitals').every((c:any)=>c.visible)};});
  expect(reading.vitals).toBe(true);expect(reading.reading.kind).toBe('resolved');
  await page.screenshot({path:info.outputPath('quiet-payoff-2560.png')});
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.motionPayoff.until=b.time.now-1;b.time.paused=false;});
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('combat-log-latest')?.visible)).toBe(true);
});

test('Tactical payoffs first earned Preen offers complementary strategy branches',async({page})=>{
  await battle(page);
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').flywayPreenRequest);
  await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    const c=b.allDeckCards().find((c:any)=>c.id==='swords_ace');
    b.mode='upgradeReward';b.upgradeChoices=[c];b.chooseUpgradeCard(c.id,true);
  });
  await expect(page.getByRole('button',{name:'Choose Storm Shelter',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Choose Patient Answer',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Choose Storm Shelter',exact:true}).click();
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.isActive('RouteScene'));
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.deck.find((c:any)=>c.id==='swords_ace').preenBranch)).toBe('build-storm');
});

test('Tactical payoffs interception ends combat before the surviving defender can attack',async({page})=>{
  await battle(page);
  const result=await page.evaluate(()=>{
    const w=window as any,b=w.__birdSquadGame.scene.getScene('BattleScene');
    w.__birdSquadCurrentMap().nodes.find((n:any)=>n.id==='m1_entry').payloadId='enc_signature_relay';
    const front=b.enemies[0],relay={...structuredClone(front),id:'relay-target',hp:4,maxHp:4,intentIndex:0};
    front.runtime={...front.runtime,moves:[{id:'heavy',label:'Heavy',effects:['damage(flock, 100)']}],attackPattern:{type:'cycle',moveIds:['heavy']}};
    b.enemies=[front,relay];b.selectedEnemyId=relay.id;b.energy=3;
    const c=b.hand[0];c.cost=1;c.upgraded=false;c.runtime={...c.runtime,suit:null,cost:1,effects:['damage(target, 10)'],moltEffects:[]};
    b.selectedInstanceId=c.instanceId;const forecast=b.selectedCardOutcomePreview().survival;
    b.playCard(c,relay.id,{resolveDelayMs:0});return {forecast,hp:b.flock.hp,mode:b.mode,survivor:front.hp};
  });
  expect(result.survivor).toBeGreaterThan(0);expect(result.mode).not.toBe('battle');
  expect(result.forecast.after).toBe(0);expect(result.forecast.remaining).toBe(result.hp);
});
