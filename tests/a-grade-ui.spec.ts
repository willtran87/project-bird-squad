import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test.use({ hasTouch: true });

async function start(page: Page, key: string) {
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async key => {
    const w = window as any; await w.__birdSquadEnsureScene(key);
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start(key);
  }, key);
  await page.waitForFunction(key => (window as any).__birdSquadGame.scene.isActive(key), key);
  await settleCanvas(page);
}
async function click(page: Page, sceneKey: string, name: string) {
  await settleCanvas(page);
  const p = await page.evaluate(({ sceneKey, name }) => {
    const s = (window as any).__birdSquadGame.scene.getScene(sceneKey);
    const walk = (items: any[]): any[] => items.flatMap(o => [o, ...(o.list ? walk(o.list) : [])]);
    const o = walk(s.children.list).find(o => o.name === name && o.input?.enabled);
    if (!o) throw new Error(`Missing enabled ${name}`);
    const b = o.getBounds(), c = s.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, { sceneKey, name });
  await page.mouse.click(p.x, p.y); await settleCanvas(page);
}

test('quiet profile separates records, retains navigation, and fits supported sizes', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await start(page, 'ProfileScene');
  for (const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(size); await settleCanvas(page);
    await click(page, 'ProfileScene', 'profile-leaders-tab-hit');
    const leaders = await page.evaluate(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
      return s.children.list.filter((o: any) => o.name === 'profile-leader-name').length;
    });
    expect(leaders).toBe(5);
    await page.screenshot({path:info.outputPath(`leaders-${size.width}.png`)});
    await click(page, 'ProfileScene', 'profile-achievements-tab-hit');
    const geometry = await page.evaluate(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
      const text = s.children.list.filter((o: any) => o.name === 'profile-badge-description');
      const canvas = s.game.canvas.getBoundingClientRect();
      return { count: text.length,
        fontFloor: text.every((o: any) => parseFloat(o.style.fontSize) * canvas.width / 1280 >= 14),
        inside: text.every((o: any) => {const b=o.getBounds(); return b.left>=400&&b.right<=1190&&b.bottom<=578;}),
        ornament: s.children.list.some((o:any)=>o.name==='profile-record-flourish'),
      };
    });
    expect(geometry).toEqual({ count:3, fontFloor:true, inside:true, ornament:false });
    await page.screenshot({path:info.outputPath(`badges-${size.width}.png`)});
    const pages = await page.evaluate(() => JSON.parse((window as any).render_game_to_text()).badgePagination.pageCount);
    for (let index = 1; index < pages; index++) {
      await click(page, 'ProfileScene', 'profile-badge-page-next');
      expect(await page.evaluate(() => JSON.parse((window as any).render_game_to_text()).badgePagination.page)).toBe(index + 1);
      expect(await page.evaluate(() => {
        const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
        return s.children.list.filter((o:any)=>o.name==='profile-badge-description')
          .every((o:any)=>o.getBounds().right<=1190 && o.getBounds().bottom<=578);
      })).toBe(true);
    }
    for (const tab of ['contracts', 'showcase', 'folios']) {
      await click(page, 'ProfileScene', `profile-${tab}-tab-hit`);
      const controls = await page.evaluate(() => {
        const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
        const scale = s.game.canvas.getBoundingClientRect().width / 1280;
        return s.children.list.filter((o: any) => o.getData?.('fullLabel')).map((hit: any) => {
          const label = s.children.list.find((o: any) => o.type === 'Text' && o.x === hit.x && o.y === hit.y
            && o.getData('fullText') === hit.getData('fullLabel'));
          const h = hit.getBounds(), r = label?.getBounds();
          return { label: hit.getData('fullLabel'), readable: label && parseFloat(label.style.fontSize) * scale >= 16,
            complete: label && !label.getData('truncated'),
            contained: r && r.left >= h.left + 4 && r.right <= h.right - 4 && r.top >= h.top + 4 && r.bottom <= h.bottom - 4,
            target: h.width * scale >= 44 && h.height * scale >= 44,
            disabledSafe: hit.getData('enabled') || !hit.input?.enabled };
        });
      });
      expect(controls.length).toBeGreaterThan(7);
      for (const control of controls) expect(control, JSON.stringify(control)).toMatchObject({
        readable: true, complete: true, contained: true, target: true, disabledSafe: true,
      });
      await page.screenshot({path:info.outputPath(`${tab}-${size.width}.png`)});
    }
  }
  await click(page, 'ProfileScene', 'profile-save-data-hit');
  await page.keyboard.press('Escape'); await settleCanvas(page);
  await click(page, 'ProfileScene', 'profile-return-hit');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('MenuScene'));
  expect(errors).toEqual([]);
});

test('Marn resident uses the avian replacement and stays clear of the cache choices', async ({ page }, info) => {
  const artResponses: string[] = [];
  page.on('response', response => { if (response.ok() && response.url().includes('marn-valeclip-v3')) artResponses.push(response.url()); });
  await start(page, 'RouteScene');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.evaluate(() => {
    const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene');
    const n=w.__birdSquadCurrentMap().nodes.find((n:any)=>n.type==='cache');
    if (!n) throw new Error('Cache fixture unavailable');
    r.openNodeChoices(n);
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.list
    .some((o:any)=>o.texture?.key==='route-event-resident-marn-valeclip'));
  for (const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(size); await settleCanvas(page);
    const art = await page.evaluate(() => {
      const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');
      const o=s.children.list.find((o:any)=>o.texture?.key==='route-event-resident-marn-valeclip');
      const b=o.getBounds();
      return {source:o.texture.source[0].image.src, left:b.left,right:b.right,bottom:b.bottom,
        aspect:o.displayWidth/o.displayHeight, original:o.width/o.height};
    });
    expect(artResponses.length).toBeGreaterThan(0);
    expect(art.left).toBeGreaterThanOrEqual(0); expect(art.right).toBeLessThan(285);
    expect(art.bottom).toBeLessThanOrEqual(720); expect(art.aspect).toBeCloseTo(art.original,4);
    await page.screenshot({path:info.outputPath(`marn-${size.width}.png`)});
  }
});

for (const [type, name] of [['signal', 'ivo-tallymast'], ['nest', 'oren-shearbright'], ['rival', 'caldra-pinion']] as const) {
  test(`${name} has the reviewed resident art with no clipped feet or stretched anatomy`, async ({page}, info) => {
    const responses: string[] = [];
    page.on('response', r => {if (r.ok() && r.url().includes(`${name}-v3`)) responses.push(r.url());});
    await start(page, 'RouteScene');
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
    await page.evaluate(type => {
      const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene');
      const n=w.__birdSquadCurrentMap().nodes.find((n:any)=>n.type===type) ?? w.__birdSquadCurrentMap().nodes.find((n:any)=>n.type!=='boss');
      n.type=type; r.openNodeChoices(n);
    },type);
    await page.waitForFunction(name => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.list
      .some((o:any)=>o.texture?.key===`route-event-resident-${name}`), name);
    for(const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
      await page.setViewportSize(size); await settleCanvas(page);
      expect(responses.length).toBeGreaterThan(0);
      expect(await page.evaluate(name=>{
        const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');
        const o=r.children.list.find((o:any)=>o.texture?.key===`route-event-resident-${name}`),b=o.getBounds();
        return b.left>=0&&b.right<=400&&b.bottom<=720&&Math.abs(o.scaleX-o.scaleY)<0.00001;
      }, name)).toBe(true);
      await page.screenshot({path:info.outputPath(`${name}-${size.width}.png`)});
    }
  });
}

test('Market sections jump directly without spending and keep costs visible', async ({ page }, info) => {
  test.setTimeout(120000);
  await start(page, 'RouteScene');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').cardHoverDetailModule);
  await page.evaluate(() => {
    const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene');
    const n=w.__birdSquadCurrentMap().nodes.find((n:any)=>n.type!=='boss');
    n.type='market';r.runState.scrap=99;r.openMarketNode(n);
  });
  await page.waitForFunction(() => !!JSON.parse((window as any).render_game_to_text()).market?.rules);
  await page.waitForFunction(() => {
    const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.children.getByName('market-vendor-shopkeeper') && r.textures.exists('market-kit-background');
  });
  const before = await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState));
  for(const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(size);await settleCanvas(page);
    for(const category of [2,1,0]) {
      await click(page,'RouteScene',`market-reader-category-${category}`);
      expect(await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState))).toBe(before);
    }
    await page.screenshot({path:info.outputPath(`market-${size.width}.png`)});
    expect(await page.evaluate(() => {
      const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');
      const tabs=r.children.list.filter((o:any)=>o.name==='market-category-tab-hit');
      const c=r.game.canvas.getBoundingClientRect(),scale=c.width/1280;
      const vendor=r.children.getByName('market-vendor-shopkeeper');
      const title=r.children.getByName('market-vendor-title-surface');
      const backdrop=r.children.getByName('market-opaque-backdrop').getBounds();
      return vendor.getBounds().right<=title.getBounds().left && Math.abs(vendor.scaleX-vendor.scaleY)<0.001
        && vendor.frame.name==='portrait' && vendor.getBounds().top>=80 && vendor.getBounds().bottom<=164
        && vendor.displayWidth>=80 && r.children.getByName('market-background-scrim').fillAlpha>=0.5
        &&backdrop.top<=80 && tabs.length===4 && tabs.every((o:any,i:number)=>{
        const b=o.getBounds(); return b.left>=468&&b.right<=1200&&b.width*scale>=44&&b.height*scale>=44
          &&(!i||b.left>=tabs[i-1].getBounds().right+12);
      });
    })).toBe(true);
  }
  const category = await page.evaluate(() => {
    const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');
    const reader=r.hoverCardDetail.getByName('market-fixed-card-inspector');
    const b=reader.getByName('market-reader-category-2').getBounds(),c=r.game.canvas.getBoundingClientRect();
    return {x:c.left+b.centerX*c.width/1280,y:c.top+b.centerY*c.height/720};
  });
  await page.touchscreen.tap(category.x,category.y); await settleCanvas(page);
  expect(await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState))).toBe(before);
});

test('populated Flock views preserve records and offer separated readable commands', async ({page}, info) => {
  await page.addInitScript(() => {
    const account={runs:42,wins:22,losses:20,bestWinTier:6,fastestWinTurns:42,
      unlockedLeaders:['fledgling','spark_caller','talon','tidewarden','roostkeeper'],
      discoveredCards:['major_00','wands_ace','cups_ace'],showcase:['major_00','wands_ace','cups_ace'],
      leaderRecords:{fledgling:{clears:{'full:6':{wins:1,fastestRunTurns:42},'quick:0':{wins:2,fastestRunTurns:24}}}},
      decks:[{id:'visual-folio',lineageId:'visual-folio',name:'A Deliberately Long Flight Folio',leaderId:'fledgling',
        cards:[{id:'major_00',upgraded:false}],revision:1,createdAt:1,updatedAt:1,favorite:false,archived:false,
        sourceSeed:'visual-review',runMode:'full',description:'Guard and flow through the canal, carrying a reserve answer for every difficult fight.'}]};
    const raw=JSON.stringify(account); localStorage.setItem('birdsquad.account',raw);localStorage.setItem('birdsquad.account.backup',raw);
  });
  await start(page,'ProfileScene');
  for(const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(size);await settleCanvas(page);
    for(const tab of ['leaders','showcase','folios']) {
      await click(page,'ProfileScene',`profile-${tab}-tab-hit`);
      if(tab==='showcase') await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('ProfileScene').children.list
        .filter((o:any)=>o.name==='profile-showcase-card-art').length===3);
      if(tab==='showcase') expect(await page.evaluate(()=>{
        const s=(window as any).__birdSquadGame.scene.getScene('ProfileScene');
        const title=s.children.getByName('profile-showcase-title').getBounds();
        return s.children.list.filter((o:any)=>o.name==='profile-showcase-card-art')
          .every((o:any)=>o.getBounds().top >= title.bottom + 8);
      })).toBe(true);
      await settleCanvas(page);
      await page.screenshot({path:info.outputPath(`${tab}-populated-${size.width}.png`)});
    }
    expect(await page.evaluate(()=>{
      const s=(window as any).__birdSquadGame.scene.getScene('ProfileScene');
      const controls=s.children.list.filter((o:any)=>o.input?.enabled&&o.name?.startsWith('profile-folio-'));
      return controls.every((a:any,i:number)=>controls.slice(i+1).every((b:any)=>{
        const x=a.getBounds(),y=b.getBounds();return x.right<=y.left||y.right<=x.left||x.bottom<=y.top||y.bottom<=x.top;
      }));
    })).toBe(true);
  }
});

for (const unlocked of [false, true]) test(`setup portraits and playstyles preserve ${unlocked ? 'unlocked' : 'locked'} leader choices`, async ({page}, info)=>{
  if (unlocked) await page.addInitScript(()=>{
    const raw=JSON.stringify({unlockedLeaders:['fledgling','spark_caller','talon','tidewarden','roostkeeper']});
    localStorage.setItem('birdsquad.account',raw);localStorage.setItem('birdsquad.account.backup',raw);
  });
  await start(page,'MenuScene');
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').setSetupOpen(true));
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').children.list
    .filter((o:any)=>o.name.startsWith('title-leader-portrait-')).length===5);
  for(const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(size);await settleCanvas(page);
    expect(await page.evaluate(()=>{
      const s=(window as any).__birdSquadGame.scene.getScene('MenuScene');
      return s.leaderPanels.every((p:any)=>{
        const b=p.rect.getBounds(),art=s.children.getByName(`title-leader-portrait-${p.id}`),a=art.getBounds();
        const labels=s.children.list.filter((o:any)=>['title-leader-name','title-leader-detail'].includes(o.name)&&o.getData('leaderId')===p.id);
        return a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom
          &&Math.abs(art.scaleX-art.scaleY)<0.001&&labels.every((o:any)=>{
            const t=o.getBounds();return t.left>=b.left&&t.right<=b.right&&t.top>=b.top&&t.bottom<=b.bottom
              &&(t.bottom<=a.top||t.left>=a.right||t.top>=a.bottom||t.right<=a.left);
          });
      });
    })).toBe(true);
    await page.screenshot({path:info.outputPath(`setup-${size.width}.png`)});
  }
  const before=await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').selectedLeaderId);
  await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('MenuScene');
    s.leaderPanels.find((p:any)=>p.id==='talon').rect.emit('pointerdown');
  });
  await settleCanvas(page);
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').selectedLeaderId)).toBe(unlocked?'talon':before);
  if(!unlocked) expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').leaderTooltip.list
    .find((o:any)=>o.name==='title-leader-description-body').text)).toMatch(/win|damage|defeat|unlock/i);
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').setSetupOpen(false));
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').children.list
    .filter((o:any)=>o.name.startsWith('title-leader-portrait-')).every((o:any)=>!o.visible))).toBe(true);
});

test('setup remains usable when optional portraits fail and recovers on reopening', async ({page})=>{
  await page.route(/front-3q.*\.webp/,route=>route.abort());
  await start(page,'MenuScene');
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').setSetupOpen(true));
  await settleCanvas(page);
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').children.list
    .filter((o:any)=>o.name==='title-leader-name'&&o.visible).length)).toBe(5);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').setupOpen===false);
  await page.unroute(/front-3q.*\.webp/);
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').setSetupOpen(true));
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').children.list
    .filter((o:any)=>o.name.startsWith('title-leader-portrait-')&&o.visible).length===5);
});

test('reopening setup retries portraits after the previous opening finishes failing', async ({page})=>{
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  let requests=0;
  const attempts=new Map<string,number>();
  await page.route(/front-3q.*\.webp/,async route=>{
    const url=route.request().url(),attempt=(attempts.get(url)??0)+1;attempts.set(url,attempt);requests++;
    // Fail the original transfer and both built-in transport retries.
    if(attempt<=3){await gate;await route.abort();}else await route.continue();
  });
  try{
    await start(page,'MenuScene');
    await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').setSetupOpen(true));
    await expect.poll(()=>requests).toBeGreaterThanOrEqual(5);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').setupOpen===false);
    await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').setSetupOpen(true));
    await settleCanvas(page);
    release();
    await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').children.list
      .filter((o:any)=>o.name.startsWith('title-leader-portrait-')&&o.visible).length===5);
  }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('late setup portraits remain hidden after returning home', async ({page})=>{
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  let requested=0;
  await page.route(/front-3q.*\.webp/,async route=>{requested++;await gate;await route.continue();});
  try {
    await start(page,'MenuScene');
    await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').setSetupOpen(true));
    await expect.poll(()=>requested).toBe(5);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').setupOpen===false);
    release();
    await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').children.list
      .filter((o:any)=>o.name.startsWith('title-leader-portrait-')).length===5);
    expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').children.list
      .filter((o:any)=>o.name.startsWith('title-leader-portrait-')).every((o:any)=>!o.visible))).toBe(true);
    await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').setSetupOpen(true));
    expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').children.list
      .filter((o:any)=>o.name.startsWith('title-leader-portrait-')&&o.visible).length)).toBe(5);
  } finally {release();}
});

test('failed setup decoration module never blocks navigation or throws an unhandled rejection', async ({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  let requested=false;
  await page.route(/setup-portraits-.*\.js/,async route=>{requested=true;await route.abort();});
  await start(page,'MenuScene');
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').setSetupOpen(true));
  await expect.poll(()=>requested).toBe(true);
  await expect(page.getByRole('dialog', {name:'Download recovery'})).toBeVisible();
  await page.getByRole('button', {name:'Keep playing', exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').setupOpen)).toBe(true);
  await settleCanvas(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').setupOpen===false);
  expect(errors).toEqual([]);
});

test('map direction and completed markers survive compact layouts without committing a route', async ({page}, info)=>{
  await start(page,'RouteScene');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text()).assetReadiness?.fullArt);
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').routeMapRendererModule);
  await page.evaluate(()=>{
    const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene'),map=w.__birdSquadCurrentMap();
    r.runState.districtContracts.forEach((contract:any)=>{contract.confirmed=true;});
    const node=r.getSelectableNodes()[0];
    r.runState.currentRouteNodeId=node.id;r.runState.completedRouteNodeIds=[node.id];
    r.selectableNodeIds=new Set(map.edges.filter((e:any)=>e.from===node.id&&!e.locked).map((e:any)=>e.to));
    r.selectedNodeId=[...r.selectableNodeIds][0];r.renderAll();
  });
  const before=await page.evaluate(()=>JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState));
  for(const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(size);await settleCanvas(page);
    expect(await page.evaluate(()=>{
      const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');
      const label=r.children.list.find((o:any)=>o.name==='route-node-selected-label'&&o.type==='Text');
      return {completed:r.children.list.filter((o:any)=>o.name==='route-node-completed-check').length,
        direction:r.children.list.filter((o:any)=>o.name==='route-edge-direction').length>0,
        label:label?.text,contained:label?.getBounds().bottom<=690};
    })).toEqual({completed:1,direction:true,label:'Selected',contained:true});
    await page.screenshot({path:info.outputPath(`map-${size.width}.png`)});
  }
  expect(await page.evaluate(()=>JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState))).toBe(before);
});
