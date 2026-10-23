import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { settleCanvas } from './helpers/settled-canvas';
import { installVirtualController, pressController } from './helpers/virtual-controller';

test.use({hasTouch:true});
const state=(page:Page)=>page.evaluate(()=>JSON.parse((window as any).render_game_to_text()));
async function tap(page:Page,name:string){
  await settleCanvas(page);
  const p=await page.evaluate(name=>{const s=(window as any).__birdSquadGame.scene.getScene('ProfileScene'),h=s.children.getByName(name),c=s.game.canvas.getBoundingClientRect();return{x:c.left+h.x*c.width/1280,y:c.top+h.y*c.height/720};},name);
  await page.touchscreen.tap(p.x,p.y);await settleCanvas(page);
}
async function boot(page:Page){
  await page.setViewportSize({width:2560,height:1600});await installVirtualController(page);
  await page.addInitScript(()=>{localStorage.setItem('birdsquad.runs',JSON.stringify([{id:'run-1770000000000-ratings',seed:'ratings',result:'win',deck:[{id:'wands_ace'}],path:['m1_entry'],runMode:'quick',turnsTaken:4}]));});
  await page.goto('./?playtest=1');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(async()=>{const w=window as any;await w.__birdSquadEnsureScene('ProfileScene');w.__birdSquadGame.scene.stop('MenuScene');w.__birdSquadGame.scene.start('ProfileScene');});
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text()).scene==='ProfileScene');
  await tap(page,'profile-save-data-hit');
}
async function focus(page:Page,id:string){for(let i=0;i<35&&(await state(page)).folioFocus.action!==id;i++)await page.keyboard.press('Tab');expect((await state(page)).folioFocus.action).toBe(id);}

test('Save controls expose every rating and Back with stable focus, roles and no implicit mutation',async({page},info)=>{
  await boot(page);const before=await page.evaluate(()=>localStorage.getItem('birdsquad.runs'));
  await focus(page,'profile-playtest-feedback-fun-5');
  expect(await page.evaluate(()=>localStorage.getItem('birdsquad.runs'))).toBe(before);
  for(const [width,height] of [[2560,1600],[1440,900],[1000,560]]){
    await page.setViewportSize({width,height});await settleCanvas(page);
    await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('ProfileScene').renderPremiumProfileScene());
    expect((await state(page)).folioFocus.action).toBe('profile-playtest-feedback-fun-5');
    const focused=await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('ProfileScene');return s.children.list.filter((o:any)=>o.getData?.('controlKind')&&o.getData('focused')).map((o:any)=>o.name);});
    expect(focused).toEqual(['profile-playtest-feedback-fun-5']);
    await page.screenshot({path:info.outputPath(`ratings-${width}.png`)});
  }
  await pressController(page,0);expect((await state(page)).playtestFeedback.ratings.fun).toBe(5);
  expect((await state(page)).folioFocus.action).toBe('profile-playtest-feedback-fun-5');
  await focus(page,'profile-save-close');await page.keyboard.press('Enter');
  expect((await state(page)).saveData.open).toBe(false);expect((await state(page)).focus.current).toBe('saveData');
});

test('restore confirmation defaults to safe Cancel and Back returns one layer to exact opener',async({page},info)=>{
  await boot(page);
  const downloadEvent=page.waitForEvent('download');await tap(page,'profile-save-download-hit');
  const file=await (await downloadEvent).path();expect(file).toBeTruthy();const raw=await readFile(file!);
  const before=await page.evaluate(()=>localStorage.getItem('birdsquad.account'));
  for(const mode of ['keyboard','controller','touch']){
    const event=page.waitForEvent('filechooser');await tap(page,'profile-save-restore-file-hit');
    await (await event).setFiles({name:'backup.json',mimeType:'application/json',buffer:raw});
    await expect.poll(async()=>(await state(page)).saveData.status).toBe('restoreReady');
    expect((await state(page)).folioFocus.action).toBe('profile-save-restore-cancel-hit');
    const roles=await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('ProfileScene');return ['profile-save-restore-confirm-hit','profile-save-restore-cancel-hit'].map(n=>s.children.getByName(n).getData('controlKind'));});
    expect(roles).toEqual(['destructive','primary']);
    await page.screenshot({path:info.outputPath(`restore-${mode}.png`)});
    if(mode==='keyboard')await page.keyboard.press('Escape');
    else if(mode==='controller')await pressController(page,1);
    else await tap(page,'profile-save-close');
    expect((await state(page)).saveData).toMatchObject({open:true,pending:null});
    expect((await state(page)).folioFocus.action).toBe('profile-save-restore-file-hit');
    expect(await page.evaluate(()=>localStorage.getItem('birdsquad.account'))).toBe(before);
  }
  await page.keyboard.press('Escape');expect((await state(page)).saveData.open).toBe(false);
});
