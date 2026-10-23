import {test,expect} from '@playwright/test';
import {settleCanvas} from './helpers/settled-canvas';
import {installVirtualController,pressController} from './helpers/virtual-controller';

for(const key of ['RouteScene','BattleScene']) for(const packed of [false,true])
test(`${key} recent Supply feedback stays complete with packed=${packed}`,async({page},info)=>{
  test.setTimeout(60000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await installVirtualController(page);await page.setViewportSize({width:1000,height:560});
  await page.goto('./');await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(async key=>{const w=window as any;await w.__birdSquadEnsureScene(key);
    for(const s of w.__birdSquadGame.scene.getScenes(true))w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start(key,{routeNodeId:'m1_entry'});},key);
  await page.waitForFunction(key=>{const s=(window as any).__birdSquadGame.scene.getScene(key);
    return key==='RouteScene'?s.routeEssentialAssetsReady:s.battleHandRendererModule&&!s.combatInteractionLocked();},key);
  const recent=await page.evaluate(({key,packed})=>{
    const s=(window as any).__birdSquadGame.scene.getScene(key);
    const recent=Array.from({length:4},(_,i)=>({id:'test-'+i,name:`Supply ${i} with its complete name`,summary:'Preserve this complete consequence. '.repeat(8)+`End ${i}`}));
    s.supplyFeedback=recent;
    if(key==='RouteScene'){s.runState.supplies=packed?['feather_splint']:[];s.openSupplyDrawer(true);}
    else{s.runSupplies=packed?['feather_splint']:[];s.toggleBattleSupplyDrawer(true);}
    return recent;
  },{key,packed});
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text()).supplyDrawer?.reading);
  const read=()=>page.evaluate(()=>JSON.parse((window as any).render_game_to_text()).supplyDrawer.reading);
  const first=await read(),pages:any[]=[];
  for(let i=0;i<first.total;i++){
    pages.push(await read());await page.keyboard.press('r');await settleCanvas(page);
    expect((await read()).page).toBe((i+1)%first.total+1);
  }
  const clean=(s:string)=>s.replace(/\s/g,'');
  expect(clean(pages.filter(p=>p.title==='RECENT USE').map(p=>p.text).join('')))
    .toBe(clean(recent.map(p=>p.name+p.summary).join('')));
  await pressController(page,3);expect((await read()).page).toBe(2);
  for(const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]){
    await page.setViewportSize(size);await settleCanvas(page);
    const layout=await page.evaluate(key=>{const s=(window as any).__birdSquadGame.scene.getScene(key),list=key==='RouteScene'?s.children.list:s.root.list;
      const body=list.find((o:any)=>o.name==='supply-drawer-rules'),scale=s.game.canvas.getBoundingClientRect().height/720;
      return{bottom:body.getBounds().bottom,small:list.filter((o:any)=>o.type==='Text'&&o.text&&parseFloat(o.style.fontSize)*scale<14-.01).map((o:any)=>o.text)};},key);
    expect(layout.bottom).toBeLessThanOrEqual(444);expect(layout.small).toEqual([]);
    await page.screenshot({path:info.outputPath(`recent-${size.width}.png`)});
  }
  await page.keyboard.press('Escape');await settleCanvas(page);
  expect(await page.evaluate(key=>{const s=(window as any).__birdSquadGame.scene.getScene(key);return key==='RouteScene'?s.runState.supplies:s.runSupplies;},key))
    .toEqual(packed?['feather_splint']:[]);
  expect(errors).toEqual([]);
});
