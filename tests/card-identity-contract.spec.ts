import {test,expect} from '@playwright/test';
import manifest from '../assets/runtime/cards/card-art-manifest.json' with {type:'json'};
import {settleCanvas} from './helpers/settled-canvas';
import {readFileSync} from 'node:fs';

test('all runtime card identities agree across combat, rewards, picker, Collection, Deck, Market and Folio',async({page},info)=>{
  test.setTimeout(120000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:2560,height:1600});await page.goto('./');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(async()=>{const w=window as any;await w.__birdSquadEnsureScene('CodexScene');
    w.__birdSquadGame.scene.stop('MenuScene');w.__birdSquadGame.scene.start('CodexScene');});
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('CodexScene').codexData);
  const ids=await page.evaluate(()=>{const w=window as any;w.identityCards=w.__birdSquadGame.scene.getScene('CodexScene').allCards();return w.identityCards.map((c:any)=>c.id);});
  expect(ids.sort()).toEqual(manifest.cards.filter(c=>c.status==='approved').map(c=>c.cardId).sort());
  expect(ids).toHaveLength(110);
  await page.evaluate(async()=>{const w=window as any,g=w.__birdSquadGame;await w.__birdSquadEnsureScene('RouteScene');
    g.scene.stop('CodexScene');g.scene.start('RouteScene');});
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text()).assetReadiness?.fullArt);
  await page.evaluate(async()=>{const w=window as any,g=w.__birdSquadGame;await w.__birdSquadEnsureScene('BattleScene');
    g.scene.stop('RouteScene');g.scene.start('BattleScene',{routeNodeId:'m1_entry'});});
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.battleHandRendererModule&&b.handLayer?.active&&!b.combatInteractionLocked();});
  await page.evaluate(()=>{const w=window as any;w.__birdSquadGame.scene.getScene('BattleScene').queueCardArtLoad(w.identityCards);});
  await page.waitForFunction(()=>{const w=window as any,b=w.__birdSquadGame.scene.getScene('BattleScene');return w.identityCards.every((c:any)=>b.textures.exists(`card-thumb-${c.id}`));});
  const result=await page.evaluate(()=>{
    const w=window as any,g=w.__birdSquadGame,b=g.scene.getScene('BattleScene'),r=g.scene.getScene('RouteScene'),c=g.scene.getScene('CodexScene');
    const failures:any[]=[],rows:any[]=[];
    const intact=(image:any)=>image&&!image.isCropped&&!image.mask&&Math.abs(image.scaleX-image.scaleY)<0.001;
    for(const source of w.identityCards){
      const id=source.id,key=`card-thumb-${id}`,family=source.runtime.kind==='snag'?'SNAG':id.startsWith('aviary_')?'AVIARY':source.type==='major'?'LEGEND':source.type==='minor'?source.runtime.suit.toUpperCase():'MOLT';
      for(const upgraded of [false,true]){
        const card={...source,instanceId:`identity-${id}`,upgraded},name=source.name+(upgraded?'+':'');
        const hand=b.battleHandCardView(card),reward=b.rewardCardView(card,0),inspect=b.battleInspectCardView(card,'Deck'),deck=r.routeCardComparisonView(card,'Deck');
        for(const [surface,view] of Object.entries({hand,reward,inspect,deck}) as [string,any][]){
          if(view.name!==name||view.label!==family||!([key,`card-${id}`].includes(view.artKey)))failures.push({id,upgraded,surface,name:view.name,family:view.label,key:view.artKey});
        }
        r.runState.deck=[{id,upgraded}];const entry=r.pickerEligibleCards('release')[0];
        if(entry?.card.id!==id||entry.name+(entry.upgraded?'+':'')!==name)failures.push({id,upgraded,surface:'picker'});
      }
      c.discovered.add(id);const layer=c.add.container();c.renderThumb(layer,source,640,360);
      const tile=layer.getByName('codex-card-tile'),title=tile.getByName('codex-card-title'),art=tile.getByName('codex-card-art');
      if((title.getData('fullText')??title.text)!==source.name||art?.texture.key!==key||art?.getData('cardId')!==id||!intact(art))failures.push({id,surface:'Collection',title:title.text,full:title.getData('fullText'),key:art?.texture.key});
      layer.destroy();
      // Render the real Market adapter, without buying or changing progression.
      const start=r.children.list.length;r.marketCategory='cards';r.marketCardShelf=[{id,price:20,sold:false}];r.renderMarketCardOffers(640,410);
      const added=r.children.list.slice(start),marketTitle=added.find((o:any)=>o.name==='market-card-offer-title');
      const marketArt=added.find((o:any)=>o.type==='Image'&&o.texture.key===key);
      if(marketTitle?.getData('fullTitle')!==source.name||!intact(marketArt))failures.push({id,surface:'Market'});
      added.forEach((o:any)=>o.destroy());
      const pickerStart=r.children.list.length;r.cardPickerMode='release';r.cardPickerContext='market';r.cardPickerScroll=0;
      r.renderCardPickerOverlay();
      const pickerObjects=r.children.list.slice(pickerStart),pickerArt=pickerObjects.find((o:any)=>o.type==='Image'&&o.texture.key===key);
      if(!intact(pickerArt))failures.push({id,surface:'picker art'});
      pickerObjects.forEach((o:any)=>o.destroy());r.cardPickerMode=undefined;
      rows.push({id,name:source.name,family,key});
    }
    return{rows,failures};
  });
  await info.attach('identity-matrix',{body:JSON.stringify(result),contentType:'application/json'});
  expect(result.failures).toEqual([]);
  // Phaser uses/revokes blob URLs; compare decoded pixels to the canonical
  // local export rather than assuming an Image.src filename survives loading.
  const pixelMismatches=await page.evaluate(async entries=>{
    const g=(window as any).__birdSquadGame,failures:string[]=[];
    const pixels=(image:HTMLImageElement)=>{const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      canvas.getContext('2d')!.drawImage(image,0,0);return canvas.toDataURL();};
    for(const entry of entries){const expected=new Image();expected.src=entry.data;await expected.decode();
      const actual=g.textures.get(`card-thumb-${entry.id}`).getSourceImage();
      if(pixels(actual)!==pixels(expected))failures.push(entry.id);}
    return failures;
  },manifest.cards.filter(c=>c.status==='approved').map(c=>({id:c.cardId,data:'data:image/webp;base64,'+readFileSync(new URL('../'+c.thumbnail,import.meta.url)).toString('base64')})));
  expect(pixelMismatches).toEqual([]);
  await page.evaluate(async()=>{const w=window as any,g=w.__birdSquadGame;await w.__birdSquadEnsureScene('ProfileScene');
    for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key);g.scene.start('ProfileScene');});
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text()).scene==='ProfileScene');
  const folio=await page.evaluate(()=>{
    const w=window as any,s=w.__birdSquadGame.scene.getScene('ProfileScene'),failures:any[]=[];
    for(const card of w.identityCards){
      const value=JSON.stringify({discoveredCards:[card.id],decks:[{id:'identity',name:'Identity',leaderId:'fledgling',cards:[{id:card.id}],createdAt:1,updatedAt:1,coverCardId:card.id}]});
      localStorage.setItem('birdsquad.account',value);localStorage.setItem('birdsquad.account.backup',value);
      Object.assign(s.profileViewState,{badgeView:'folios',savedDeckIndex:0,savedDeckIdentityOpen:true,savedDeckIdentityDeckId:'identity',savedDeckIdentityIndex:0,savedDeckIdentitySection:'cover'});
      s.renderPremiumProfileScene();
      const art=s.children.getByName('profile-folio-identity-cover-art'),label=s.children.getByName('profile-folio-identity-cover-name');
      if(art?.getData('cardId')!==card.id||art?.texture.key!==`card-thumb-${card.id}`||art?.isCropped||art?.mask||Math.abs(art?.scaleX-art?.scaleY)>0.001||!label?.getData('fullText')?.endsWith(card.name))failures.push({id:card.id,key:art?.texture.key,label:label?.text,full:label?.getData('fullText')});
    }
    return failures;
  });
  expect(folio).toEqual([]);
  await settleCanvas(page);await page.screenshot({path:info.outputPath('folio-identity-2560.png')});
  expect(errors).toEqual([]);
});
