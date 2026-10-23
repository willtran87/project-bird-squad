import {test, expect} from '@playwright/test';
import {settleCanvas} from './helpers/settled-canvas';

const surfaces = ['title','setup','guide','settings','profile','collection','card-dossier','route','route-notice','route-feedback','deck',
  'waymarks','supplies','market-cards','market-waymarks','market-supplies','market-services',
  'market-sold','picker','combat','combat-feedback','combat-tooltip','reward','outcome'] as const;

for (const surface of surfaces) test(`authored frames retain proportions: ${surface}`, async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:2560,height:1600});
  await page.addInitScript(()=>{
    const account=JSON.stringify({discoveredCards:['major_00','wands_ace'],cardCollection:{major_00:{timesClaimed:1},wands_ace:{timesClaimed:1}}});
    localStorage.setItem('birdsquad.account',account);localStorage.setItem('birdsquad.account.backup',account);
  });
  await page.goto('./');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  const sceneName=['title','setup','guide','settings'].includes(surface)?'MenuScene':surface==='profile'?'ProfileScene'
    :['collection','card-dossier'].includes(surface)?'CodexScene':surface.startsWith('combat')||['reward','outcome'].includes(surface)?'BattleScene':'RouteScene';
  if(sceneName!=='MenuScene'){
    await page.evaluate(async name=>{
      const w=window as any;await w.__birdSquadEnsureScene(name);
      w.__birdSquadGame.scene.stop('MenuScene');w.__birdSquadGame.scene.start(name,name==='BattleScene'?{routeNodeId:'m1_entry'}:{});
    },sceneName);
    await page.waitForFunction(name=>{
      const s=(window as any).__birdSquadGame.scene.getScene(name);
      if(name==='RouteScene')return s.routeEssentialAssetsReady&&s.cardHoverDetailModule;
      if(name==='BattleScene')return s.battleHandRendererModule&&s.hand.length&&!s.combatIntroActive&&!s.combatAnimationPending;
      if(name==='CodexScene')return s.codexData;
      return s.scene.isActive()&&s.children.list.length>5;
    },sceneName);
  }
  await page.evaluate(({surface,sceneName})=>{
    const w=window as any,s=w.__birdSquadGame.scene.getScene(sceneName);
    if(surface==='setup')s.children.list.find((o:any)=>o.getData?.('focus')==='configure').emit('pointerdown');
    if(surface==='guide')s.openHelpOverlay();
    if(surface==='settings')s.openSettingsOverlay();
    if(surface==='card-dossier')s.openCodexDetail('major_00');
    if(sceneName==='RouteScene'){
      s.runState.districtContracts.forEach((c:any)=>c.confirmed=true);
      if(surface==='route-notice'){
        s.runState.mapIndex=1;s.runState.currentRouteNodeId=undefined;
        s.districtAdvanceNotice={fromMapName:'Rooftops',toMapName:'Canal Quarter',toMapIndex:1};
        s.districtContractCelebration={name:'Complete the district',rewardScrap:12,expiresAt:Date.now()+60000};s.renderAll();
      }
      if(surface==='route-feedback'){s.supplyFeedback=[{id:'test',name:'Trail snack',summary:'Restore Cohesion',timing:'route'}];s.renderAll();}
      if(surface==='deck')s.openDeckOverlay();
      if(surface==='waymarks')s.openWaymarkDrawer();
      if(surface==='supplies')s.openSupplyDrawer();
      if(surface.startsWith('market-')||surface==='picker'){
        s.runState.scrap=999;
        s.openMarketNode({...w.__birdSquadCurrentMap().nodes.find((n:any)=>n.type!=='boss'),type:'market'});
        if(surface==='picker')s.openMarketCardPicker(s.marketUtilityShelf.findIndex((o:any)=>o.id==='preen'),'preen');
        else if(surface==='market-sold'){s.marketCardShelf[0].sold=true;s.setMarketCategory('cards');}
        else s.setMarketCategory(surface.slice(7));
      }
    }
    if(surface==='reward'){s.rewardChoices=s.createRewardChoices();s.mode='cardReward';s.renderAll();}
    if(surface==='outcome'){s.retireCombatFxForOutcome();s.mode='runComplete';s.renderAll();}
    if(surface==='combat-feedback'){s.supplyFeedback=[{id:'test',name:'Trail snack',summary:'Restore Cohesion',turn:s.turn-1}];s.renderAll();}
    if(surface==='combat-tooltip')s.buildTooltip('Cohesion','The flock stays together.',350,120);
  },{surface,sceneName});
  await page.waitForFunction(({surface,sceneName})=>{
    const s=(window as any).__birdSquadGame.scene.getScene(sceneName);
    if(s.load.isLoading())return false;
    if(surface==='reward')return s.battleRewardRendererModule&&s.root.list.some((o:any)=>o.name==='reward-card-take-hit');
    if(surface==='outcome')return s.bossDossierModule&&s.root.list.some((o:any)=>o.name==='run-outcome-command-hit');
    if(surface==='deck')return !!s.children.getByName('deck-review-detail-panel');
    if(surface==='guide')return !!s.helpOverlay?.active;
    if(surface==='settings')return !!s.settingsOverlay?.active;
    return true;
  },{surface,sceneName});
  for(const [width,height] of [[2560,1600],[1440,900],[1000,560]]){
    await page.setViewportSize({width,height});await settleCanvas(page);
    const inventory=await page.evaluate(name=>{
      const s=(window as any).__birdSquadGame.scene.getScene(name);
      const walk=(nodes:any[]):any[]=>nodes.flatMap(o=>o.visible&&o.alpha!==0?[o,...walk(o.list??[])]:[]);
      return walk(s.children.list).filter(o=>['Image','NineSlice'].includes(o.type)&&/(frame|border|plaque|banner|tray|backplate|slat)/.test(o.texture?.key??''))
        .map(o=>({name:o.name,key:o.texture.key,type:o.type,scaleX:o.scaleX,scaleY:o.scaleY,
          source:[o.frame.realWidth,o.frame.realHeight],display:[o.displayWidth,o.displayHeight]}));
    },sceneName);
    await info.attach(`inventory-${width}`,{body:JSON.stringify(inventory,null,2),contentType:'application/json'});
    await page.screenshot({path:info.outputPath(`${surface}-${width}.png`)});
    for(const art of inventory){
      if(art.type==='NineSlice')expect(art.scaleX,art.key).toBeCloseTo(art.scaleY,5);
      else expect(Math.abs(art.scaleX/art.scaleY-1),JSON.stringify(art)).toBeLessThanOrEqual(.015);
    }
  }
  expect(errors).toEqual([]);
});
