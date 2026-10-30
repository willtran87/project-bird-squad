import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {flockLeaders} from '../src/game/leaders';
import {settleCanvas} from './helpers/settled-canvas';

async function battle(page:Page,leader:string){
  await page.goto('./?flight=identity-continuity&length=full');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,r=g.scene.getScene('RouteScene');return g.scene.isActive('RouteScene')&&r.routeEssentialAssetsReady;});
  await page.evaluate(leader=>{const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene');if(r.shouldChooseDistrictContract())r.chooseDistrictContract(r.districtContractChoices()[0].id);r.runState.leaderId=leader;const n=w.__birdSquadCurrentMap().nodes.find((n:any)=>n.type==='street');r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:n.id});},leader);
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.livingPerformances?.ready&&!b.combatIntroActive&&b.combatPreviewModule&&b.root?.getByName('combat-leader-art')?.getByName('combat-leader-pose')?.getByName('combat-leader-portrait');});
}

for(const leader of flockLeaders)test(`Identity continuity ${leader.id} preserves its canonical body through actual card resolution`,async({page},info)=>{
  const errors:string[]=[],atlasRequests:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('living-battles-atlas'))atlasRequests.push(r.url());});
  await page.setViewportSize({width:2560,height:1600});await battle(page,leader.id);
  const expected=`flock-leader-${leader.id.replaceAll('_','-')}`;
  const original=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.root.getByName('combat-leader-art').getByName('combat-leader-pose').getByName('combat-leader-portrait').texture.key;});
  expect(original).toBe(expected);
  await page.screenshot({path:info.outputPath('idle-2560.png')});
  await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.identitySamples=[];
    const sample=()=>{
      const body=b.root?.getByName('combat-leader-art'),pose=body?.getByName('combat-leader-pose'),image=pose?.getByName('combat-leader-portrait');
      if(!image)return;
      const forbidden=b.fxLayer.list.filter((o:any)=>/^(living-bird-|identity-signature-|opening-bird-reaction|flyway-card-bird|flyway-suit-action)/.test(o.name));
      b.identitySamples.push({key:image.texture.key,visible:body.visible&&pose.visible&&image.visible,x:pose.x,y:pose.y,scale:pose.scaleX,phase:pose.getData('performancePose')??'idle',forbidden:forbidden.length});
      if(b.identitySamples.length>=240)b.events.off('postupdate',sample);
    };b.events.on('postupdate',sample);b.identitySampler=sample;
    const card=b.allDeckCards().find((c:any)=>c.id==='swords_ace');
    for(const zone of ['hand','drawPile','discardPile','clearedPile'])b[zone]=b[zone].filter((c:any)=>c.instanceId!==card.instanceId);
    b.hand.unshift(card);b.energy=20;b.enemies[0].hp=b.enemies[0].maxHp=1000;b.renderAll();b.playCard(card,b.enemies[0].id,{resolveDelayMs:650});
  });
  await page.waitForTimeout(200);await page.screenshot({path:info.outputPath('commit-2560.png')});
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return !b.combatAnimationPending&&b.identitySamples.some((s:any)=>s.phase==='recovery')&&b.livingPerformances.active.length===0;});
  const samples=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.events.off('postupdate',b.identitySampler);return b.identitySamples;});
  expect(samples.length).toBeGreaterThan(10);expect(samples.every((s:any)=>s.key===expected&&s.visible&&s.scale===1&&s.forbidden===0)).toBe(true);
  expect(samples.some((s:any)=>s.phase==='anticipation')).toBe(true);expect(samples.some((s:any)=>s.phase==='contact')).toBe(true);
  expect(samples.every((s:any)=>Math.abs(s.x)<=10.01&&Math.abs(s.y)<=4.01)).toBe(true);
  const idle=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),p=b.root.getByName('combat-leader-art').getByName('combat-leader-pose');return {x:p.x,y:p.y,angle:p.angle,alpha:p.alpha};});
  expect(idle).toEqual({x:0,y:0,angle:0,alpha:1});
  for(const size of [{width:1440,height:900},{width:1000,height:560}]){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`settled-${size.width}.png`)});}
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');localStorage.setItem('birdsquad.motionPreference','reduced');b.renderAll();b.events.emit('living-cast',900,'swoop',b.enemies[0].id);});
  await page.waitForTimeout(100);
  const still=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),p=b.root.getByName('combat-leader-art').getByName('combat-leader-pose');return {x:p.x,y:p.y,angle:p.angle,key:p.getByName('combat-leader-portrait').texture.key};});
  expect(still.key).toBe(expected);expect(Math.hypot(still.x,still.y,still.angle)).toBe(0);expect(errors).toEqual([]);expect(atlasRequests).toEqual([]);
  await info.attach('frame-identities',{body:JSON.stringify(samples),contentType:'application/json'});
});

test('Identity continuity leader exports preserve source transparency',async({page})=>{
  for(const name of ['fledgling-flock','spark-caller','talon','tidewarden','roostkeeper']){
    const base=`assets/runtime/flock/leaders/${name}-combat-back-ne`;
    const pixels=await page.evaluate(async({png,webp})=>{
      const load=async(src:string)=>{const image=new Image();image.src=src;await image.decode();return image;};
      const [source,runtime]=await Promise.all([load(png),load(webp)]);
      const draw=(image:HTMLImageElement)=>{const canvas=document.createElement('canvas');canvas.width=runtime.width;canvas.height=runtime.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0,canvas.width,canvas.height);return ctx.getImageData(0,0,canvas.width,canvas.height).data;};
      const a=draw(source),b=draw(runtime);let filledBackground=0,erasedBody=0;
      // Ignore a 3px silhouette edge: browser and exporter resamplers differ.
      for(let y=3;y<runtime.height-3;y++)for(let x=3;x<runtime.width-3;x++){
        let clear=true,solid=true;
        for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const alpha=a[((y+dy)*runtime.width+x+dx)*4+3];clear&&=alpha===0;solid&&=alpha===255;}
        // Lanczos may retain faint edge ringing where the browser rounds to zero.
        const alpha=b[(y*runtime.width+x)*4+3];if(clear&&alpha>16)filledBackground++;if(solid&&alpha<250)erasedBody++;
      }return {filledBackground,erasedBody};
    },{png:`data:image/png;base64,${readFileSync(`${base}.png`).toString('base64')}`,webp:`data:image/webp;base64,${readFileSync(`${base}.webp`).toString('base64')}`});
    expect(pixels,`${name} source/export alpha`).toEqual({filledBackground:0,erasedBody:0});
  }
});

test('Identity continuity card cues stay clear of combatants and labels in crowded layouts',async({page},info)=>{
  await page.setViewportSize({width:2560,height:1600});await battle(page,'fledgling');
  for(const count of [1,3,4])for(const boss of count===4?[false,true]:[false])for(const target of count===1?[0]:[0,count-1]){
    await page.evaluate(({count,boss,target})=>{
      const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),original=structuredClone(b.enemies[0]);
      b.enemies=Array.from({length:count},(_,i)=>({...structuredClone(original),id:`audit-${i}`,hp:1000,maxHp:1000,runtime:{...original.runtime,type:boss&&i===0?'boss':'normal'}}));
      b.selectedEnemyId=b.enemies[target].id;b.renderAll();b.time.paused=true;b.tweens.pauseAll();
      const card=b.allDeckCards().find((c:any)=>c.id==='swords_ace');b.combatFxModule.playFlockAction(b,card,b.selectedEnemyId,b.activeCardContract(card),650);b.combatPlayerCommitSigil(card,b.selectedEnemyId,b.activeCardContract(card),650);
    },{count,boss,target});
    for(const step of [0,100,220,250]){
      const evidence=await page.evaluate(step=>{
        const w=window as any,b=w.__birdSquadGame.scene.getScene('BattleScene');b.time.paused=false;b.tweens.resumeAll();if(step)w.advanceTime(step);b.time.paused=true;b.tweens.pauseAll();
        const cue=b.fxLayer.getByName('combat-card-cast-ghost'),bounds=cue.getBounds(),overlaps:string[]=[];
        const visit=(o:any)=>{
          if(o.visible&&(/combat-(enemy|leader)-portrait|combat-enemy-(intent-value|name|status)$/.test(o.name))){const r=o.getBounds();if(bounds.left<r.right&&bounds.right>r.left&&bounds.top<r.bottom&&bounds.bottom>r.top)overlaps.push(o.name);}
          o.list?.forEach(visit);
        };visit(b.root);
        return {overlaps,top:bounds.top,bottom:bounds.bottom,seal:cue.list.filter((o:any)=>o.name==='combat-player-commit-sigil').length,standalone:b.fxLayer.list.filter((o:any)=>o.name==='combat-player-commit-sigil').length};
      },step);
      expect(evidence.overlaps,`${count} enemies, boss ${boss}, target ${target}, step ${step}`).toEqual([]);
      expect(evidence.top).toBeGreaterThan(96);expect(evidence.bottom).toBeLessThan(370);expect(evidence.seal).toBe(1);expect(evidence.standalone).toBe(0);
    }
    await page.screenshot({path:info.outputPath(`crowded-${count}-${boss}-target-${target}-2560.png`)});
    await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.time.paused=false;b.tweens.resumeAll();(window as any).advanceTime(900);});
  }
  const cleanup=await page.evaluate(()=>new Promise(resolve=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    for(let i=0;i<20;i++){b.events.emit('living-cast',600);b.events.emit('flyway-call');b.events.emit('flyway-combination',{id:'brace-cut',name:'Brace & Cut'});}
    b.mode='defeat';
    // advanceTime steps clocks/tweens, not postupdate. Observe the actual next
    // presentation frame instead of depending on a browser's RAF cadence.
    b.events.once('postupdate',()=>{
      const p=b.root.getByName('combat-leader-art').getByName('combat-leader-pose');
      resolve({active:b.livingPerformances.active,x:p.x,y:p.y,angle:p.angle});
    });
  }));
  expect(cleanup).toEqual({active:[],x:0,y:0,angle:0});
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').scene.stop());
  await expect(page.locator('#identity-sequence')).toHaveCount(0);
});
