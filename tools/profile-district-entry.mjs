import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Native-clock investigation. Fresh contexts isolate cold image/module caches;
// repeats in the same context measure warm entry. No advanceTime or rule edits.
const url = process.argv[2] ?? 'http://127.0.0.1:5452/';
const output = process.argv[3] ?? '.artifacts/coherent-city/entry-profile.json';
const profileCpu = process.env.BIRD_SQUAD_ENTRY_CPU === '1';
const stubGamepads = process.env.BIRD_SQUAD_ENTRY_GAMEPAD_STUB === '1';
const browser = await chromium.launch({headless:true});
const samples=[], errors=[];
try {
  for(let cold=0;cold<(profileCpu?1:4);cold++) {
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    if(stubGamepads) await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
    await page.addInitScript(()=>{
      window.entryTasks=[];
      new PerformanceObserver(list=>window.entryTasks.push(...list.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
      window.entryFrames=[];let last=performance.now();
      const tick=t=>{window.entryFrames.push({start:last,ms:t-last});last=t;requestAnimationFrame(tick);};requestAnimationFrame(tick);
    });
    await page.goto(`${url}?flight=coherent-entry&length=full`);
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text?.()??'{}').titleBoot?.ready);
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>window.__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
    await page.evaluate(()=>{const r=window.__birdSquadGame.scene.getScene('RouteScene');window.entryRun=structuredClone(r.runState);window.entryNode=window.__birdSquadCurrentMap().nodes.find(n=>n.type==='street').id;});
    const cdp=profileCpu?await context.newCDPSession(page):undefined;
    if(cdp){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
    for(let warm=0;warm<2;warm++) {
      await page.evaluate(()=>{
        window.entryStart=performance.now();
        const g=window.__birdSquadGame;g.scene.stop('RouteScene');g.scene.stop('BattleScene');
        g.scene.start('BattleScene',{runState:structuredClone(window.entryRun),routeNodeId:window.entryNode});
      });
      await page.waitForFunction(()=>{const b=window.__birdSquadGame.scene.getScene('BattleScene');return b.battleStartingData?.runState.seed===window.entryRun.seed&&b.scene.isActive()&&b.combatPreviewModule&&b.battleHandRendererModule&&!b.combatInteractionLocked();});
      samples.push(await page.evaluate(({cold,warm})=>{
        const t=window.entryStart,end=performance.now(),frames=window.entryFrames.filter(e=>e.start>=t).map(e=>e.ms).sort((a,b)=>a-b);
        return {cold,warm:!!warm,ms:end-t,frameMaxMs:frames.at(-1),frameP95Ms:frames[Math.floor(frames.length*.95)],
          longTasks:window.entryTasks.filter(e=>e.start>=t),resources:performance.getEntriesByType('resource').filter(e=>e.startTime>=t).map(e=>({name:e.name.split('/').at(-1),ms:e.duration,bytes:e.transferSize}))};
      },{cold,warm}));
      await page.evaluate(()=>window.__birdSquadGame.scene.getScene('BattleScene').scene.stop());
      await page.waitForFunction(()=>!window.__birdSquadGame.scene.isActive('BattleScene'));
    }
    if(cdp){const {profile}=await cdp.send('Profiler.stop');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output+'.cpuprofile',JSON.stringify(profile));}
    await context.close();
  }
} finally {await browser.close();}
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify({url,clock:'native',profileCpu,stubGamepads,viewport:[1440,900],samples,errors},null,2));
console.log(JSON.stringify({samples:samples.map(({resources,longTasks,...s})=>({...s,requests:resources.length,longTasks:longTasks.length})),errors}));
if(errors.length)process.exitCode=1;
