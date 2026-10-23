import {test,expect,type Page} from '@playwright/test';
import {settleCanvas} from './helpers/settled-canvas';
import {installVirtualController,pressController,controllerButton} from './helpers/virtual-controller';
import {targetGeometry,checkTargetGeometry} from './helpers/target-geometry';
import {createRequire} from 'node:module';
const {PNG}=createRequire(import.meta.url)('playwright-core/lib/utilsBundle');

test.use({hasTouch:true});
async function tap(page:Page,name:string){
  await settleCanvas(page);
  const p=await page.evaluate(name=>{const s=(window as any).__birdSquadGame.scene.getScene('ProfileScene');
    const h=s.children.getByName(name),b=s.game.canvas.getBoundingClientRect();
    return{x:b.left+h.x*b.width/1280,y:b.top+h.y*b.height/720};},name);
  await page.touchscreen.tap(p.x,p.y);await settleCanvas(page);
}
test('native Folio actions support touch and controller without held-confirm leakage',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await installVirtualController(page);
  await page.addInitScript(()=>{
    const account=JSON.stringify({decks:[{id:'native-target',name:'Keep original',leaderId:'fledgling',
      cards:[{id:'major_00',upgraded:false}],createdAt:1,updatedAt:1,runMode:'quick'}]});
    localStorage.setItem('birdsquad.account',account);localStorage.setItem('birdsquad.account.backup',account);
  });
  await page.goto('./');await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(async()=>{const w=window as any;await w.__birdSquadEnsureScene('ProfileScene');
    w.__birdSquadGame.scene.stop('MenuScene');w.__birdSquadGame.scene.start('ProfileScene');});
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.isActive('ProfileScene'));
  await tap(page,'profile-folios-tab-hit');await tap(page,'profile-folio-organize-hit');
  const account=()=>page.evaluate(()=>localStorage.getItem('birdsquad.account'));
  const before=await account();
  for(const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]){
    await page.setViewportSize(size);await tap(page,'profile-folio-organizer-rename-hit');
    const input=page.locator('[data-folio-editor]');await expect(input).toBeFocused();
    await input.fill('Cancel this edit');
    checkTargetGeometry(await targetGeometry(page,'ProfileScene'),'native Folio actions');
    await page.screenshot({path:info.outputPath(`native-actions-${size.width}.png`)});
    await pressController(page,15);await expect(page.locator('#folio-editor-cancel')).toBeFocused();
    await controllerButton(page,0,true);
    await expect(input).toHaveCount(0);
    const frame=await page.evaluate(()=>(window as any).__birdSquadGame.loop.frame);
    await page.waitForFunction(f=>(window as any).__birdSquadGame.loop.frame>=f+12,frame);
    await expect(input).toHaveCount(0);expect(await account()).toBe(before);
    await controllerButton(page,0,false);
    await tap(page,'profile-folio-organizer-rename-hit');await input.fill('Also cancel');
    await page.locator('#folio-editor-cancel').tap();expect(await account()).toBe(before);
  }
  await tap(page,'profile-folio-organizer-rename-hit');const input=page.locator('[data-folio-editor]');
  await input.fill('Committed once');await pressController(page,15);await pressController(page,15);
  await expect(page.locator('#folio-editor-save')).toBeFocused();await pressController(page,0);
  await expect(input).toHaveCount(0);
  expect(JSON.parse((await account())!).decks[0].name).toBe('Committed once');
  expect(JSON.parse((await account())!).decks).toHaveLength(1);
  expect(await page.locator('#folio-editor-actions').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('native editor failure keeps the canvas heading and recovery controls visible',async({page},info)=>{
  await page.setViewportSize({width:2560,height:1600});
  await page.addInitScript(()=>{
    const account=JSON.stringify({decks:[{id:'error-target',name:'Original',leaderId:'fledgling',
      cards:[{id:'major_00',upgraded:false}],createdAt:1,updatedAt:1,runMode:'quick'}]});
    localStorage.setItem('birdsquad.account',account);localStorage.setItem('birdsquad.account.backup',account);
  });
  await page.goto('./');await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(async()=>{const w=window as any;await w.__birdSquadEnsureScene('ProfileScene');
    w.__birdSquadGame.scene.stop('MenuScene');w.__birdSquadGame.scene.start('ProfileScene');});
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.isActive('ProfileScene'));
  await tap(page,'profile-folios-tab-hit');await tap(page,'profile-folio-organize-hit');
  await tap(page,'profile-folio-organizer-identity-hit');await tap(page,'profile-folio-identity-description-hit');
  await page.locator('[data-folio-editor]').fill('Keep draft');
  await page.evaluate(()=>dispatchEvent(new Event('vite:preloadError')));
  await page.getByRole('button',{name:'Keep playing',exact:true}).click();
  await expect(page.locator('[data-folio-editor]')).toBeFocused();
  await page.evaluate(()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){
    if(k.startsWith('birdsquad.account'))throw new DOMException('Full','QuotaExceededError');return write.call(this,k,v);};});
  await page.locator('#folio-editor-save').tap();await expect(page.locator('#folio-editor-error')).toBeVisible();
  for(const size of [{width:2560,height:1600},{width:1000,height:560}]){
    await page.setViewportSize(size);await settleCanvas(page);
    checkTargetGeometry(await targetGeometry(page,'ProfileScene'),'failed native editor');
    const screenshot=await page.screenshot({path:info.outputPath(`error-${size.width}.png`)});
    const region=await page.evaluate(()=>{
      const c=(window as any).__birdSquadGame.canvas.getBoundingClientRect(),scale=c.height/720;
      const input=document.querySelector('[data-folio-editor]')!.getBoundingClientRect();
      return{left:input.left,right:input.right,top:c.top+145*scale,bottom:input.top-12};
    });
    const pixels=PNG.sync.read(screenshot);let black=0,total=0;
    for(let y=Math.ceil(region.top);y<Math.floor(region.bottom);y++)for(let x=Math.ceil(region.left);x<Math.floor(region.right);x++){
      const i=(y*pixels.width+x)*4;total++;if(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2]===0)black++;
    }
    expect(black/total,'native recovery must not leave a black compositor rectangle over the editor heading').toBeLessThan(0.005);
    const diagnostic=await page.evaluate(()=>({dom:[...document.body.children].map(e=>({tag:e.tagName,id:e.id,
      text:e.textContent?.slice(0,180),style:e.getAttribute('style'),bounds:e.getBoundingClientRect().toJSON()})),
      canvas:(window as any).__birdSquadGame.canvas.toDataURL()}));
    await info.attach(`canvas-${size.width}`,{body:Buffer.from(diagnostic.canvas.split(',')[1],'base64'),contentType:'image/png'});
    await info.attach(`dom-${size.width}`,{body:JSON.stringify(diagnostic.dom),contentType:'application/json'});
  }
  await page.locator('#folio-editor-cancel').tap();
  await expect(page.locator('#folio-editor-actions')).toHaveCount(0);
});
