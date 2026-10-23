import {test,expect} from '@playwright/test';
import {settleCanvas} from './helpers/settled-canvas';

test('reward hover catalog preserves readable complete panels',async({page},info)=>{
  await page.setViewportSize({width:1000,height:560});await page.goto('./');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(async()=>{const w=window as any;await w.__birdSquadEnsureScene('CodexScene');await w.__birdSquadEnsureScene('BattleScene');
    w.__birdSquadGame.scene.stop('MenuScene');w.__birdSquadGame.scene.start('BattleScene',{routeNodeId:'m1_entry'});});
  await page.waitForFunction(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    return s.battleHandRendererModule&&s.fxLayer?.active&&!s.combatInteractionLocked();});
  await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.mode='cardReward';s.rewardChoices=s.createRewardChoices();s.renderAll();});
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').battleRewardRendererModule);
  const result=await page.evaluate(()=>{
    const g=(window as any).__birdSquadGame,s=g.scene.getScene('BattleScene');s.mode='cardReward';
    const cards=g.scene.getScene('CodexScene').allCards(),failures:any[]=[];let count=0;
    const walk=(list:any[]):any[]=>list.flatMap(o=>[o,...walk(o.list??[])]);
    for(const card of cards)for(const upgraded of [false,true]){
      s.showCardPreview({...card,upgraded});const root=s.cardPreview;
      const bounds=root.getBounds(),labels=walk(root.list).filter(o=>o.type==='Text');
      const small=labels.filter(o=>parseFloat(o.style.fontSize)*s.game.canvas.getBoundingClientRect().height/720<14-.01).map(o=>o.text);
      if(bounds.top<0||bounds.bottom>660||bounds.left<0||bounds.right>1280||small.length)failures.push({id:card.id,upgraded,bounds,small});
      count++;
    }
    return{count,failures};
  });
  await info.attach('catalog-geometry',{body:JSON.stringify(result),contentType:'application/json'});
  expect(result.count).toBe(220);expect(result.failures).toEqual([]);
});

for(const saved of [false,true])test(`storage notice never covers home actions, saved=${saved}`,async({page},info)=>{
  await page.goto('./');await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  if(saved){
    await page.evaluate(async()=>{const w=window as any;await w.__birdSquadEnsureScene('RouteScene');w.__birdSquadGame.scene.stop('MenuScene');w.__birdSquadGame.scene.start('RouteScene');});
    await page.waitForFunction(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');return s.routeEssentialAssetsReady&&s.routeCheckpointState?.outcome==='saved';});
    await page.evaluate(()=>{const g=(window as any).__birdSquadGame;g.scene.stop('RouteScene');g.scene.start('MenuScene');});
    await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').menuHasSavedRun);
  }
  await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('MenuScene');s.storageRecoveryNotice={outcome:'reset',scopes:[],
    text:'SAVE CHECK  Damaged Flock Record and flight checkpoint isolated; safe defaults are active.'};s.showStorageRecoveryNotice(s.menuGeneration);});
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').children.getByName('storage-recovery-notice'));
  for(const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]){
    await page.setViewportSize(size);await settleCanvas(page);
    const overlap=await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('MenuScene');
      const notice=s.children.list.find((o:any)=>o.name==='storage-recovery-notice'&&o.type==='Rectangle').getBounds();
      return [...s.menuFocusTargets.values()].filter((o:any)=>o.visible&&o.input?.enabled).filter((o:any)=>{const b=o.getBounds();return b.left<notice.right&&b.right>notice.left&&b.top<notice.bottom&&b.bottom>notice.top;}).map((o:any)=>o.getData('focus'));});
    expect(overlap).toEqual([]);await page.screenshot({path:info.outputPath(`notice-${size.width}.png`)});
  }
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').setSetupOpen(true));
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').children.list
    .filter((o:any)=>o.name==='storage-recovery-notice').some((o:any)=>o.visible))).toBe(false);
});
