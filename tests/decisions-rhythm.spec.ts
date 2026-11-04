import { test, expect, type Page } from '@playwright/test';
import { normalizeFlyway, combinations } from '../src/game/flyway-rules';
import { flightHighlights } from '../src/game/flight-highlights';
import { settleCanvas } from './helpers/settled-canvas';
import { screenReaderSummary } from '../src/game/screen-reader-summary';

const sizes = [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}];
async function route(page: Page) {
  await page.goto('./?flight=decisions-rhythm&length=full');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,r=g.scene.getScene('RouteScene');return g.scene.isActive('RouteScene')&&r.routeEssentialAssetsReady&&r.openFlyway;});
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');if(r.shouldChooseDistrictContract())r.chooseDistrictContract(r.districtContractChoices()[0].id);});
}
async function battle(page: Page) {
  await route(page);
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');localStorage.setItem('birdsquad.firstFlightGuide',JSON.stringify({enabled:false}));r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:'m1_entry'});});
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,b=g.scene.getScene('BattleScene');return g.scene.isActive('BattleScene')&&b.combatPreviewModule&&b.combatFxModule&&!b.combatIntroActive&&!b.combatAnimationPending;});
}
test.afterEach(async({page})=>{await page.goto('about:blank');});

test('Decisions rhythm bounded turning points survive normalization without inventing old records',()=>{
  expect(normalizeFlyway({}).routeRhythm).toBeUndefined();
  for(const status of ['loading','slow','error']){
    const spoken=screenReaderSummary({scene:'RouteScene',routePanelDownload:status,market:{input:{count:0}}});
    expect(spoken).toContain('No purchase or card choice is committed');expect(spoken).not.toContain('no available offer');
  }
  expect(normalizeFlyway({routeRhythm:2,blockMoment:{enemy:'a',move:'b',blocked:Infinity}}).blockMoment).toBeUndefined();
  const state=normalizeFlyway({routeRhythm:1,blockMoment:{enemy:'e'.repeat(100),move:'Strike',turn:-5,blocked:999999}});
  expect(state.routeRhythm).toBe(1);expect(state.blockMoment).toEqual({enemy:'e'.repeat(80),move:'Strike',turn:0,blocked:100000});
  expect(flightHighlights(state,id=>id)[0]).toContain('No Cohesion was lost to that hit');
  state.comboMoment={id:combinations[0].id,turn:2,damage:3,cover:2,resonance:0,defeated:true};
  // Use a real allowlisted combination ID, including normalization semantics.
  const normalized=normalizeFlyway(state);
  expect(normalized.comboMoment).toBeDefined();expect(flightHighlights(normalized,id=>id)[0]).toContain('defeated its target');
});

test('Decisions rhythm varies demands across 1024 districts and preserves legacy graphs',async({page},info)=>{
  await route(page);
  const report=await page.evaluate(()=>{
    const [blueprints,generate,hash]=(window as any).__routeAudit;
    const counts={before:0,after:0,swaps:0,violations:[] as string[]};
    const repeat=(map:any,bp:any)=>{const previous=new Map<string,Set<string>>();let repeats=0;for(const column of map.columns)for(const id of column){const n=map.nodes.find((n:any)=>n.id===id),incoming=new Set<string>(map.edges.filter((e:any)=>e.to===id).flatMap((e:any)=>[...(previous.get(e.from)??[])])),d=bp.encounterDemands[n.payloadId];if(['street','rival','boss'].includes(n.type)){if(n.type==='street'&&d&&incoming.has(d.tactic))repeats++;previous.set(id,new Set(d?[d.tactic]:[]));}else previous.set(id,incoming);}return repeats;};
    for(const bp of blueprints)for(let i=0;i<256;i++){
      const seed=hash(`rhythm-${i}`,bp.index),old=generate(bp,seed),next=generate(bp,seed,true);
      if(JSON.stringify(old)!==JSON.stringify(generate(bp,seed,false)))counts.violations.push('legacy');
      if(JSON.stringify(next)!==JSON.stringify(generate(bp,seed,true)))counts.violations.push('determinism');
      if(JSON.stringify(old.edges)!==JSON.stringify(next.edges)||JSON.stringify(old.columns)!==JSON.stringify(next.columns))counts.violations.push('graph');
      old.nodes.forEach((n:any,j:number)=>{const newer=next.nodes[j];if(n.type!==newer.type)counts.violations.push('type');if(n.payloadId!==newer.payloadId){counts.swaps++;if(n.id===old.entryNodeId||n.type!=='street'||bp.encounterDemands[n.payloadId].enemies!==bp.encounterDemands[newer.payloadId].enemies)counts.violations.push('identity/band');}});
      counts.before+=repeat(old,bp);counts.after+=repeat(next,bp);
    }
    return counts;
  });
  expect(report.violations).toEqual([]);expect(report.swaps).toBeGreaterThan(0);expect(report.after).toBeLessThan(report.before);
  await info.attach('route-demand-audit',{body:JSON.stringify(report),contentType:'application/json'});
});

for(const failed of [false,true])test(`Decisions rhythm optional picker ${failed?'download failure':'late download'} can cancel without spending or committing`,async({page},info)=>{
  await page.addInitScript(()=>localStorage.setItem('birdsquad.screenReader','on'));
  let release:()=>void=()=>{};
  const held=new Promise<void>(resolve=>release=resolve);
  await page.route(/route-secondary-presentation.*\.js/,async request=>{if(failed)await request.abort();else{await held;await request.continue();}});
  await route(page);
  const before=await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.cardPickerMode='preen';r.cardPickerContext='districtPreen';r.cardPickerRemainingPicks=1;r.renderAll();return {deck:structuredClone(r.runState.deck),scrap:r.runState.scrap};});
  await page.waitForFunction(()=>!!(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-secondary-pending'));
  if(failed)await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-secondary-pending')?.getData('status')==='error');
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`picker-${failed?'failed':'pending'}-${size.width}.png`)});}
  await expect(page.locator('#game-status')).toContainText('No purchase or card choice is committed');
  // Vite's global download recovery is modal and intentionally owns Escape.
  if(failed){await expect(page.locator('#update-recovery')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#update-recovery')).toHaveCount(0);}
  await page.keyboard.press('Escape');release();
  await expect.poll(()=>page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return !!r.cardPickerMode||!!r.children.getByName('route-secondary-pending');})).toBe(false);
  await settleCanvas(page);
  expect(await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return {deck:r.runState.deck,scrap:r.runState.scrap};})).toEqual(before);
});

test('Decisions rhythm market presentation is absent at boot and opens once with stock intact',async({page},info)=>{
  const requests:string[]=[];const errors:string[]=[];
  page.on('request',r=>{if(/route-secondary-presentation.*\.js/.test(r.url()))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await route(page);expect(requests).toEqual([]);
  const stock=await page.evaluate(()=>{const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene'),n=w.__birdSquadCurrentMap().nodes.find((n:any)=>n.type==='market');r.openMarketNode(n);return r.marketCardShelf.map((s:any)=>({...s}));});
  await page.waitForFunction(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return r.routeSecondaryPresentationModule&&!r.children.getByName('route-secondary-pending');});
  expect(requests).toHaveLength(1);expect(stock.length).toBeGreaterThan(0);
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`market-${size.width}.png`)});}
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').marketCardShelf)).toEqual(stock);expect(errors).toEqual([]);
});

test('Decisions rhythm selection defers secondary objective and restores it on cancel',async({page},info)=>{
  await battle(page);
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.battleHudGuidanceView=()=>undefined;b.battleHudObjectiveView=()=>({text:'Keep the crossing clear',detail:'A secondary goal.',accent:0xdddddd});b.renderAll();const c=b.hand.find((c:any)=>c.target==='enemy');b.onCardClicked(c.instanceId);});
  const state=()=>page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {objectives:b.root.list.filter((o:any)=>o.name==='encounter-objective').map((o:any)=>o.visible),preview:!!b.root.getByName('combat-selection-preview')};});
  const selected=await state();expect(selected.preview).toBe(true);expect(selected.objectives.length).toBeGreaterThan(0);expect(selected.objectives.every(v=>!v)).toBe(true);
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`selection-${size.width}.png`)});}
  await page.keyboard.press('Escape');
  await expect.poll(async()=>{const restored=await state();return !restored.preview&&restored.objectives.length>0&&restored.objectives.every(Boolean);}).toBe(true);
});

test('Decisions rhythm records actual full blocks and preserves first-seen enemy timing',async({page})=>{
  await battle(page);
  const result=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),enemy=b.enemies[0];
    b.flyway.blockMoment=undefined;b.flock.block=3;b.damageFlock(enemy,8,'Partial');const partial=b.flyway.blockMoment;
    const before=b.statBlocked,hp=b.flock.hp;
    b.flock.block=30;b.damageFlock(enemy,10,'Charged hit');const full=structuredClone(b.flyway.blockMoment),actual=b.statBlocked-before,lost=hp-b.flock.hp;
    b.flock.block=3;b.damageFlock(enemy,2,'Small hit');
    const fake={enemyMoveTimingScale:()=>0.8,runSeenEnemyMoves:new Set(),enemyMovePacingKey:()=> 'empty',combatTimingDelay:(n:number)=>n};
    const first=b.combatFxModule.enemyMoveTimings(fake,enemy,{effects:[]});fake.runSeenEnemyMoves.add('empty');
    const known=b.combatFxModule.enemyMoveTimings(fake,enemy,{effects:[]}),attack=b.combatFxModule.enemyMoveTimings(fake,enemy,{effects:['damageFlock(5)']});
    return {partial,full,actual,lost,kept:b.flyway.blockMoment,first,known,attack};
  });
  expect(result.partial).toBeUndefined();expect(result.actual).toBeGreaterThan(0);expect(result.lost).toBe(0);expect(result.full).toMatchObject({move:'Charged hit',blocked:result.actual});expect(result.kept).toEqual(result.full);
  expect(result.first.impact).toBe(650);expect(result.attack.impact).toBe(650);expect(result.known.impact).toBe(420);expect(result.known.recovery).toBe(160);
});
