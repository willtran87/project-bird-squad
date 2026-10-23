import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

async function hit(page: Page, name: string) {
  const point = await page.evaluate(name => {
    const s = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const o = s.root.getByName(name); if (!o?.input?.enabled) throw new Error(`Missing ${name}`);
    const b=o.getBounds(), c=s.game.canvas.getBoundingClientRect();
    return {x:c.left+b.centerX*c.width/1280,y:c.top+b.centerY*c.height/720};
  }, name);
  await page.mouse.click(point.x, point.y); await settleCanvas(page);
}

test('Collection tools collapse without hidden hit areas or lost browsing context', async ({page}, info) => {
  const errors:string[]=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.setViewportSize({width:2560,height:1600});
  await page.goto('./');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(async()=>{
    const w=window as any; await w.__birdSquadEnsureScene('CodexScene');
    w.__birdSquadGame.scene.stop('MenuScene'); w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('CodexScene').codexData);
  const state=()=>page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('CodexScene');
    return {open:s.collectionToolsOpen,sort:s.cardSortMode,tab:s.activeTab,scroll:s.gridScroll,
      sortVisible:!!s.root.getByName('codex-card-sort-hit'),viewsVisible:!!s.root.getByName('codex-saved-views-hit'),
      focus:s.focusZone};
  });
  for(const [width,height] of [[2560,1600],[1440,900],[1000,560]]) {
    await page.setViewportSize({width,height}); await settleCanvas(page);
    expect(await state()).toMatchObject({open:false,sortVisible:false,viewsVisible:false});
    await page.screenshot({path:info.outputPath(`shelf-${width}.png`)});
    // Former hidden sort location must not intercept pointer input.
    await page.evaluate(()=>{
      const s=(window as any).__birdSquadGame.scene.getScene('CodexScene');
      s.input.emit('pointerdown',{x:352,y:92});
    });
    expect((await state()).sort).toBe('binder');
    const before=await state();
    await hit(page,'codex-tools-hit');
    expect(await state()).toMatchObject({open:true,sortVisible:true,viewsVisible:true});
    await page.screenshot({path:info.outputPath(`tools-${width}.png`)});
    await page.keyboard.press('Escape'); await settleCanvas(page);
    expect(await state()).toMatchObject({open:false,tab:before.tab,scroll:before.scroll,focus:'tools'});
    // Confirm toggles the same control through the normal bound input handler.
    await page.keyboard.press('Enter'); await settleCanvas(page);
    expect((await state()).open).toBe(true);
    await hit(page,'codex-tools-hit');
  }
  // A direct shortcut reveals its controls; closing a child restores visible focus.
  await page.keyboard.press('b'); await settleCanvas(page);
  await page.keyboard.press('Escape'); await settleCanvas(page);
  expect(await state()).toMatchObject({open:true,focus:'savedViews',viewsVisible:true});
  expect(errors).toEqual([]);
});

test('dossier identifies canonical illustration and gameplay names without revealing unknown cards', async ({page},info)=>{
  await page.goto('./');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(async()=>{
    const w=window as any; await w.__birdSquadEnsureScene('CodexScene');
    w.__birdSquadGame.scene.stop('MenuScene'); w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('CodexScene').codexData);
  const undiscovered=await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('CodexScene');
    return s.gridLayer.list.filter((o:any)=>o.name==='codex-card-tile').map((o:any)=>o.list.filter((c:any)=>c.type==='Text').map((c:any)=>c.text));
  });
  expect(undiscovered.flat()).not.toContain('UNFOUND');
  await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('CodexScene');
    s.discovered.add('wands_03'); s.openCodexDetail('wands_03');
  });
  await settleCanvas(page);
  const paragraphs=await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('CodexScene').root.list
    .filter((o:any)=>o.name==='codex-card-detail-paragraph').map((o:any)=>o.text));
  expect(paragraphs).toContain('Illustration: Three of Plumes\nGameplay name: Plume Horizon');
  await page.screenshot({path:info.outputPath('card-identity.png')});
});

test('failed Collection artwork has bounded retries, explicit state and successful manual recovery', async ({page},info)=>{
  let requests=0, fail=true;
  await page.route(/\/assets\/wands_03[^/]*\.webp/, async route=>{
    requests++; if(fail) await route.abort('failed'); else await route.continue();
  });
  await page.goto('./');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(async()=>{
    const w=window as any; await w.__birdSquadEnsureScene('CodexScene');
    w.__birdSquadGame.scene.stop('MenuScene'); w.__birdSquadGame.scene.start('CodexScene');
    const s=w.__birdSquadGame.scene.getScene('CodexScene');
    s.activeTab=2; s.discovered.add('wands_03'); s.renderAll();
  });
  await page.waitForFunction(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('CodexScene');
    return s.failedArt.size>0 && s.pendingArt.size===0;
  });
  const count=requests;
  await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('CodexScene');
    for(let i=0;i<10;i++)s.renderAll();
  });
  await settleCanvas(page);
  expect(requests).toBe(count);
  const status=await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('CodexScene');
    const tile=s.gridLayer.list.find((o:any)=>o.getData('cardId')==='wands_03');
    return {state:tile.getByName('codex-card-art-placeholder').getData('status'), retry:!!tile.getByName('codex-card-art-retry-hit')};
  });
  expect(status).toEqual({state:'failed',retry:true});
  await page.screenshot({path:info.outputPath('failed-art.png')});
  fail=false;
  const point=await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('CodexScene');
    const tile=s.gridLayer.list.find((o:any)=>o.getData('cardId')==='wands_03');
    const b=tile.getByName('codex-card-art-retry-hit').getBounds(), c=s.game.canvas.getBoundingClientRect();
    return {x:c.left+b.centerX*c.width/1280,y:c.top+b.centerY*c.height/720};
  });
  await page.mouse.click(point.x,point.y);
  await page.waitForFunction(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('CodexScene');
    const tile=s.gridLayer.list.find((o:any)=>o.getData('cardId')==='wands_03');
    return !!tile?.getByName('codex-card-art');
  });
  await settleCanvas(page);
  await page.screenshot({path:info.outputPath('recovered-art.png')});
});
