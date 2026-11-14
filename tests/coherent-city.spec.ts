import { test, expect, type Page } from '@playwright/test';
import { AudioCueBudget } from '../src/game/audio-cue-budget';
import { settleCanvas } from './helpers/settled-canvas';

test.describe('Coherent City',()=>{

const sizes = [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}];
const state = (p: Page) => p.evaluate(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}'));
const lessonState = (p: Page) => p.evaluate(()=>(window as any).__birdSquadGame.registry.get('birdsquad.practiceLesson'));
async function boot(page: Page) {
  await page.goto('./?flight=coherent-city&length=full');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
}

for(const [index,id] of [[0,'cover'],[4,'deck']] as const) test(`failed ${id} lesson retries immediately without changing the saved flight`,async({page},info)=>{
  test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await boot(page);await page.keyboard.press('h');
  await expect.poll(async()=>(await state(page)).helpFocus?.label).toBe('Practice lessons');await page.keyboard.press('Enter');
  await expect.poll(async()=>(await state(page)).helpTopic).toContain('Practice lessons.');
  for(let i=0;i<index;i++){
    await page.keyboard.press('ArrowDown');
    await expect.poll(async()=>(await state(page)).helpFocus?.index).toBe(i+1);
  }
  await page.keyboard.press('Enter');await expect.poll(async()=>(await state(page)).helpFocus?.label).toBe('Start lesson');
  const before=await page.evaluate(()=>JSON.stringify(localStorage));await page.keyboard.press('Enter');
  for(let retry=0;retry<2;retry++){
    await page.waitForFunction(id=>{const g=(window as any).__birdSquadGame,s=g.registry.get('birdsquad.practiceLesson'),b=g.scene.getScene('BattleScene');return s?.id===id&&!s.finished&&(id==='deck'||!b.combatIntroActive&&!b.combatAnimationPending);},id);
    await page.evaluate(id=>{const g=(window as any).__birdSquadGame;if(id==='deck'){const r=g.scene.getScene('RouteScene');r.cardPickerMode=undefined;r.renderAll();}else{const b=g.scene.getScene('BattleScene');b.flock.hp=0;b.checkOutcome();}},id);
    await expect.poll(async()=>(await lessonState(page))?.finished).toBe(true);
    expect((await lessonState(page)).complete).toBe(false);
    expect((await lessonState(page)).instruction).toContain('Try this first:');
    if(!retry)for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`retry-${size.width}.png`)});}
    expect(await page.evaluate(()=>JSON.stringify(localStorage))).toBe(before);
    await settleCanvas(page);await page.keyboard.press('Enter');
  }
  await expect.poll(async()=>(await lessonState(page))?.finished??false).toBe(false);
  await page.evaluate(id=>{const g=(window as any).__birdSquadGame;g.scene.getScene(id==='deck'?'RouteScene':'BattleScene').scene.start('MenuScene');},id);
  await expect.poll(async()=>(await state(page)).titleBoot?.ready).toBe(true);
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).toBe(before);expect(errors).toEqual([]);
});

test('every lesson briefing preserves saves, fits all sizes and restores the selected lesson', async ({page}, info) => {
  test.setTimeout(120000);
  const errors: string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await boot(page); await page.keyboard.press('h');
  await expect.poll(async()=>(await state(page)).helpFocus?.label).toBe('Practice lessons');
  await page.keyboard.press('Enter');
  await expect.poll(async()=>(await state(page)).helpTopic).toContain('Practice lessons.');
  const before=await page.evaluate(()=>JSON.stringify(localStorage));
  for(let index=0;index<5;index++) {
    await expect.poll(async()=>(await state(page)).helpFocus.index).toBe(index);
    await page.keyboard.press('Enter');
    await expect.poll(async()=>(await state(page)).helpFocus.label).toBe('Start lesson');
    await expect.poll(async()=>(await state(page)).helpTopic).toContain(`Lesson ${index+1}:`);
    for(const size of sizes) {
      await page.setViewportSize(size); await settleCanvas(page);
      const geometry=await page.evaluate(()=>{
        const m=(window as any).__birdSquadGame.scene.getScene('MenuScene'),list=m.helpOverlay.list;
        const texts=list.filter((o:any)=>o.name==='lesson-briefing-copy').map((o:any)=>o.getBounds());
        const art=list.find((o:any)=>o.name==='lesson-briefing-art');
        const actions=list.filter((o:any)=>o.name==='practice-lesson-action').map((o:any)=>o.getBounds());
        return {art:art?.texture.key,fit:texts.every((b:any)=>b.left>=620&&b.right<=1210&&b.top>=60&&b.bottom<=680),
          separated:texts.every((b:any,i:number)=>i===texts.length-1||b.bottom<texts[i+1].top),
          controls:actions.every((b:any)=>b.top>texts[5].bottom&&b.bottom<texts[6].top)};
      });
      expect(geometry).toEqual({art:'splash',fit:true,separated:true,controls:true});
      await page.screenshot({path:info.outputPath(`briefing-${index}-${size.width}.png`)});
    }
    expect(await page.evaluate(()=>JSON.stringify(localStorage))).toBe(before);
    await page.keyboard.press('Escape');
    await expect.poll(async()=>(await state(page)).helpFocus.index).toBe(index);
    if(index<4)await page.keyboard.press('ArrowDown');
  }
  expect(errors).toEqual([]);
});

test('district arrivals keep the same hierarchy and allow one intentional contract choice',async({page},info)=>{
  test.setTimeout(120000); const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await boot(page);await page.keyboard.press('Enter');
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  for(const index of [1,2,3]) {
    await page.evaluate(index=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.scene.restart({runState:{...r.runState,mapIndex:index}});},index);
    await page.waitForFunction(index=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return r.runState.mapIndex===index&&r.children.getByName('district-arrival-title');},index);
    for(const size of sizes){
      await page.setViewportSize(size);await settleCanvas(page);
      expect(await page.evaluate(()=>{
        const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');
        const a=r.children.getByName('district-arrival-title').getBounds(),b=r.children.getByName('district-arrival-premise').getBounds(),c=r.children.getByName('district-arrival-question').getBounds();
        const header=r.children.getByName('district-arrival-header').getBounds();
        return a.bottom<b.top&&b.bottom<137&&c.top>575&&c.bottom<700&&a.top>=header.top&&b.bottom<=header.bottom&&[a,b,c].every(b=>b.left>=40&&b.right<=1240);
      })).toBe(true);
      await page.screenshot({path:info.outputPath(`arrival-${index}-${size.width}.png`)});
    }
    await page.keyboard.press('ArrowRight');
    const selected=await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return r.districtContractChoices()[r.districtContractFocusIndex].id;});
    await page.keyboard.press('Enter');
    await expect.poll(()=>page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return r.activeDistrictContract()?.confirmed;})).toBe(true);
    expect(await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return r.activeDistrictContract().id;})).toBe(selected);
  }
  expect(errors).toEqual([]);
});

test('district ambience yields to decisive cues without suppressing tactical sound',()=>{
  for(const cue of ['rooftopAir','canalAir','spireAir','roostAir'] as const){
    const budget=new AudioCueBudget(); expect(budget.accepts('attack',0)).toBe(true);
    expect(budget.accepts(cue,30)).toBe(false);expect(budget.accepts('coverBreak',40)).toBe(true);
    expect(budget.accepts(cue,150)).toBe(true);
  }
});

test('resident memories and resume framing follow saved events without granting another reward',async({page},info)=>{
  await boot(page);await page.keyboard.press('Enter');
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.evaluate(()=>{
    const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');
    Object.assign(r.runState.flyway,{rooftopPlan:'tempo',canalFerry:{pledge:'lamps',startedAt:0,rewarded:true},spireRelay:{pledge:'wires',startedAt:0,rewarded:true,delivered:true},cityAid:['sella']});
    r.checkpointRouteIfChanged(true);
  });
  await page.keyboard.press('j');await page.getByRole('button',{name:'City & crossings',exact:true}).click();
  await expect(page.locator('#flyway-book')).toContainText('Your pledge of lamps keeps the ferry crossing');
  await expect(page.locator('#flyway-book')).toContainText('Your warning reached High Roost');
  await expect(page.locator('#flyway-book')).toContainText('I was glad to shelter you at the summit');
  const before=await page.evaluate(()=>JSON.stringify(localStorage));
  for(const size of sizes){await page.setViewportSize(size);await page.getByRole('heading',{name:/Oren Shearbright · trust/}).scrollIntoViewIfNeeded();expect(await page.locator('#flyway-book').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`resident-${size.width}.png`)});}
  await page.keyboard.press('Escape');
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').scene.start('MenuScene'));
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').children.getByName('title-resume-context'));
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);
    const context=await page.evaluate(()=>{const c=(window as any).__birdSquadGame.scene.getScene('MenuScene').children.getByName('title-resume-context');return {text:c.text,bottom:c.getBounds().bottom};});
    expect(context.text).toContain('Your plan: Chorus Engine');expect(context.bottom).toBeLessThan(440);
    await page.screenshot({path:info.outputPath(`resume-${size.width}.png`)});
  }
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).toBe(before);
});

for(const reduced of [false,true]) test(`weather yields through a real action; forecast and history explain results, reduced=${reduced}`,async({page},info)=>{
  await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
  await boot(page);await page.keyboard.press('Enter');
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:'m1_entry'});});
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.livingPerformances?.ready&&b.combatPreviewModule&&!b.combatIntroActive&&b.backdropLayer?.getByName('combat-weather-priority');});
  await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    const card=b.allDeckCards().find((c:any)=>c.id==='major_00');
    for(const zone of ['hand','drawPile','discardPile','clearedPile']) b[zone]=b[zone].filter((c:any)=>c.instanceId!==card.instanceId);
    b.hand.unshift(card); b.onCardClicked(card.instanceId);
  });
  for(const size of sizes){
    await page.setViewportSize(size);await settleCanvas(page);
    const notice=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),n=b.root.getByName('combat-selection-preview').getByName('combat-selection-notice');return {text:n.text,width:n.width};});
    expect(notice.text).toContain('Forecast ~ draw effects');expect(notice.width).toBeLessThan(620);
    await page.screenshot({path:info.outputPath(`forecast-${size.width}.png`)});
  }
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.playCard(b.hand[0],b.enemies[0].id,{resolveDelayMs:650});});
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.combatAnimationPending&&b.backdropLayer.getByName('combat-weather-priority').alpha===.25;});
  await page.screenshot({path:info.outputPath('action-weather.png')});
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return !b.combatAnimationPending&&!b.motionFocus?.active&&b.backdropLayer.getByName('combat-weather-priority').alpha===1;});
  const result=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.flock.block=2;
    const before=b.flock.hp,blocked=b.statBlocked;b.resolveEnemyTurn();
    return {lost:before-b.flock.hp,blocked:b.statBlocked-blocked,lines:b.combatHistory.filter((s:string)=>s.includes('Cover absorbed'))};
  });
  expect(result.lines.length).toBeGreaterThan(0);
  expect(result.lines.reduce((n:number,s:string)=>n+Number(s.match(/Cover absorbed (\d+)/)?.[1]??0),0)).toBe(result.blocked);
  expect(result.lines.reduce((n:number,s:string)=>n+Number(s.match(/(\d+) Cohesion lost/)?.[1]??0),0)).toBe(result.lost);
});
});
