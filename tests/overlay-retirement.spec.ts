import {test, expect, type Page} from '@playwright/test';
import {settleCanvas} from './helpers/settled-canvas';
import {installVirtualController, controllerButton} from './helpers/virtual-controller';

async function boot(page:Page) {
  await installVirtualController(page);
  await page.goto('./');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(async()=>{
    const w=window as any;await w.__birdSquadEnsureScene('BattleScene');
    w.__birdSquadGame.scene.stop('MenuScene');w.__birdSquadGame.scene.start('BattleScene',{routeNodeId:'m1_entry'});
  });
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.fxLayer?.active&&b.hand.length&&!b.combatIntroActive&&!b.combatAnimationPending;});
  await settleCanvas(page);
}
const stable=(page:Page)=>page.evaluate(()=>{
  const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');
  return {active:b.scene.isActive(),mode:b.mode,hand:b.hand.map((c:any)=>c.instanceId),selected:b.selectedInstanceId,
    target:b.selectedEnemyId,turn:b.turn,energy:b.energy,canceled:b.statCancelledActions,focus:b.controllerChoiceIndex};
});

test('held Back closes history once and preserves the underlying card selection',async({page})=>{
  await boot(page);
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.onCardClicked(b.hand[0].instanceId);b.openCombatHistory();});
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active);
  const before=await stable(page);
  await page.keyboard.down('Escape');await settleCanvas(page);
  await page.keyboard.down('Escape');await settleCanvas(page);await page.keyboard.up('Escape');
  expect(await stable(page)).toEqual(before);
  expect(await page.evaluate(()=>!!(window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active)).toBe(false);
});

for(const key of ['Escape','1'])test(`held ${key} closes outcome details once without activating the exposed report`,async({page})=>{
  await boot(page);
  await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.retireCombatFxForOutcome();b.mode='defeat';b.emitRunSummary('loss');b.renderAll();
  });
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').root.list.some((o:any)=>o.name==='run-outcome-command-hit'));
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').outcomeDetailsOpen);
  await page.keyboard.down(key);await settleCanvas(page);
  const after=await stable(page);
  expect(after.active).toBe(true);expect(after.mode).toBe('defeat');
  await page.keyboard.down(key);await settleCanvas(page);await page.keyboard.up(key);
  expect(await stable(page)).toEqual(after);
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').outcomeDetailsOpen)).toBe(false);
  expect(await page.evaluate(()=>JSON.parse((window as any).render_game_to_text()).combatInputFocus.label)).toBe('Flight Details');
});

test('held controller Back closes only the nested pile card reader and preserves pile context',async({page})=>{
  await boot(page);
  await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.openOverlay('draw');});
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('combat-pile-read-hit'));
  await page.keyboard.press('h');await settleCanvas(page);
  const before=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {pile:b.inspectOverlay,card:b.inspectedCardId,scroll:b.cardReviewScroll};});
  await controllerButton(page,1,true);await settleCanvas(page);await settleCanvas(page);
  expect(await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {pile:b.inspectOverlay,card:b.inspectedCardId,scroll:b.cardReviewScroll};})).toEqual(before);
  expect(await page.evaluate(()=>!!(window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active)).toBe(false);
  await controllerButton(page,1,false);
});

for(const scene of ['MenuScene','RouteScene'])for(const remapped of [false,true])
test(`${scene} held Back retires exactly one owner, remapped=${remapped}`,async({page})=>{
  if(remapped)await page.addInitScript(()=>localStorage.setItem('birdsquad.controlBindings',JSON.stringify({version:1,bindings:{back:'KeyB'}})));
  await page.goto('./');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await settleCanvas(page);
  if(scene==='MenuScene') {
    await page.keyboard.press('h');
    await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text()).helpFocus?.label==='Practice lessons');
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text()).helpTopic?.includes('Practice lessons.'));
  }else{
    await page.evaluate(async()=>{const w=window as any;await w.__birdSquadEnsureScene('RouteScene');w.__birdSquadGame.scene.stop('MenuScene');w.__birdSquadGame.scene.start('RouteScene');});
    await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
    await page.keyboard.press('i');
    await page.waitForFunction(()=>!!JSON.parse((window as any).render_game_to_text()).mapInspection?.id);
  }
  const key=remapped?'b':'Escape';
  await page.keyboard.down(key);await settleCanvas(page);
  const snapshot=()=>page.evaluate(scene=>{
    const s=(window as any).__birdSquadGame.scene.getScene(scene),state=JSON.parse((window as any).render_game_to_text());
    return {active:s.scene.isActive(),guide:!!s.helpOverlay,focus:state.helpFocus,
      inspected:s.flockOverlayOpen,paused:s.pauseOverlayOpen,selected:s.selectedNodeId,run:JSON.stringify(s.runState)};
  },scene);
  const before=await snapshot();
  if(scene==='MenuScene')expect(before.guide).toBe(true);
  else expect(before).toMatchObject({inspected:false,paused:false});
  await page.keyboard.down(key);await settleCanvas(page);await page.keyboard.up(key);
  expect(await snapshot()).toEqual(before);
});
