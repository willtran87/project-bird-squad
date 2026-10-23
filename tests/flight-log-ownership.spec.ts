import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { installVirtualController, pressController, controllerButton } from './helpers/virtual-controller';

test.use({ hasTouch: true });
const snapshot = (page: Page) => page.evaluate(() => JSON.parse((window as any).render_game_to_text()));
async function tap(page: Page, name: string) {
  await settleCanvas(page);
  const point = await page.evaluate(name => {
    const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene'), h = s.children.getByName(name);
    const c = s.game.canvas.getBoundingClientRect();
    return { x: c.left + h.x * c.width / 1280, y: c.top + h.y * c.height / 720 };
  }, name);
  await page.touchscreen.tap(point.x, point.y); await settleCanvas(page);
}
async function boot(page: Page) {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await installVirtualController(page);
  await page.addInitScript(() => {
    localStorage.setItem('birdsquad.screenReader', 'on');
    const runs = Array.from({ length: 10 }, (_, i) => ({ id: `run-${1770000000000 + i * 60000}-${i}`,
      seed: `ownership-${i}`, result: 'win', leaderId: 'fledgling', difficulty: 0,
      runMode: 'quick', mapId: 'map_01_rooftop_blocks', finalNodeId: 'm1_entry', turnsTaken: 4,
      durationMs: 48000, currentCohesion: 12, maxCohesion: 38, path: ['m1_entry'],
      deck: [{ id: 'wands_ace' }], routeMarks: [], suppliesUsed: [], signals: [], combatResults: [] }));
    for (const key of ['birdsquad.runs', 'birdsquad.runs.backup']) localStorage.setItem(key, JSON.stringify(runs));
  });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('ProfileScene');
    w.__birdSquadGame.scene.stop('MenuScene'); w.__birdSquadGame.scene.start('ProfileScene');
  });
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).scene === 'ProfileScene');
  await tap(page, 'profile-flight-log-hit');
}
async function focus(page: Page, action: string) {
  for (let i = 0; i < 15 && (await snapshot(page)).folioFocus.action !== action; i++) await page.keyboard.press('Tab');
  expect((await snapshot(page)).folioFocus.action).toBe(action);
}
const stored = (page: Page) => page.evaluate(() => localStorage.getItem('birdsquad.runs'));

async function reviewFault(page: Page, mode: 'reject' | 'pending') {
  // Inject only the existing dependency boundary, not a production test hook.
  // The dossier is also a static rendering dependency: blocking its download
  // would prevent ProfileScene itself from opening, not stall review loading.
  await page.route('**/profile-scene-*.js', async route => {
    const response = await route.fetch(), source = await response.text();
    expect(source.match(/loadFlightReview:[\w$]+/g)).toHaveLength(1);
    await route.fulfill({ response, body: source.replace(/loadFlightReview:([\w$]+)/,
      'loadFlightReview:id=>window.__reviewFault(id,$1)') });
  });
  await page.addInitScript(mode => {
    const w=window as any; w.__reviewRequests=0;
    w.__reviewFault=(id:string, original:(id:string)=>Promise<unknown>)=>{
      w.__reviewRequests++;
      if(mode==='reject') return Promise.reject(new Error('Injected review failure'));
      if(w.__reviewReleased) return original(id);
      return new Promise(resolve=>{(w.__reviewReleases??=[]).push(()=>original(id).then(resolve));});
    };
  },mode);
}

test('Flight Log actions are distinct, non-mutating and restore exact nested focus', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page); const before = await stored(page);
  const original = (await snapshot(page)).flightHistory.selected.id;
  await focus(page, 'profile-flight-log-page-newer');
  await page.keyboard.press('Enter');
  expect((await snapshot(page)).flightHistory.selected.id).toBe(original);
  for (const [width, height] of [[2560,1600], [1440,900], [1000,560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').renderPremiumProfileScene());
    expect((await snapshot(page)).folioFocus.action).toBe('profile-flight-log-page-newer');
    const controls = await page.evaluate(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
      const scale = s.game.canvas.getBoundingClientRect().height / 720;
      return s.children.list.filter((o: any) => o.name?.startsWith('profile-flight-log-') && o.getData?.('controlKind'))
        .map((o: any) => ({ name:o.name, width:o.width*scale, height:o.height*scale, focused:!!o.getData('focused') }));
    });
    expect(controls.filter((c: any) => c.focused)).toHaveLength(1);
    for (const c of controls) { expect(c.width).toBeGreaterThanOrEqual(44); expect(c.height).toBeGreaterThanOrEqual(44); }
    await page.screenshot({ path: info.outputPath(`log-focus-${width}.png`) });
  }
  await pressController(page, 15); // Older, not a change of selected flight.
  expect((await snapshot(page)).folioFocus.action).toBe('profile-flight-log-page-older');
  expect((await snapshot(page)).flightHistory.selected.id).toBe(original);
  await pressController(page, 0);
  expect((await snapshot(page)).flightHistory.page).toBe(2);
  await tap(page, 'profile-flight-log-row-9');
  await expect.poll(async () => (await snapshot(page)).flightHistory.review?.seed).toBe('ownership-0');
  const readingPage = () => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene')
    .children.getByName('profile-flight-review-root').getByName('run-flight-details-section-body').getData('reading').page);
  await page.keyboard.press('PageDown');
  await expect.poll(readingPage).toBe(2);
  await page.keyboard.press('ArrowRight'); // Action focus redraw must not reset reading.
  expect(await readingPage()).toBe(2);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene')
    .input.keyboard.listenerCount('keydown-PAGE_DOWN'))).toBe(2); // Parent pager + current reader only.
  await pressController(page, 5);
  await expect.poll(readingPage).toBe(3);
  await pressController(page, 4);
  await expect.poll(readingPage).toBe(2);
  await controllerButton(page, 1, true); await settleCanvas(page);
  expect((await snapshot(page)).flightHistory.review).toBe(null);
  expect((await snapshot(page)).flightHistory.open).toBe(true);
  expect((await snapshot(page)).folioFocus.action).toBe('profile-flight-log-row-9');
  await controllerButton(page, 1, false);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot(page)).flightHistory.review?.seed).toBe('ownership-0');
  await page.keyboard.press('Escape');
  await focus(page, 'profile-flight-log-close'); await page.keyboard.press('Enter');
  expect((await snapshot(page)).flightHistory.open).toBe(false);
  expect((await snapshot(page)).focus.current).toBe('flightLog');
  expect(await stored(page)).toBe(before); expect(errors).toEqual([]);
});

test('failed review loader exposes retry without unhandled rejection or lost focus', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await reviewFault(page,'reject');
  await boot(page); const before = await stored(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot(page)).flightHistory.message).toContain('Review unavailable');
  expect((await snapshot(page)).flightHistory.loading).toBe(false);
  expect((await snapshot(page)).folioFocus.action).toBe('profile-history-review');
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Review unavailable');
  for (const [width,height] of [[2560,1600],[1440,900],[1000,560]]) {
    await page.setViewportSize({width,height}); await settleCanvas(page);
    await page.screenshot({path:info.outputPath(`log-error-${width}.png`)});
  }
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot(page)).flightHistory.loading).toBe(false);
  expect(await page.evaluate(()=>(window as any).__reviewRequests)).toBe(2);
  await page.keyboard.press('Escape');
  expect((await snapshot(page)).flightHistory.open).toBe(false);
  expect(await stored(page)).toBe(before); expect(errors).toEqual([]);
});

for (const exit of ['reopen', 'navigate', 'shutdown', 'timeout'] as const) test(`pending review ${exit} retires old ownership and preserves user choice`, async ({ page }, info) => {
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await reviewFault(page,'pending');
  const release=()=>page.evaluate(async()=>{const w=window as any;w.__reviewReleased=true;await Promise.all((w.__reviewReleases??[]).map((r:()=>Promise<unknown>)=>r()));});
  try {
    await boot(page); const before=await stored(page);
    await page.keyboard.press('Enter');
    await expect.poll(async()=>(await snapshot(page)).flightHistory.loading).toBe(true);
    const loading = await page.evaluate(() => {
      const h=(window as any).__birdSquadGame.scene.getScene('ProfileScene').children.getByName('profile-history-review');
      return {status:h.getData('status'), enabled:h.input.enabled, focused:h.getData('focused')};
    });
    expect(loading).toEqual({status:'loading',enabled:false,focused:true});
    await page.keyboard.press('Enter'); // Cannot submit twice while pending.
    expect(await page.evaluate(()=>(window as any).__reviewRequests)).toBe(1);
    if(exit==='timeout') {
      await expect.poll(async()=>(await snapshot(page)).flightHistory.message,{timeout:12000}).toContain('timed out');
      expect((await snapshot(page)).flightHistory.loading).toBe(false);
      await page.screenshot({path:info.outputPath('log-timeout-2560.png')});
    } else if(exit==='navigate') {
      await page.keyboard.press('ArrowRight');
      expect((await snapshot(page)).flightHistory.selected.seed).toBe('ownership-8');
      expect((await snapshot(page)).flightHistory.loading).toBe(false);
    } else if(exit==='shutdown') {
      await page.evaluate(() => {
        const g=(window as any).__birdSquadGame; g.scene.stop('ProfileScene');g.scene.start('ProfileScene');
      });
      await tap(page,'profile-flight-log-hit');
    } else {
      await page.keyboard.press('Escape'); await tap(page,'profile-flight-log-hit');
    }
    await release();await settleCanvas(page);
    expect((await snapshot(page)).flightHistory.review).toBe(null);
    expect((await snapshot(page)).flightHistory.loading).toBe(false);
    await focus(page,'profile-history-review');await page.keyboard.press('Enter');
    await expect.poll(async()=>(await snapshot(page)).flightHistory.review?.seed).toBe(exit==='navigate'?'ownership-8':'ownership-9');
    await page.keyboard.press('Escape');
    expect((await snapshot(page)).folioFocus.action).toBe('profile-history-review');
    expect(await stored(page)).toBe(before);expect(errors).toEqual([]);
  } finally {await release();}
});

for (const exit of ['read', 'close', 'shutdown', 'cancel'] as const) test(`Save Data ${exit} owns file input, focus timers and late results`, async ({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await boot(page);await page.keyboard.press('Escape');await tap(page,'profile-save-data-hit');
  const before=await stored(page);
  await page.evaluate(()=>{
    const original=File.prototype.text; const w=window as any;
    File.prototype.text=function(){return new Promise<string>(resolve=>{w.__finishBackupRead=()=>original.call(this).then(resolve);});};
  });
  const chooserEvent=page.waitForEvent('filechooser');await tap(page,'profile-save-restore-file-hit');
  const chooser=await chooserEvent;
  if(exit==='cancel') {
    await page.locator('input[type=file]').dispatchEvent('cancel');
    await expect(page.locator('input[type=file]')).toHaveCount(0);
    expect((await snapshot(page)).saveData.status).toBe('idle');
    expect((await snapshot(page)).focus.current).toBe('saveRestore');
  } else {
    await chooser.setFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('not a backup')});
    await page.waitForFunction(()=>Boolean((window as any).__finishBackupRead));
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    // Cross the browser picker-cancel fallback while a real File.text is pending.
    await expect.poll(async()=>page.evaluate(()=>performance.now())).toBeGreaterThan(await page.evaluate(()=>performance.now()+180));
    expect(await page.locator('input[type=file]').count()).toBe(1);
    const control=await page.evaluate(()=>{
      const h=(window as any).__birdSquadGame.scene.getScene('ProfileScene').children.getByName('profile-save-restore-file-hit');
      return {status:h.getData('status'),enabled:h.input.enabled};
    });
    expect(control).toEqual({status:'loading',enabled:false});
    await page.keyboard.press('Enter');expect(await page.locator('input[type=file]').count()).toBe(1);
    if(exit==='read') {
      for (const [width,height] of [[2560,1600],[1440,900],[1000,560]]) {
        await page.setViewportSize({width,height});await settleCanvas(page);
        await page.screenshot({path:info.outputPath(`backup-reading-${width}.png`)});
      }
    } else if(exit==='close') {
      await tap(page,'profile-save-close');await expect(page.locator('input[type=file]')).toHaveCount(0);
      await tap(page,'profile-save-data-hit');
    } else {
      await page.evaluate(()=>{const g=(window as any).__birdSquadGame;g.scene.stop('ProfileScene');g.scene.start('ProfileScene');});
      await expect(page.locator('input[type=file]')).toHaveCount(0);await tap(page,'profile-save-data-hit');
    }
    await page.evaluate(()=> (window as any).__finishBackupRead());await settleCanvas(page);
    expect((await snapshot(page)).saveData.status).toBe(exit==='read'?'invalid':'idle');
    expect((await snapshot(page)).saveData.pending).toBe(null);
    expect((await snapshot(page)).focus.current).toBe(exit==='read'?'saveRestore':'saveDownload');
    await expect(page.locator('input[type=file]')).toHaveCount(0);
  }
  // A subsequent picker still opens; no abandoned request owns this panel.
  const retry=page.waitForEvent('filechooser');await tap(page,'profile-save-restore-file-hit');await retry;
  await page.locator('input[type=file]').dispatchEvent('cancel');
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  expect(await stored(page)).toBe(before);expect(errors).toEqual([]);
});

for(const fault of ['timeout','reject'] as const)test(`Save Data ${fault} restores an actionable file picker and ignores retired reads`,async({page},info)=>{
  await boot(page);await page.keyboard.press('Escape');await tap(page,'profile-save-data-hit');
  const before=await stored(page);
  await page.evaluate(fault=>{
    const w=window as any;w.__readOriginal=File.prototype.text;w.__reads=[];
    File.prototype.text=function(){return fault==='reject'?Promise.reject(new Error('Read denied')):new Promise<string>(resolve=>w.__reads.push(()=>w.__readOriginal.call(this).then(resolve)));};
  },fault);
  const event=page.waitForEvent('filechooser');await tap(page,'profile-save-restore-file-hit');
  await(await event).setFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from('retired read')});
  await expect.poll(async()=>(await snapshot(page)).saveData.status,{timeout:10000}).toBe('restoreFailed');
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  expect((await snapshot(page)).saveData.message).toContain(fault==='timeout'?'timed out':'could not be read');
  expect((await snapshot(page)).folioFocus.action).toBe('profile-save-restore-file-hit');
  const retryState=await page.evaluate(()=>{const h=(window as any).__birdSquadGame.scene.getScene('ProfileScene').children.getByName('profile-save-restore-file-hit');return{status:h.getData('status'),enabled:!!h.input?.enabled};});
  expect(retryState).toEqual({status:'error',enabled:true});
  await page.setViewportSize({width:1000,height:560});await settleCanvas(page);
  await page.screenshot({path:info.outputPath('read-recovery-1000.png')});
  await page.evaluate(()=>{File.prototype.text=(window as any).__readOriginal;});
  const retry=page.waitForEvent('filechooser');await tap(page,'profile-save-restore-file-hit');
  await(await retry).setFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('invalid')});
  await expect.poll(async()=>(await snapshot(page)).saveData.status).toBe('invalid');
  if(fault==='timeout'){await page.evaluate(()=>(window as any).__reads[0]());await settleCanvas(page);expect((await snapshot(page)).saveData.status).toBe('invalid');}
  expect(await stored(page)).toBe(before);expect((await snapshot(page)).saveData.pending).toBe(null);
});
