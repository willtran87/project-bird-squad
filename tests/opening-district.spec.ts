import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

async function route(page: Page) {
  await page.goto('./?flight=opening-benchmark&length=quick');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');return s.routeEssentialAssetsReady && s.openFlyway && s.openingDistrict;});
}
async function battle(page: Page) {
  await page.evaluate(() => { const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:'m1_entry'}); });
  await page.waitForFunction(() => {const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.openingDistrict && b.combatPreviewModule && b.battleCoreUiReady && b.fxLayer?.active && !b.combatAnimationPending && !b.combatIntroActive;});
}
test.afterEach(async ({page}) => { await page.goto('about:blank'); });

test('strategy choices are accessible, reversible and persist across a real checkpoint reload', async ({page}, info) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await route(page); await page.locator('#flyway-launch').click();
  for (const viewport of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(viewport); await settleCanvas(page);
    await page.getByRole('heading',{name:'Find your Rooftops strategy'}).scrollIntoViewIfNeeded();
    await page.getByRole('button',{name:'Follow Chorus Engine',exact:true}).scrollIntoViewIfNeeded();
    expect(await page.locator('#flyway-book').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath(`plans-${viewport.width}.png`)});
  }
  for (const name of ['Hold & Answer','Chorus Engine','Storm Window']) {
    const button=page.getByRole('button',{name:`Follow ${name}`,exact:true});await button.click();
    await expect(button).toHaveAttribute('aria-pressed','true');
  }
  await page.getByRole('button',{name:'Keep drafts open',exact:true}).click();
  await expect(page.getByRole('button',{name:'Follow Storm Window',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Follow Hold & Answer',exact:true}).click();
  await page.getByRole('button',{name:'Hide Rooftops coaching',exact:true}).click();
  await page.keyboard.press('Escape');await page.reload();
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').continueRun());
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  expect(await page.evaluate(()=>{const f=(window as any).__birdSquadGame.scene.getScene('RouteScene').runState.flyway;return {plan:f.rooftopPlan,off:f.coachingOff};})).toEqual({plan:'shelter',off:true});
  expect(errors).toEqual([]);
});

test('plan drafting favors its engine without duplicate or owned cards and stops outside Rooftops',async({page})=>{
  await route(page);
  const base=await page.evaluate(()=>structuredClone((window as any).__birdSquadGame.scene.getScene('RouteScene').runState));
  await battle(page);
  const result=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');const owned=new Set(b.allDeckCards().map((c:any)=>c.id));
    const match=(c:any)=>/gainCover|fullyBlocksNextAttack|retainHand/.test(c.runtime.effects.join(' '));
    const sample=(plan:string|undefined)=>{let matches=0;const signatures:string[]=[];
      for(let seed=1;seed<=256;seed++) {let n=Math.imul(seed,2654435761)>>>0;b.combatRandom=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};b.flyway.rooftopPlan=plan;
        const choices=b.createRewardChoices();if(new Set(choices.map((c:any)=>c.id)).size!==choices.length||choices.some((c:any)=>owned.has(c.id)))throw Error('Invalid draft');
        matches+=choices.filter(match).length;signatures.push(choices.map((c:any)=>c.id).join(','));}
      return {matches,signatures};};
    return {open:sample(undefined),shelter:sample('shelter')};
  });
  expect(result.shelter.matches).toBeGreaterThan(result.open.matches);
  expect(result.shelter.signatures).not.toEqual(result.open.signatures);
  await page.evaluate(base=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.scene.start('RouteScene',{runState:{...base,mapIndex:1}});},base);
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,r=g.scene.getScene('RouteScene');return g.scene.isActive('RouteScene')&&r.runState.mapIndex===1&&r.routeEssentialAssetsReady;});
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene'),m=(window as any).__birdSquadCurrentMap();r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:m.entryNodeId});});
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,b=g.scene.getScene('BattleScene');return g.scene.isActive('BattleScene')&&b.flywayMapIndex===1&&b.fxLayer?.active;});
  expect(await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');const sample=(plan:any)=>{b.flyway.rooftopPlan=plan;b.combatRandom=()=>.35;return b.createRewardChoices().map((c:any)=>c.id);};return JSON.stringify(sample(undefined))===JSON.stringify(sample('shelter'));})).toBe(true);
});

test('real combinations trigger a bounded bird reaction and contextual coaching respects off and district',async({page},info)=>{
  await route(page);await page.keyboard.press('j');
  await page.getByRole('button',{name:'Follow Hold & Answer',exact:true}).click();await page.keyboard.press('Escape');
  await battle(page);
  const result=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.enemies[0].hp=b.enemies[0].maxHp=100;b.energy=6;b.combatAnimationPending=false;
    const all=b.allDeckCards();const take=(id:string)=>{const c=all.find((c:any)=>c.id===id);for(const zone of ['hand','drawPile','discardPile','clearedPile'])b[zone]=b[zone].filter((x:any)=>x.instanceId!==c.instanceId);b.hand.push(c);return c;};
    const nest=take('pentacles_04'),quill=take('swords_ace');b.playCard(nest,b.enemies[0].id);
    const hints:any[]=[];b.events.emit('opening-coaching',hints);
    b.playCard(quill,b.enemies[0].id);b.renderAll();
    const hidden:any[]=[];b.flyway.coachingOff=true;b.events.emit('opening-coaching',hidden);delete b.flyway.coachingOff;
    const later:any[]=[];b.flywayMapIndex=1;b.events.emit('opening-coaching',later);b.flywayMapIndex=0;
    return {hints,hidden,later,combo:b.flyway.combinations,reaction:{...b.openingDistrict}};
  });
  expect(result.hints[0].text).toContain('Brace & Cut');expect(result.hidden).toEqual([]);expect(result.later).toEqual([]);
  expect(result.combo).toBe(1);expect(result.reaction.last).toBe('combo');
  await page.screenshot({path:info.outputPath('combo-reaction.png')});
  await info.attach('reaction-clock', {body:JSON.stringify(await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {now:b.time.now,paused:b.time.paused,scale:b.time.timeScale,scene:b.sys.settings.status,hidden:document.hidden,loopRunning:b.game.loop.running};})),contentType:'application/json'});
  await page.evaluate(()=>(window as any).advanceTime(1200));
  await expect.poll(()=>page.evaluate(()=>!!(window as any).__birdSquadGame.scene.getScene('BattleScene').fxLayer.getByName('opening-bird-reaction'))).toBe(false);
});

test('saved shelter support changes the route and artwork completions coalesce',async({page},info)=>{
  await route(page);await page.keyboard.press('j');
  await page.getByRole('button',{name:'City & crossings',exact:true}).click();
  await page.getByRole('button',{name:'Leave 10 Scrap for the shelter',exact:true}).click();await page.keyboard.press('Escape');
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('opening-neighborhood'));
  for(const viewport of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(viewport);await settleCanvas(page);await page.screenshot({path:info.outputPath(`neighborhood-${viewport.width}.png`)});
  }
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.testRedrawCount=0;r.testOriginalRender=r.renderAll;r.renderAll=function(){r.testRedrawCount++;return r.testOriginalRender.call(this);};
    for(let i=0;i<12;i++)r.refreshRouteArtwork();});
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').testRedrawCount)).toBe(1);
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.renderAll=r.testOriginalRender;delete r.testOriginalRender;delete r.testRedrawCount;});
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene'),m=(window as any).__birdSquadCurrentMap();const node=m.nodes.find((n:any)=>n.id===m.bossNodeId),p=r.nodePosition(node);r.showNodeTooltip(node,p.x,p.y-78);r.refreshRouteArtwork();});
  await settleCanvas(page);
  expect(await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return {reading:!!r.children.getByName('route-node-tooltip')?.active,pending:r.routeArtworkRefreshPending};})).toEqual({reading:true,pending:true});
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-node-tooltip').destroy(true));
  await page.waitForFunction(()=>!(window as any).__birdSquadGame.scene.getScene('RouteScene').routeArtworkRefreshPending);
  await page.keyboard.press('j');
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.isPaused('RouteScene'));
  expect(await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.refreshRouteArtwork();return r.routeArtworkRefreshPending;})).toBe(true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!(window as any).__birdSquadGame.scene.getScene('RouteScene').routeArtworkRefreshPending);
  const timings=await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');const key='birdsquad.animationPace';const old=localStorage.getItem(key);const values=['relaxed','standard','fast'].map(value=>{localStorage.setItem(key,value);return r.routeCommitDelayMs();});if(old===null)localStorage.removeItem(key);else localStorage.setItem(key,old);return values;});
  expect(timings[0]).toBeGreaterThan(timings[1]);expect(timings[1]).toBeGreaterThan(timings[2]);
});

test('Crow purpose and coaching stay readable; reduced-motion reactions work without portrait art',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await route(page);
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.runState.flyway.rooftopPlan='molt';
    r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:(window as any).__birdSquadCurrentMap().bossNodeId});});
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.openingDistrict&&b.battleHudRendererModule&&b.fxLayer?.active&&!b.combatIntroActive&&!b.combatAnimationPending;});
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.introPlayed=false;b.playBattleIntro();b.time.timeScale=0;});
  for(const viewport of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(viewport);await settleCanvas(page);
    const purpose=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');const visit=(items:any[]):any=>{for(const item of items){if(item.name==='opening-encounter-purpose')return item;const found=visit(item.list??[]);if(found)return found;}};const t=visit(b.fxLayer.list);return {text:t.text,bottom:t.getBounds().bottom};});
    expect(purpose.text).toContain('Winded disrupts the Crow once');expect(purpose.bottom).toBeLessThan(680);
    await page.screenshot({path:info.outputPath(`crow-purpose-${viewport.width}.png`)});
  }
  const result=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.combatIntroFinish?.(true);b.time.timeScale=1;
    const hints:any[]=[];b.events.emit('opening-coaching',hints);
    b.root.getByName('combat-leader-art')?.removeAll(true);b.events.emit('opening-impact',{blocked:8,lost:0,hp:b.flock.hp});
    return {hint:hints[0]?.text,reaction:b.openingDistrict.last};});
  expect(result.hint).toContain('Crow or escorts');expect(result.reaction).toBe('block');
  await page.evaluate(()=>(window as any).advanceTime(1200));
  await expect.poll(()=>page.evaluate(()=>!!(window as any).__birdSquadGame.scene.getScene('BattleScene').fxLayer.getByName('opening-bird-reaction'))).toBe(false);
});

test('strategy presentation stays off title boot and a failed download offers recovery',async({page})=>{
  await page.goto('./');
  await page.waitForFunction(()=>(window as any).__birdSquadGame?.scene.getScene('MenuScene').openFlyway);
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(e=>/\/opening-district-/.test(e.name)))).toBe(false);
  await page.route('**/assets/opening-district-*.js',route=>route.abort());
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return r.routeEssentialAssetsReady&&r.openFlyway;});
  await expect(page.getByRole('dialog',{name:'Download recovery'})).toBeVisible();
  await page.getByRole('button',{name:'Keep playing',exact:true}).click();
  await page.keyboard.press('j');await expect(page.getByRole('button',{name:'Strategy recovery options',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.isActive('RouteScene'))).toBe(true);
});
