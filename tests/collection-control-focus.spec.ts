import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { installVirtualController, pressController, controllerButton } from './helpers/virtual-controller';
test.use({hasTouch:true});
const sizes = [[2560,1600],[1440,900],[1000,560]];
async function boot(page:Page) {
  await page.setViewportSize({width:2560,height:1600});
  await installVirtualController(page);
  await page.addInitScript(()=>{
    const ids=['major_00','major_01','wands_ace'];
    const raw=JSON.stringify({discoveredCards:ids,cardCollection:Object.fromEntries(ids.map(id=>[id,{timesClaimed:1,firstAcquiredAt:10,firstSource:'starter_flock'}]))});
    localStorage.setItem('birdsquad.account',raw); localStorage.setItem('birdsquad.account.backup',raw);
  });
  await page.goto('./');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(async()=>{
    const w=window as any; await w.__birdSquadEnsureScene('CodexScene');
    w.__birdSquadGame.scene.stop('MenuScene'); w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('CodexScene').codexData);
  await settleCanvas(page);
}
const state=(page:Page)=>page.evaluate(()=>{
  const s=(window as any).__birdSquadGame.scene.getScene('CodexScene');
  return {focus:s.codexFocusState(),views:s.savedCollectionViews.length,open:s.savedCollectionViewsOpen,
    armed:!!s.savedViewRemoval,status:s.savedCollectionViewStatus,detail:s.detailId,
    scroll:s.gridScroll,entry:s.entryFocusIndex,query:s.cardSearchQuery};
});
async function click(page:Page,name:string,touch=false) {
  const p=await page.evaluate(name=>{
    const s=(window as any).__birdSquadGame.scene.getScene('CodexScene'), b=s.root.getByName(name).getBounds(), c=s.game.canvas.getBoundingClientRect();
    return {x:c.left+b.centerX*c.width/1280,y:c.top+b.centerY*c.height/720};
  },name);
  if(touch) await page.touchscreen.tap(p.x,p.y); else await page.mouse.click(p.x,p.y);
  await settleCanvas(page);
}
test('Saved Views actions are tab reachable, safely confirmed and retain focus through redraws',async({page},info)=>{
  await boot(page); await page.keyboard.press('b');
  await page.keyboard.press('Tab');
  expect((await state(page)).focus.action).toBe('codex-saved-view-save-hit');
  await page.keyboard.press('Enter'); expect((await state(page)).views).toBe(1);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  expect((await state(page)).focus.action).toBe('codex-saved-view-delete-hit');
  await page.keyboard.press('Enter');
  expect(await state(page)).toMatchObject({views:1,armed:true,focus:{action:'codex-saved-view-close-hit'}});
  for(const [width,height] of sizes){
    await page.setViewportSize({width,height}); await settleCanvas(page);
    const controls=await page.evaluate(()=>{
      const s=(window as any).__birdSquadGame.scene.getScene('CodexScene'), scale=s.game.canvas.getBoundingClientRect().width/1280;
      return ['save','apply','delete','close'].map(id=>{
        const h=s.root.getByName(`codex-saved-view-${id}-hit`), t=h.getData('labelObject');
        return {id,kind:h.getData('controlKind'),width:h.width*scale,height:h.height*scale,
          font:parseFloat(t.style.fontSize)*scale,fit:t.width<=h.width-20};
      });
    });
    for(const c of controls){expect(c.width).toBeGreaterThanOrEqual(44);expect(c.height).toBeGreaterThanOrEqual(44);expect(c.font).toBeGreaterThanOrEqual(16);expect(c.fit).toBe(true);}
    expect(controls.find(c=>c.id==='delete')?.kind).toBe('destructive');
    expect(controls.find(c=>c.id==='close')?.kind).toBe('primary');
    await page.screenshot({path:info.outputPath(`saved-confirm-${width}.png`)});
    await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('CodexScene').renderAll(true));
    expect((await state(page)).focus.action).toBe('codex-saved-view-close-hit');
  }
  await page.keyboard.press('Enter'); expect(await state(page)).toMatchObject({views:1,armed:false,open:true});
  await page.keyboard.press('Enter'); // arm again from restored Remove opener
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Enter');
  expect(await state(page)).toMatchObject({views:0,armed:false,status:'deleted'});
  await page.keyboard.press('Escape'); expect((await state(page)).focus.zone).toBe('savedViews');
});
test('failed removal preserves saved views and requires fresh confirmation before retry',async({page})=>{
  await boot(page); await page.keyboard.press('b'); await page.keyboard.press('Control+s');
  await page.evaluate(()=>{
    const write=Storage.prototype.setItem; (window as any).__restoreWrite=()=>Storage.prototype.setItem=write;
    Storage.prototype.setItem=function(k,v){if(k.includes('codexSavedViews')) throw new Error('storage unavailable');return write.call(this,k,v);};
  });
  await page.keyboard.press('Delete'); await page.keyboard.press('Delete');
  expect(await state(page)).toMatchObject({views:1,status:'failed',armed:false});
  await page.evaluate(()=>(window as any).__restoreWrite());
  await page.keyboard.press('Delete'); expect((await state(page)).views).toBe(1);
  await page.keyboard.press('Escape'); expect(await state(page)).toMatchObject({views:1,open:true,armed:false});
  await page.keyboard.press('Delete'); await page.keyboard.press('Delete');
  expect((await state(page)).views).toBe(0);
});
test('journal child returns to its exact action and dossier returns to the same shelf entry',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await boot(page);
  await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('CodexScene');
    s.entryFocusIndex=1;s.openCodexDetail('major_01');
  });
  for(let i=0;i<9 && (await state(page)).focus.action!=='codex-card-journal-hit';i++) await page.keyboard.press('Tab');
  expect((await state(page)).focus.label).toBe('Edit private journal');
  await page.keyboard.press('Enter');
  const input=page.locator('#codex-card-journal-input');await expect(input).toBeFocused();
  await input.fill('Keep this draft while the panel recovers.');
  await page.evaluate(()=>{
    const write=Storage.prototype.setItem;(window as any).__restoreWrite=()=>Storage.prototype.setItem=write;
    Storage.prototype.setItem=function(k,v){if(k.startsWith('birdsquad.account'))throw new Error('full');return write.call(this,k,v);};
  });
  await page.keyboard.press('Enter');await expect(page.locator('#codex-card-journal-error')).toBeVisible();
  await page.evaluate(()=>dispatchEvent(new Event('vite:preloadError')));
  await expect(page.getByRole('button',{name:'Keep playing',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(input).toBeFocused();
  await expect(input).toHaveValue('Keep this draft while the panel recovers.');
  await page.evaluate(()=>(window as any).__restoreWrite());
  await page.keyboard.press('Enter');await expect(input).toHaveCount(0);
  expect(await state(page)).toMatchObject({detail:'major_01',focus:{action:'codex-card-journal-hit'}});
  for(const [width,height] of sizes){
    await page.setViewportSize({width,height});await settleCanvas(page);
    await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('CodexScene').renderAll());
    expect((await state(page)).focus.action).toBe('codex-card-journal-hit');
    await page.screenshot({path:info.outputPath(`journal-return-${width}.png`)});
  }
  await page.keyboard.press('Enter');await expect(input).toBeVisible();
  await controllerButton(page,1,true);await expect(input).toHaveCount(0);
  expect((await state(page)).detail).toBe('major_01');
  await controllerButton(page,1,false);await pressController(page,1);
  expect(await state(page)).toMatchObject({focus:{zone:'entries'},entry:1});
  expect((await state(page)).detail).toBeUndefined();expect(errors).toEqual([]);
});
test('canceling live search restores shelf position and controller actions stay within Saved Views',async({page})=>{
  await boot(page);
  await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('CodexScene');
    s.gridScroll=240;s.gridScrollTarget=240;s.entryFocusIndex=7;s.renderAll();
  });
  const before=await state(page);
  await page.keyboard.press('/');await page.locator('#codex-card-search-input').fill('nothing matches');
  await page.locator('#codex-card-search-input').dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});
  await expect(page.locator('#codex-card-search-input')).toBeVisible();
  await page.evaluate(()=>dispatchEvent(new Event('vite:preloadError')));
  await expect(page.getByRole('button',{name:'Keep playing',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#codex-card-search-input')).toBeFocused();
  await expect(page.locator('#codex-card-search-input')).toHaveValue('nothing matches');
  await page.keyboard.press('Escape');
  expect(await state(page)).toMatchObject({scroll:before.scroll,entry:before.entry,query:before.query,focus:{zone:'search'}});
  await pressController(page,8);await pressController(page,15);
  expect((await state(page)).focus.action).toBe('codex-saved-view-save-hit');
  await pressController(page,0);expect((await state(page)).views).toBe(1);
  await pressController(page,3);expect((await state(page)).armed).toBe(true);
  await controllerButton(page,1,true);expect(await state(page)).toMatchObject({open:true,armed:false});
  await controllerButton(page,1,false);await pressController(page,1);
  expect((await state(page)).focus.zone).toBe('savedViews');
});
test('compact touch controls use the same safe removal and opener restoration',async({page})=>{
  await boot(page);await page.setViewportSize({width:1000,height:560});await settleCanvas(page);
  await click(page,'codex-tools-hit',true);await click(page,'codex-saved-views-hit',true);
  await click(page,'codex-saved-view-save-hit',true);expect((await state(page)).views).toBe(1);
  await click(page,'codex-saved-view-delete-hit',true);expect((await state(page)).armed).toBe(true);
  await click(page,'codex-saved-view-close-hit',true);expect(await state(page)).toMatchObject({views:1,open:true,armed:false});
  await click(page,'codex-saved-view-close-hit',true);expect((await state(page)).focus.zone).toBe('savedViews');
});
test('remapped Confirm wins over Collection shortcuts without opening a second child',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('birdsquad.controlBindings',JSON.stringify({version:1,bindings:{confirm:'KeyJ',back:'KeyK'}})));
  await boot(page);
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('CodexScene').openCodexDetail('major_00'));
  await page.keyboard.press('Tab');
  expect((await state(page)).focus.action).toBe('codex-card-favorite-hit');
  await page.keyboard.press('j');
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('CodexScene').favoriteCards.has('major_00'))).toBe(true);
  await expect(page.locator('#codex-card-journal-input')).toHaveCount(0);
  await pressController(page,9);await expect(page.locator('#codex-card-journal-input')).toBeVisible();
  await pressController(page,1);
  expect((await state(page)).focus.action).toBe('codex-card-journal-hit');
  await page.keyboard.press('k');expect((await state(page)).focus.zone).toBe('entries');
});
