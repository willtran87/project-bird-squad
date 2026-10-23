import {test, expect} from '@playwright/test';
import {settleCanvas} from './helpers/settled-canvas';
import {targetGeometry, checkTargetGeometry} from './helpers/target-geometry';

// Runtime floor inventory, complemented by surface-specific geometry tests.
const codexSurfaces=['collection','card-dossier','items','leaders','enemies','glossary','supply-dossier','waymark-dossier',
  'leader-dossier','enemy-dossier','glossary-dossier','collection-empty','collection-tools','collection-atlas','collection-saved'];
const routeSurfaces=['route','route-tooltip','route-feedback','deck','waymarks','supplies','market-cards','market-waymarks',
  'market-supplies','market-services','market-sold','picker','picker-read','route-contract','route-notice'];
const menuSurfaces=['title','setup','guide','settings','storage-recovery'];
for (const surface of [...menuSurfaces,'profile',...codexSurfaces,...routeSurfaces,
  'combat','combat-tooltip','combat-feedback','combat-intro','return-choice','reward','reward-hover','outcome','flight-details']) {
  test(`compact typography inventory: ${surface}`, async({page},info)=>{
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.setViewportSize({width:1000,height:560});
    await page.addInitScript(()=>{
      const account=JSON.stringify({discoveredCards:['major_00','wands_ace'],cardCollection:{major_00:{timesClaimed:1},wands_ace:{timesClaimed:1}}});
      localStorage.setItem('birdsquad.account',account);localStorage.setItem('birdsquad.account.backup',account);
    });
    await page.goto('./');
    await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
    const scene=menuSurfaces.includes(surface)?'MenuScene':surface==='profile'?'ProfileScene'
      :codexSurfaces.includes(surface)?'CodexScene':routeSurfaces.includes(surface)?'RouteScene':'BattleScene';
    if(scene!=='MenuScene'){
      await page.evaluate(async name=>{const w=window as any;await w.__birdSquadEnsureScene(name);
        w.__birdSquadGame.scene.stop('MenuScene');w.__birdSquadGame.scene.start(name,name==='BattleScene'?{routeNodeId:'m1_entry'}:{});},scene);
      await page.waitForFunction(name=>{const s=(window as any).__birdSquadGame.scene.getScene(name);
        if(name==='RouteScene')return s.routeEssentialAssetsReady&&s.cardHoverDetailModule;
        if(name==='BattleScene')return s.battleHandRendererModule&&s.hand.length&&!s.combatIntroActive&&!s.combatAnimationPending;
        if(name==='CodexScene')return s.codexData;
        return s.scene.isActive()&&s.children.list.length>5;},scene);
    }
    await page.evaluate(({surface,scene})=>{
      const w=window as any,s=w.__birdSquadGame.scene.getScene(scene);
      if(surface==='setup')s.children.list.find((o:any)=>o.getData?.('focus')==='configure').emit('pointerdown');
      if(surface==='guide')s.openHelpOverlay();
      if(surface==='settings')s.openSettingsOverlay();
      if(surface==='storage-recovery'){
        s.storageRecoveryNotice={outcome:'reset',scopes:['Flock Record','flight checkpoint'],
          text:'SAVE CHECK  Damaged Flock Record and flight checkpoint isolated; safe defaults are active.'};
        s.showStorageRecoveryNotice(s.menuGeneration);
      }
      if(surface==='card-dossier')s.openCodexDetail('major_00');
      if(['items','leaders','enemies','glossary'].includes(surface)){s.activeSection=surface;s.renderAll();}
      if(surface==='collection-empty'){s.cardSearchQuery='no matching card here';s.renderAll();}
      if(surface==='collection-tools')s.toggleCollectionTools();
      if(surface==='collection-atlas')s.openCollectionAtlas();
      if(surface==='collection-saved')s.openSavedCollectionViews();
      if(['supply-dossier','waymark-dossier'].includes(surface)){
        s.activeSection='items';s.openCodexDetail((surface==='supply-dossier'?s.allSupplies():s.allWaymarks())[0].id,false);
      }
      if(surface==='leader-dossier'){s.activeSection='leaders';s.openCodexDetail(s.allLeaders()[0].id,false);}
      if(surface==='enemy-dossier'){s.activeSection='enemies';s.openCodexDetail(s.allCodexEnemies()[0].id,false);}
      if(surface==='glossary-dossier'){s.activeSection='glossary';s.openCodexDetail(s.glossaryTerms[0].term,false);}
      if(surface==='route-tooltip')s.showNodeTooltip(w.__birdSquadCurrentMap().nodes.find((n:any)=>n.type==='boss'),350,180);
      if(scene==='RouteScene'){
        if(surface==='route-contract'){s.runState.districtContracts.forEach((c:any)=>c.confirmed=false);s.renderAll();}
        else s.runState.districtContracts.forEach((c:any)=>c.confirmed=true);
        if(surface==='route-feedback'){s.supplyFeedback=[{id:'test',name:'Trail snack',summary:'Restore Cohesion',timing:'route'}];s.renderAll();}
        if(surface==='route-notice'){s.districtAdvanceNotice={fromMapName:'Rooftops',toMapName:'Canal Quarter',toMapIndex:1};s.renderAll();}
        if(surface==='deck')s.openDeckOverlay();
        if(surface==='waymarks')s.openWaymarkDrawer();
        if(surface==='supplies')s.openSupplyDrawer();
        if(surface.startsWith('market-')||surface.startsWith('picker')){
          s.runState.scrap=999;s.openMarketNode({...w.__birdSquadCurrentMap().nodes.find((n:any)=>n.type!=='boss'),type:'market'});
          if(surface.startsWith('picker')){
            s.openMarketCardPicker(s.marketUtilityShelf.findIndex((o:any)=>o.id==='preen'),'preen');
            if(surface==='picker-read')s.cardHoverDetailModule.openCardPickerInspection(s,0);
          }
          else if(surface==='market-sold'){s.marketCardShelf[0].sold=true;s.setMarketCategory('cards');}
          else s.setMarketCategory(surface.slice(7));
        }
      }
      if(surface==='combat-feedback'){s.supplyFeedback=[{id:'test',name:'Trail snack',summary:'Restore Cohesion',turn:s.turn-1}];s.renderAll();}
      if(surface==='combat-intro'){s.introPlayed=false;s.playBattleIntro();s.time.paused=true;}
      if(surface==='return-choice'){s.discardPile=s.hand.splice(0,3);s.beginReturnChoice('Recall','any',0,()=>{});s.renderAll();}
      if(surface==='reward'||surface==='reward-hover'){s.rewardChoices=s.createRewardChoices();s.mode='cardReward';s.renderAll();}
      if(['outcome','flight-details'].includes(surface)){
        s.retireCombatFxForOutcome();s.mode='defeat';s.emitRunSummary('loss');s.renderAll();
      }
      if(surface==='combat-tooltip')s.buildTooltip('Cohesion','The flock stays together.',350,120);
    },{surface,scene});
    await page.waitForFunction(({surface,scene})=>{const s=(window as any).__birdSquadGame.scene.getScene(scene);
      if(s.load.isLoading())return false;
      if(surface==='storage-recovery')return !!s.children.getByName('storage-recovery-notice');
      if(surface==='reward'||surface==='reward-hover')return s.battleRewardRendererModule&&s.root.getByName('reward-card-take-hit');
      if(surface==='deck')return !!s.children.getByName('deck-review-detail-panel');
      if(['outcome','flight-details'].includes(surface))return s.bossDossierModule&&s.root.getByName('run-outcome-command-hit');
      if(surface==='guide')return s.helpOverlay?.active;
      if(surface==='settings')return s.settingsOverlay?.active;
      return true;},{surface,scene});
    if(surface==='flight-details')await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').openOutcomeFlightDetails());
    if(surface==='reward-hover')await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.showCardPreview(s.rewardChoices[0]);});
    await settleCanvas(page);
    const texts=await page.evaluate(scene=>{
      const s=(window as any).__birdSquadGame.scene.getScene(scene),scale=s.game.canvas.getBoundingClientRect().height/720;
      const walk=(list:any[]):any[]=>list.flatMap(o=>o.visible&&o.alpha!==0?[o,...walk(o.list??[])]:[]);
      return walk(s.children.list).filter(o=>o.type==='Text'&&o.text.trim()).map(o=>{
        const b=o.getBounds(),m=o.getWorldTransformMatrix();
        return {name:o.name,text:o.text,font:o.style.fontSize,size:parseFloat(o.style.fontSize)*Math.hypot(m.c,m.d)*scale,
          x:b.x,y:b.y,width:b.width,height:b.height,full:o.getData('fullText'),truncated:o.getData('truncated'),role:o.getData('textRole')};
      }).filter(o=>o.x+o.width>0&&o.x<1280&&o.y+o.height>0&&o.y<720);
    },scene);
    expect(texts.length).toBeGreaterThan(0);
    await info.attach('text-inventory',{body:JSON.stringify(texts,null,2),contentType:'application/json'});
    const targets=await targetGeometry(page,scene);
    await info.attach('target-inventory',{body:JSON.stringify({surface,targets},null,2),contentType:'application/json'});
    await page.screenshot({path:info.outputPath(`${surface}-1000.png`)});
    checkTargetGeometry(targets,surface);
    expect(texts.filter(t=>t.size<14-0.01),`${surface}: secondary text floor`).toEqual([]);
    const primary=new Set(['codex-card-title','codex-entry-title','codex-tab-label','codex-card-cost-label','codex-card-detail-title',
      'codex-card-detail-paragraph','combat-tooltip-title','run-flight-details-section-body','run-flight-details-section-title',
      'run-defeat-review-headline','route-collection-goal-hit-label','hud-value-Cohesion','hud-value-Scrap','hud-value-Deck',
      'hud-value-Supplies','hud-value-Waymarks','combat-enemy-name','combat-enemy-hp-value',
      'card-picker-card-name','card-picker-price','run-outcome-stat-value','title-leader-description-body',
      'combat-focused-card-name','combat-supply-feedback-name','route-supply-feedback-name',
      'market-service-label','market-service-cost-value']);
    expect(texts.filter(t=>(t.role==='primary'||(primary.has(t.name)&&t.role!=='secondary'))&&t.size<16-0.01),`${surface}: primary text floor`).toEqual([]);
  });
}
