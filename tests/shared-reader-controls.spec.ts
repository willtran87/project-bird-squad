import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

async function boot(page: Page, key: string) {
  await page.setViewportSize({width:2560,height:1600}); await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async key => {
    const w=window as any; await w.__birdSquadEnsureScene(key);
    w.__birdSquadGame.scene.stop('MenuScene');
    w.__birdSquadGame.scene.start(key,key==='BattleScene'?{routeNodeId:'m1_entry'}:undefined);
  },key);
  await page.waitForFunction(key => {
    const s=(window as any).__birdSquadGame.scene.getScene(key);
    return key==='RouteScene'?s.cardHoverDetailModule&&s.routeEssentialAssetsReady:
      s.battleHandRendererModule&&s.hand.length&&!s.combatIntroActive&&!s.combatAnimationPending;
  },key);
}

async function contract(page: Page,key:string,prefix:string) {
  return page.evaluate(({key,prefix})=>{
    const s=(window as any).__birdSquadGame.scene.getScene(key);
    const walk=(list:any[]):any[]=>list.flatMap(o=>[o,...walk(o.list??[])]);
    const hit=walk(s.children.list).find(o=>o.name===`${prefix}-previous`);
    const label=hit.getData('labelObject'),before=hit.getBounds(),disabled=!hit.input?.enabled;
    const beforeState=(window as any).render_game_to_text();
    hit.emit('pointerdown');
    const safe=(window as any).render_game_to_text()===beforeState;
    hit.setData('focused',true);hit.emit('pointerover');hit.emit('pointerout');
    const after=hit.getBounds(),scale=s.game.canvas.getBoundingClientRect().height/720;
    return {disabled,safe,role:hit.getData('controlKind'),alpha:hit.alpha,labelAlpha:label.alpha,
      color:label.style.color,focused:hit.getData('focused'),outline:hit.lineWidth,
      unchanged:before.x===after.x&&before.y===after.y&&before.width===after.width&&before.height===after.height,
      font:parseFloat(label.style.fontSize)*scale,width:hit.width*scale,height:hit.height*scale};
  },{key,prefix});
}

for(const key of ['RouteScene','BattleScene']) test(`${key} readers use opaque disabled navigation and stable focus across all sizes`,async({page},info)=>{
  await boot(page,key);
  const prefixes=key==='RouteScene'?['deck-review-detail','deck-review-comparison']:['combat-card-detail'];
  for(const prefix of prefixes){
    await page.evaluate(({key,prefix})=>{
      const s=(window as any).__birdSquadGame.scene.getScene(key);
      if(key==='RouteScene'){
        if(!s.deckOverlayOpen)s.openDeckOverlay();
        if(prefix.endsWith('comparison'))s.toggleDeckReviewComparison();
      } else {s.onCardClicked(s.hand[0].instanceId);s.toggleCombatCardDetail();}
    },{key,prefix});
    await page.waitForFunction(({key,prefix})=>{
      const s=(window as any).__birdSquadGame.scene.getScene(key);
      const walk=(list:any[]):any[]=>list.flatMap(o=>[o,...walk(o.list??[])]);
      return walk(s.children.list).some(o=>o.name===`${prefix}-previous`);
    },{key,prefix});
    for(const [width,height] of [[2560,1600],[1440,900],[1000,560]]){
      await page.setViewportSize({width,height});await settleCanvas(page);
      const c=await contract(page,key,prefix);
      expect(c).toMatchObject({disabled:true,safe:true,role:'secondary',alpha:1,labelAlpha:1,color:'#a2b1ba',focused:true,outline:3,unchanged:true});
      expect(c.font).toBeGreaterThanOrEqual(16);expect(c.width).toBeGreaterThanOrEqual(44);expect(c.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({path:info.outputPath(`${prefix}-${width}.png`)});
    }
  }
});
