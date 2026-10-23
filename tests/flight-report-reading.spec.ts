import {test,expect} from '@playwright/test';
import {settleCanvas} from './helpers/settled-canvas';
import {installVirtualController,pressController} from './helpers/virtual-controller';

test.use({hasTouch:true});
test('flight report preserves every long entry, reading position and input ownership',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await installVirtualController(page);
  await page.setViewportSize({width:1000,height:560});
  await page.addInitScript(()=>localStorage.setItem('birdsquad.screenReader','on'));
  await page.goto('./');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(async()=>{
    const w=window as any;await w.__birdSquadEnsureScene('BattleScene');
    w.__birdSquadGame.scene.stop('MenuScene');w.__birdSquadGame.scene.start('BattleScene',{routeNodeId:'m1_entry'});
  });
  await page.waitForFunction(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    return s.battleHandRendererModule&&s.fxLayer?.active&&s.hand?.length&&!s.battleRenderQueued&&!s.combatAnimationPending&&!s.combatIntroActive;});
  await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    s.retireCombatFxForOutcome();s.mode='defeat';s.emitRunSummary('loss');s.renderAll();});
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').bossDossierModule);
  await settleCanvas(page);
  await page.waitForFunction(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    return !s.battleRenderQueued&&s.root.getByName('run-outcome-command-hit');});
  const source=await page.evaluate(()=>{
    const w=window as any,s=w.__birdSquadGame.scene.getScene('BattleScene');
    const details={deck:Array.from({length:110},(_,i)=>`${i+1}. Card ${i} with its complete gameplay name`),
      path:Array.from({length:44},(_,i)=>`Stop ${i+1}: District route with long conditions and exact consequences`),
      waymarks:['A long Waymark name','A second Waymark'],supplies:['Seed Packet'],
      decisions:Array.from({length:20},(_,i)=>`Decision ${i}: ${'Keep this entire decision and all consequences. '.repeat(6)}`),
      results:['LOSS · all final results preserved','X'.repeat(220)]};
    w.__reportFixture=details;
    w.__reportBaseline=s.input.keyboard.listenerCount('keydown-PAGE_DOWN');
    w.__renderReportFixture=()=>{
      s.children.getByName('stress-report-root')?.destroy();
      const root=s.add.container(0,0).setDepth(100000).setName('stress-report-root');
      s.bossDossierModule.renderOutcomeFlightDetails(s,root,details,{title:'Recorded Flight',subtitle:'Long report qualification '.repeat(20),
        identity:details,fontFamily:'Arial',boldStyle:'bold',focused:true,onClose:()=>root.destroy()});
    };
    w.__renderReportFixture();return details;
  });
  const read=()=>page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('BattleScene'),r=s.children.getByName('stress-report-root');
    const body=r.getByName('run-flight-details-section-body'),heading=r.getByName('run-flight-details-section-title');
    const b=body.getBounds(),h=heading.getBounds(),scale=s.game.canvas.getBoundingClientRect().height/720;
    const texts=r.list.filter((o:any)=>o.type==='Text');
    return {...body.getData('reading'),bounds:b,heading:h,small:texts.filter((o:any)=>parseFloat(o.style.fontSize)*scale<14-0.01).map((o:any)=>o.text),
      bodySize:parseFloat(body.style.fontSize)*scale,listeners:s.input.keyboard.listenerCount('keydown-PAGE_DOWN')};
  });
  const first=await read();expect(first.page).toBe(1);expect(first.total).toBeGreaterThan(15);
  const visited:Array<{title:string;text:string}>=[];
  for(let i=0;i<first.total;i++){
    const current=await read();expect(current.page).toBe(i+1);expect(current.small).toEqual([]);
    expect(current.bodySize).toBeGreaterThanOrEqual(16);expect(current.bounds.y+current.bounds.height).toBeLessThanOrEqual(506);
    expect(current.bounds.x+current.bounds.width).toBeLessThanOrEqual(1160);
    expect(current.heading.y+current.heading.height+8).toBeLessThanOrEqual(current.bounds.y);
    visited.push(current);await page.keyboard.press('PageDown');
    await expect.poll(async()=>(await read()).page).toBe((i+1)%first.total+1);
  }
  const joined=(prefix:string)=>visited.filter(p=>p.title.startsWith(prefix)).map(p=>p.text).join('\n').replace(/\s/g,'');
  for(const [key,prefix] of [['deck','FINAL DECK'],['path','ROUTE PATH'],['decisions','DECISIONS'],['results','RESULTS']] as const)
    expect(joined(prefix)).toBe(source[key].join('\n').replace(/\s/g,''));
  expect(joined('KIT AT LANDING')).toContain(source.waymarks.join('/').replace(/\s/g,''));
  expect(joined('FLIGHT IDENTITY')).toBe('Long report qualification '.repeat(20).replace(/\s/g,''));
  await pressController(page,5);await expect.poll(async()=>(await read()).page).toBe(2);
  await page.evaluate(()=>(window as any).__renderReportFixture());
  expect((await read()).page).toBe(2);expect((await read()).listeners).toBe(first.listeners);
  await pressController(page,4);await expect.poll(async()=>(await read()).page).toBe(1);
  await page.keyboard.press('PageUp');await expect.poll(async()=>(await read()).page).toBe(first.total);
  for(const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]){
    await page.setViewportSize(size);await settleCanvas(page);
    await page.screenshot({path:info.outputPath(`complete-report-${size.width}.png`)});
  }
  const clickPoint=async(name:string)=>page.evaluate(name=>{
    const s=(window as any).__birdSquadGame.scene.getScene('BattleScene'),h=s.children.getByName('stress-report-root').getByName(name),c=s.game.canvas.getBoundingClientRect();
    return{x:c.left+h.x*c.width/1280,y:c.top+h.y*c.height/720};
  },name);
  const next=await clickPoint('run-flight-details-next');await page.touchscreen.tap(next.x,next.y);
  await expect.poll(async()=>(await read()).page).toBe(1);
  const close=await clickPoint('run-flight-details-close-hit');await page.mouse.click(close.x,close.y);
  expect(await page.evaluate(()=>{const w=window as any,s=w.__birdSquadGame.scene.getScene('BattleScene');
    return s.input.keyboard.listenerCount('keydown-PAGE_DOWN')===w.__reportBaseline;})).toBe(true);
  await info.attach('all-report-pages',{body:JSON.stringify(visited),contentType:'application/json'});
  expect(errors).toEqual([]);
});
