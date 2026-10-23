import {test, expect, type Page} from '@playwright/test';
import {settleCanvas} from './helpers/settled-canvas';
import {installVirtualController, pressController, controllerButton} from './helpers/virtual-controller';

test.use({hasTouch:true});
type Flow = 'folio' | 'review' | 'outcome';
const names = {folio:'profile-folio-copy-code-hit',review:'run-flight-details-copy-hit',outcome:'run-outcome-flight-link-hit'};
async function hitState(page:Page, flow:Flow) {
  return page.evaluate(({flow,name})=>{
    const s=(window as any).__birdSquadGame.scene.getScene(flow==='outcome'?'BattleScene':'ProfileScene');
    const walk=(xs:any[]):any[]=>xs.flatMap(o=>[o,...walk(o.list??[])]);
    const h=walk(s.children.list).find(o=>o.name===name), t=h.getData('labelObject');
    return {status:h.getData('status'),enabled:!!h.input?.enabled,label:t.text,requests:(window as any).__copyRequests.length,
      bounds:[h.x,h.y,h.width,h.height],alpha:h.alpha,fillAlpha:h.fillAlpha};
  },{flow,name:names[flow]});
}
async function tap(page:Page,flow:Flow,name=names[flow]) {
  await settleCanvas(page);
  const p=await page.evaluate(({flow,name})=>{
    const s=(window as any).__birdSquadGame.scene.getScene(flow==='outcome'?'BattleScene':'ProfileScene');
    const walk=(xs:any[]):any[]=>xs.flatMap(o=>[o,...walk(o.list??[])]);
    const h=walk(s.children.list).find(o=>o.name===name),b=h.getBounds(),c=s.game.canvas.getBoundingClientRect();
    return {x:c.left+b.centerX*c.width/1280,y:c.top+b.centerY*c.height/720};
  },{flow,name});
  await page.touchscreen.tap(p.x,p.y);await settleCanvas(page);
}
async function boot(page:Page,flow:Flow) {
  await installVirtualController(page);
  await page.addInitScript(()=>{
    const w=window as any;w.__copyRequests=[];
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:(value:string)=>new Promise<void>((resolve,reject)=>w.__copyRequests.push({value,resolve,reject}))}});
    localStorage.setItem('birdsquad.screenReader','on');
    const account=JSON.stringify({discoveredCards:['major_00','wands_ace'],decks:[{id:'copy-owner',lineageId:'copy-owner',revision:1,name:'Copy ownership',leaderId:'spark_caller',cards:[{id:'major_00'},{id:'wands_ace'}],createdAt:100,updatedAt:100}]});
    for(const key of ['birdsquad.account','birdsquad.account.backup'])localStorage.setItem(key,account);
    const runs=JSON.stringify([{id:'run-1770000000000-copy',seed:'copy-owner',result:'win',deck:[{id:'wands_ace'}],path:['m1_entry'],runMode:'quick',turnsTaken:4}]);
    for(const key of ['birdsquad.runs','birdsquad.runs.backup'])localStorage.setItem(key,runs);
  });
  await page.goto('./');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(async flow=>{
    const w=window as any,name=flow==='outcome'?'BattleScene':'ProfileScene';
    await w.__birdSquadEnsureScene(name);w.__birdSquadGame.scene.stop('MenuScene');
    w.__birdSquadGame.scene.start(name,flow==='outcome'?{routeNodeId:'m1_entry'}:{});
  },flow);
  if(flow==='outcome') {
    await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.flock&&b.fxLayer?.active&&!b.combatIntroActive&&!b.combatAnimationPending;});
    await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.retireCombatFxForOutcome();b.mode='runComplete';b.renderAll();});
    await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').root.list.some((o:any)=>o.name==='run-outcome-flight-link-hit'));
  } else {
    await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text()).scene==='ProfileScene');
    await tap(page,flow,flow==='folio'?'profile-folios-tab-hit':'profile-flight-log-hit');
    if(flow==='review')await tap(page,flow,'profile-history-review');
  }
  await settleCanvas(page);
}
const settleRequest=(page:Page,index:number,success:boolean)=>page.evaluate(({index,success})=>{
  const request=(window as any).__copyRequests[index];success?request.resolve():request.reject(new Error('Clipboard rejected'));
},{index,success});
const stored=(page:Page)=>page.evaluate(()=>JSON.stringify([localStorage.getItem('birdsquad.account'),localStorage.getItem('birdsquad.runs')]));

test('outcome Copy is keyboard/controller reachable, guarded while pending, and visible at every size',async({page},info)=>{
  await boot(page,'outcome');
  const focus=()=>page.evaluate(()=>JSON.parse((window as any).render_game_to_text()).combatInputFocus);
  await page.keyboard.press('Shift+Tab');
  await expect.poll(async()=>(await focus()).label).toBe('Copy seeded flight');
  expect((await focus()).visibleFocus).toBe(true);
  for(const [width,height] of [[2560,1600],[1440,900],[1000,560]]) {
    await page.setViewportSize({width,height}); await settleCanvas(page);
    expect((await focus()).visibleFocus).toBe(true);
    const focused=await page.evaluate(()=>{
      const h=(window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('run-outcome-flight-link-hit');
      return h.getData('focused');
    });
    expect(focused).toBe(true);
    await page.screenshot({path:info.outputPath(`outcome-copy-focus-${width}.png`)});
  }
  await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
  await controllerButton(page,0,true); await settleCanvas(page); await controllerButton(page,0,false);
  expect(await hitState(page,'outcome')).toMatchObject({status:'loading',enabled:false,requests:1});
  await settleRequest(page,0,false);
  await expect.poll(async()=>(await hitState(page,'outcome')).status).toBe('error');
  await pressController(page,0);
  expect((await hitState(page,'outcome')).requests).toBe(2);
  await settleRequest(page,1,true);
  await expect.poll(async()=>(await hitState(page,'outcome')).status).toBe('idle');
  await pressController(page,15);
  await expect.poll(async()=>(await focus()).label).toBe('Replay Flight');
  await pressController(page,14);
  await expect.poll(async()=>(await focus()).label).toBe('Copy seeded flight');
});

for(const flow of ['folio','review','outcome'] as const) {
  for(const [width,height] of [[2560,1600],[1440,900],[1000,560]]) test(`${flow} copy exposes pending/error/retry and rejects duplicate input at ${width}`,async({page},info)=>{
    await page.setViewportSize({width,height});
    await boot(page,flow);const before=await stored(page),initial=await hitState(page,flow);
    await tap(page,flow);
    expect(await hitState(page,flow)).toMatchObject({status:'loading',enabled:false,requests:1,label:'Copying…',bounds:initial.bounds});
    await tap(page,flow); // A real tap cannot reactivate the disabled control.
    if(flow!=='outcome') {await page.keyboard.press(flow==='folio'?'e':'Enter');await pressController(page,flow==='folio'?7:0);}
    expect((await hitState(page,flow)).requests).toBe(1);
    if(flow==='folio') {
      for(let i=0;i<20&&await page.evaluate(()=>JSON.parse((window as any).render_game_to_text()).folioFocus.scope==='profile-folio');i++)await page.keyboard.press('Tab');
      expect(await page.evaluate(()=>JSON.parse((window as any).render_game_to_text()).folioFocus.scope)).not.toBe('profile-folio');
      expect((await hitState(page,flow)).status).toBe('loading');
    }
    expect(await hitState(page,flow)).toMatchObject({status:'loading',enabled:false,alpha:1,fillAlpha:1,bounds:initial.bounds});
    await page.screenshot({path:info.outputPath(`pending-${width}.png`)});
    await settleRequest(page,0,false);
    await expect.poll(async()=>(await hitState(page,flow)).status).toBe('error');
    expect(await hitState(page,flow)).toMatchObject({enabled:true,label:'Copy failed · Retry',bounds:initial.bounds});
    await page.screenshot({path:info.outputPath(`error-${width}.png`)});
    await tap(page,flow);expect((await hitState(page,flow)).requests).toBe(2);
    await settleRequest(page,1,true);
    await expect.poll(async()=>(await hitState(page,flow)).status).toBe('idle');
    if(flow==='folio') expect(await page.evaluate(()=>JSON.parse((window as any).render_game_to_text()).savedFlightFolios.status)).toBe('codeCopied');
    else expect((await hitState(page,flow)).label.toLowerCase()).toContain('copied');
    expect(await stored(page)).toBe(before);
  });

  test(`${flow} stalled copy times out and ignores the old result after retry`,async({page})=>{
    await boot(page,flow);await tap(page,flow);
    await expect.poll(async()=>(await hitState(page,flow)).status,{timeout:10000}).toBe('error');
    await tap(page,flow);expect((await hitState(page,flow)).requests).toBe(2);
    await settleRequest(page,0,true);await settleCanvas(page);
    expect((await hitState(page,flow)).status).toBe('loading');
    await settleRequest(page,1,true);
    await expect.poll(async()=>(await hitState(page,flow)).status).toBe('idle');
  });

  test(`${flow} retired copy cannot update a replacement owner or survive shutdown`,async({page})=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await boot(page,flow);await tap(page,flow);
    if(flow==='review'){
      await page.keyboard.press('Escape');await tap(page,flow,'profile-history-review');
    } else if(flow==='folio'){
      await tap(page,flow,'profile-folio-organize-hit');await page.keyboard.press('Escape');
    } else await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').renderAll());
    await settleCanvas(page);
    expect((await hitState(page,flow)).status).toBe('idle');
    await tap(page,flow);expect((await hitState(page,flow)).requests).toBe(2);
    await settleRequest(page,0,true);await settleCanvas(page);
    expect((await hitState(page,flow)).status).toBe('loading');
    await page.evaluate(flow=>{const g=(window as any).__birdSquadGame;g.scene.stop(flow==='outcome'?'BattleScene':'ProfileScene');g.scene.start('MenuScene');},flow);
    await settleRequest(page,1,true);await settleCanvas(page);
    expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.isActive('MenuScene'))).toBe(true);
    expect(errors).toEqual([]);
  });
}
