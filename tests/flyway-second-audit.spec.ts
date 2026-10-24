import { test, expect, type Page } from '@playwright/test';

async function route(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__birdSquadGame?.scene.isActive('MenuScene'));
  const keep = page.getByRole('button', {name:'Keep playing', exact:true});
  if (await keep.isVisible()) await keep.click();
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').startRun());
  await page.waitForFunction(() => {const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');return s?.routeEssentialAssetsReady;});
}
async function battle(page: Page) {
  await route(page);
  await page.evaluate(() => {const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');s.scene.start('BattleScene',{runState:structuredClone(s.runState),routeNodeId:'m1_entry'});});
  await page.waitForFunction(() => {const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');return s?.combatPreviewModule&&s.fxLayer?.active&&!s.combatIntroActive&&!s.combatAnimationPending;});
}
async function finish(page: Page) {
  await page.evaluate(() => {const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');s.flyway.story='small-flock';s.mode='runComplete';s.emitRunSummary('win');s.renderAll();});
}

test('opening and closing the journal within one frame does not leave play paused',async({page})=>{
  await route(page);await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').openFlyway);
  await page.evaluate(()=>{
    const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');s.openFlyway();
    [...document.querySelectorAll<HTMLButtonElement>('#flyway-book button')].find(b=>b.textContent==='Return to game')!.click();
    return new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  });
  await expect(page.locator('#flyway-book')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.isActive('RouteScene'))).toBe(true);
});

test('ending persists the birds and story seal when the journal module never loads',async({page})=>{
  await page.route(/\/assets\/flyway-expansion-.*\.js$/,r=>r.abort('failed'));
  await battle(page);await finish(page);
  const saved=await page.evaluate(()=>({archive:JSON.parse(localStorage.getItem('birdsquad.flyway.journal')??'null'),seals:JSON.parse(localStorage.getItem('birdsquad.flyway.medals')??'null')}));
  expect(saved.archive?.birds.length).toBeGreaterThan(0);expect(saved.seals).toContain('small-flock');
});

for(const key of ['birdsquad.flyway.journal','birdsquad.flyway.medals']) test(`ending cannot leave before ${key} is saved`,async({page})=>{
  await battle(page);
  await page.evaluate(key=>{const original=Storage.prototype.setItem;(window as any).__restoreStorage=()=>{Storage.prototype.setItem=original;};Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Audit full storage','QuotaExceededError');return original.call(this,k,v);};},key);
  await finish(page);
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').returnToMainMenu());
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.isActive('BattleScene'))).toBe(true);
  expect(await page.evaluate(()=>localStorage.getItem('birdsquad.run.active'))).not.toBeNull();
  await expect(page.getByRole('button',{name:'Retry saving',exact:true})).toBeVisible();
  await page.evaluate(()=>(window as any).__restoreStorage());
  await page.getByRole('button',{name:'Retry saving',exact:true}).click();
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').returnToMainMenu());
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.isActive('MenuScene'));
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'null'),key)).toBeTruthy();
});

test('restarting a scene during download retires its pending Preen and journal controls',async({page})=>{
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route(/\/assets\/flyway-expansion-.*\.js$/,async r=>{await held;await r.continue();});
  try {
    await route(page);
    await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');s.cardPickerContext='districtPreen';s.cardPickerMode='preen';s.cardPickerRemainingPicks=1;s.applyCardPick(s.runState.deck.findIndex((c:any)=>c.id==='major_00'),true);s.scene.restart({runState:structuredClone(s.runState)});});
    await page.waitForFunction(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');return s.sys.isActive()&&s.routeEssentialAssetsReady&&!s.cardPickerMode;});
    release();await expect(page.locator('#flyway-launch')).toHaveCount(1);
    await expect(page.locator('#flyway-book')).toHaveCount(0);
    await page.keyboard.press('j');await expect(page.locator('#flyway-book')).toHaveCount(1);
    await page.keyboard.press('Escape');await expect(page.locator('#flyway-book')).toHaveCount(0);
  } finally {release();}
});

test('cancelling a Preen while its module downloads does not reopen a stale choice',async({page})=>{
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route(/\/assets\/flyway-expansion-.*\.js$/,async r=>{await held;await r.continue();});
  try {
    await route(page);
    await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');s.cardPickerContext='districtPreen';s.cardPickerMode='preen';s.cardPickerRemainingPicks=1;s.applyCardPick(s.runState.deck.findIndex((c:any)=>c.id==='major_00'),true);s.cancelRouteCardPicker();});
    release();await expect(page.locator('#flyway-launch')).toBeVisible();
    await expect(page.locator('#flyway-book')).toHaveCount(0);
    expect(await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');const c=s.runState.deck.find((c:any)=>c.id==='major_00');return !!c.upgraded||!!c.preenBranch;})).toBe(false);
  } finally {release();}
});
