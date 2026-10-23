import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { installVirtualController, pressController, controllerButton } from './helpers/virtual-controller';

const sizes = [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}];
test.use({hasTouch:true});
async function boot(page: Page, key = 'MenuScene') {
  await page.setViewportSize(sizes[0]);
  await installVirtualController(page);
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  if (key === 'MenuScene') return;
  await page.evaluate(key => {
    const game = (window as any).__birdSquadGame;
    game.scene.stop('MenuScene'); game.scene.start(key, key === 'BattleScene' ? {routeNodeId:'m1_entry'} : undefined);
  }, key);
  await page.waitForFunction(key => {
    const s=(window as any).__birdSquadGame.scene.getScene(key);
    return key === 'RouteScene' ? s.routeEssentialAssetsReady : s.hand.length && s.battleHudRendererModule && !s.combatIntroActive && !s.combatAnimationPending;
  },key);
  await settleCanvas(page);
}
async function state(page: Page, key: string) {
  return page.evaluate(key => {
    const s=(window as any).__birdSquadGame.scene.getScene(key);
    const walk=(list:any[]):any[]=>list.flatMap(o=>[o,...walk(o.list??[])]);
    const list=walk(s.children.list), pending=list.find(o=>o.name==='pending-overlay');
    return {status:pending?.getData('status'), focus:pending?.getData('actionFocus')?.label,
      pause:list.find(o=>o.name==='pause-actions')?.getData('actionFocus')?.label,
      run:JSON.stringify(s.runState), paused:s.pauseOverlayOpen,
      guide:list.find(o=>o.name==='how-to-play-actions')?.getData('actionFocus'),
      help:!!s.helpOverlay, topic:s.helpOverlay?.getData('topic')};
  },key);
}

for (const key of ['RouteScene','BattleScene']) test(`${key} stalled panel remains cancellable and late completion cannot reopen it`, async ({page},info)=>{
  let release!:()=>void; const gate=new Promise<void>(resolve=>release=resolve); let requests=0;
  await page.route('**/system-overlays-*.js',async route=>{requests++; await gate; await route.continue();});
  try {
    await boot(page,key);
    const before=(await state(page,key)).run;
    await page.keyboard.press('p');
    await expect.poll(async()=>(await state(page,key)).status).toBe('loading');
    await expect.poll(async()=>(await state(page,key)).focus).toBe('Close');
    for (const size of sizes) {
      await page.setViewportSize(size); await settleCanvas(page);
      const geometry=await page.evaluate(key=>{
        const s=(window as any).__birdSquadGame.scene.getScene(key);
        const walk=(list:any[]):any[]=>list.flatMap(o=>[o,...walk(o.list??[])]);
        const root=walk(s.children.list).find(o=>o.name==='pending-overlay');
        const scale=document.querySelector('canvas')!.getBoundingClientRect().height/720;
        return root.list.filter((o:any)=>o.name==='pending-overlay-close'||o.name==='pending-overlay-recovery')
          .map((o:any)=>({touch:o.height*scale>=44,label:o.getData('labelObject').height<=o.height-8}));
      },key);
      expect(geometry).toEqual([{touch:true,label:true},{touch:true,label:true}]);
      await page.screenshot({path:info.outputPath(`${key}-loading-${size.width}.png`)});
    }
    await expect.poll(async()=>(await state(page,key)).status,{timeout:12000}).toBe('slow');
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog',{name:'Download recovery'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Keep playing',exact:true})).toBeFocused();
    await controllerButton(page,1,true);
    await expect(page.locator('#update-recovery')).toHaveCount(0);
    expect((await state(page,key)).status).toBe('slow'); // same B cannot close both owners
    await controllerButton(page,1,false); await pressController(page,1);
    await expect.poll(async()=>(await state(page,key)).status).toBeUndefined();
    expect((await state(page,key)).run).toBe(before);
    const response=page.waitForResponse('**/system-overlays-*.js'); release(); await response; await settleCanvas(page);
    expect((await state(page,key)).pause).toBeUndefined(); expect(requests).toBe(1);
    await page.keyboard.press('p'); await expect.poll(async()=>(await state(page,key)).pause).toBe('Resume');
    await page.keyboard.press('Escape');
    await expect.poll(async()=>(await state(page,key)).pause).toBeUndefined();
  } finally {release();}
});

test('failed system download has visible recovery, safe focus, and confirmed reload succeeds',async({page},info)=>{
  let fail=true;
  await page.route('**/system-overlays-*.js',route=>fail ? route.fulfill({status:503,body:'Unavailable',contentType:'text/plain'}) : route.continue());
  await boot(page);
  await page.keyboard.press('h');
  await expect(page.getByRole('dialog',{name:'Download recovery'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Keep playing',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect.poll(async()=>(await state(page,'MenuScene')).status).toBe('error');
  for(const size of sizes){
    await page.setViewportSize(size); await settleCanvas(page);
    await page.screenshot({path:info.outputPath(`failed-system-${size.width}.png`)});
  }
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Reload options',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'last saved checkpoint'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Cancel reload'})).toBeFocused();
  await expect(page.getByRole('button',{name:'Cancel reload'})).toHaveCSS('outline-width','3px');
  await page.getByRole('button',{name:'Cancel reload'}).click();
  expect((await state(page,'MenuScene')).status).toBe('error');
  expect((await state(page,'MenuScene')).focus).toBe('Recovery options');
  await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Reload options',exact:true}).click();
  fail=false;
  await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Reload saved checkpoint',exact:true}).click()]);
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.keyboard.press('h');
  await expect.poll(async()=>(await state(page,'MenuScene')).guide?.label).toBe('Practice lessons');
});

test('guide redraw keeps the exact action focused and nested lessons return to their opener',async({page},info)=>{
  await boot(page); await page.keyboard.press('h');
  await expect.poll(async()=>(await state(page,'MenuScene')).guide?.label).toBe('Practice lessons');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter'); // toggle schedules a real guide rebuild
  await expect.poll(async()=>(await state(page,'MenuScene')).guide?.index).toBe(1);
  await settleCanvas(page);
  expect((await state(page,'MenuScene')).guide?.index).toBe(1);
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Enter');
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').helpOverlay?.getData('topic')?.startsWith('Practice lessons.'));
  await pressController(page,1);
  await expect.poll(async()=>(await state(page,'MenuScene')).guide?.label).toBe('Practice lessons');
  await page.screenshot({path:info.outputPath('guide-return-2560.png')});
  await page.keyboard.press('Escape');
  await expect.poll(async()=>(await state(page,'MenuScene')).help).toBe(false);
});

test('failed lessons explain recovery on screen and never reload without confirmation',async({page},info)=>{
  await page.route('**/practice-lessons-*.js',route=>route.fulfill({status:503,body:'Unavailable',contentType:'text/plain'}));
  await boot(page); await page.keyboard.press('h');
  await expect.poll(async()=>(await state(page,'MenuScene')).guide?.label).toBe('Practice lessons');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:'Download recovery'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(async()=>(await state(page,'MenuScene')).topic).toContain('Lessons are unavailable');
  for (const size of sizes){
    await page.setViewportSize(size); await settleCanvas(page);
    await page.screenshot({path:info.outputPath(`lesson-failure-${size.width}.png`)});
  }
  const generation=await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').menuGeneration);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Keep playing',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').menuGeneration)).toBe(generation);
  await page.keyboard.press('Escape'); await expect.poll(async()=>(await state(page,'MenuScene')).help).toBe(false);
});

test('Collection download cancels without scene navigation and reopens from the completed request',async({page})=>{
  let release!:()=>void; const gate=new Promise<void>(resolve=>release=resolve); let requests=0;
  await page.route('**/codex-scene-*.js',async route=>{requests++; await gate; await route.continue();});
  try {
    await boot(page);
    await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').openCodex());
    await expect.poll(async()=>(await state(page,'MenuScene')).status).toBe('loading');
    await page.keyboard.press('Escape');
    await expect.poll(async()=>(await state(page,'MenuScene')).status).toBeUndefined();
    const response=page.waitForResponse('**/codex-scene-*.js'); release(); await response; await settleCanvas(page);
    expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.isActive('MenuScene'))).toBe(true);
    await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').openCodex());
    await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.isActive('CodexScene'));
    expect(requests).toBe(1);
  } finally {release();}
});

test('pending panel retires on shutdown and cannot attach to the restarted scene',async({page})=>{
  let release!:()=>void; const gate=new Promise<void>(resolve=>release=resolve);
  await page.route('**/system-overlays-*.js',async route=>{await gate; await route.continue();});
  try {
    await boot(page); await page.keyboard.press('h');
    await expect.poll(async()=>(await state(page,'MenuScene')).status).toBe('loading');
    await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').scene.restart());
    await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
    const response=page.waitForResponse('**/system-overlays-*.js'); release(); await response; await settleCanvas(page);
    expect((await state(page,'MenuScene')).guide).toBeUndefined();
    expect((await state(page,'MenuScene')).status).toBeUndefined();
    await page.keyboard.press('h');
    await expect.poll(async()=>(await state(page,'MenuScene')).guide?.label).toBe('Practice lessons');
    await page.keyboard.press('Tab');
    expect((await state(page,'MenuScene')).guide?.index).toBe(1);
  } finally {release();}
});

test('pending panel honors remapped confirm/back and its compact touch exit',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('birdsquad.controlBindings',JSON.stringify({version:1,bindings:{confirm:'KeyJ',back:'KeyK'}})));
  let release!:()=>void; const gate=new Promise<void>(resolve=>release=resolve); let requests=0;
  await page.route('**/system-overlays-*.js',async route=>{requests++; await gate; await route.continue();});
  try {
    await boot(page);
    for (const key of ['j','k']) {
      await page.keyboard.press('h');
      await expect.poll(async()=>(await state(page,'MenuScene')).status).toBe('loading');
      await page.keyboard.press(key);
      await expect.poll(async()=>(await state(page,'MenuScene')).help).toBe(false);
    }
    await page.setViewportSize(sizes[2]); await page.keyboard.press('h');
    await expect.poll(async()=>(await state(page,'MenuScene')).status).toBe('loading');
    const box=(await page.locator('canvas').boundingBox())!;
    await page.touchscreen.tap(box.x+box.width*484/1280,box.y+box.height*430/720);
    await expect.poll(async()=>(await state(page,'MenuScene')).help).toBe(false);
    const response=page.waitForResponse('**/system-overlays-*.js'); release(); await response; await settleCanvas(page);
    expect((await state(page,'MenuScene')).help).toBe(false); expect(requests).toBe(1);
  } finally {release();}
});
