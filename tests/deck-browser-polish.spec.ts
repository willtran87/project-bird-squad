import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { appendFlightFolio, createSavedDeckRecord } from '../src/game/saved-decks';

test.use({ hasTouch: true });

test('deck browser Folio append preserves archives, capacity and caller data', () => {
  const input = { leaderId: 'fledgling', leaderName: 'Fledgling', cards: [{ id: 'major_00', upgraded: true }],
    sourceSeed: 'deck-polish', runMode: 'quick' as const, now: 1000 };
  const records = Array.from({ length: 8 }, (_, i) => ({ ...createSavedDeckRecord({ ...input, name: `Record ${i}`, id: `folio-${i}` }), archived: i > 5 }));
  const before = JSON.stringify(records);
  expect(appendFlightFolio(records, input)).toBeUndefined();
  expect(JSON.stringify(records)).toBe(before);
  records[0].archived = true;
  const availableBefore = JSON.stringify(records);
  const result = appendFlightFolio([...records, null, { id: 'corrupt' }], { ...input, id: 'new-flight' })!;
  expect(result).toHaveLength(9);
  expect(result.filter(r => r.archived)).toHaveLength(3);
  expect(result[0]).toMatchObject({ name: 'Fledgling Flight 6', id: 'new-flight', cards: input.cards, runMode: 'quick', sourceSeed: input.sourceSeed });
  expect(JSON.stringify(records)).toBe(availableBefore);
  expect(result[0].cards).not.toBe(input.cards);
});

async function openDeck(page: Page, waitReader = true) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('RouteScene');
    w.__birdSquadGame.scene.stop('MenuScene'); w.__birdSquadGame.scene.start('RouteScene');
  });
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).assetReadiness?.fullArt);
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.runState.districtContracts.forEach((c: any) => c.confirmed = true); r.openDeckOverlay();
  });
  if (waitReader) await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('deck-review-detail-panel'));
  await settleCanvas(page);
}

async function tap(page: Page, name: string) {
  const p = await page.evaluate(name => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const b = r.children.getByName(name).getBounds(), c = r.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, name);
  await page.touchscreen.tap(p.x, p.y); await settleCanvas(page);
}

async function layout(page: Page) {
  return page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), list = r.children.list;
    const start = list.indexOf(r.children.getByName('deck-review-curtain'));
    const reader = list.findIndex((o: any, i: number) => i > start && /deck-review-(detail|comparison)-panel/.test(o.name));
    const end = reader < 0 ? list.indexOf(r.children.getByName('deck-review-empty-hint')) + 1 : reader;
    const nodes = list.slice(start, end), scale = r.game.canvas.getBoundingClientRect().width / 1280;
    const bounds = (o: any) => { const b = o.getBounds(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height }; };
    const hits = nodes.filter((o: any) => o.input?.enabled && o.name !== 'deck-review-curtain');
    return {
      texts: nodes.filter((o: any) => o.type === 'Text').map((o: any) => ({ name: o.name, text: o.text,
        size: parseFloat(o.style.fontSize) * scale, full: o.getData('fullText'), truncated: o.getData('truncated'), ...bounds(o) })),
      hits: hits.map((o: any) => ({ name: o.name, width: o.displayWidth * scale, height: o.displayHeight * scale })),
      collisions: hits.flatMap((a: any, i: number) => hits.slice(i + 1).flatMap((b: any) => {
        const x = bounds(a), y = bounds(b);
        return x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top ? [[a.name, b.name]] : [];
      })),
      rows: nodes.filter((o: any) => o.name === 'deck-review-row-hit').map((o: any) => ({ id: o.getData('cardId'), selected: o.getData('selected'), ...bounds(o) })),
      labels: nodes.filter((o: any) => o.getData?.('labelObject')).map((o: any) => ({ name: o.name, enabled: o.getData('enabled'),
        label: o.getData('labelObject').text, button: bounds(o), text: bounds(o.getData('labelObject')) })),
    };
  });
}

function checkLayout(l: Awaited<ReturnType<typeof layout>>) {
  expect(l.collisions).toEqual([]);
  for (const t of l.texts) {
    expect(t.size, `${t.name}: ${t.text}`).toBeGreaterThanOrEqual(14);
    if (/row-(title|cost)|-hit-label/.test(t.name)) expect(t.size, t.name).toBeGreaterThanOrEqual(16);
    expect(t.left).toBeGreaterThanOrEqual(112); expect(t.right).toBeLessThanOrEqual(1198);
    expect(t.top).toBeGreaterThanOrEqual(88); expect(t.bottom).toBeLessThanOrEqual(704);
  }
  for (const h of l.hits) { expect(h.width, h.name).toBeGreaterThanOrEqual(44); expect(h.height, h.name).toBeGreaterThanOrEqual(44); }
  for (const c of l.labels) {
    expect(c.text.left, c.name).toBeGreaterThanOrEqual(c.button.left + 4);
    expect(c.text.right, c.name).toBeLessThanOrEqual(c.button.right - 4);
    expect(c.text.top, c.name).toBeGreaterThanOrEqual(c.button.top + 2);
    expect(c.text.bottom, c.name).toBeLessThanOrEqual(c.button.bottom - 2);
  }
  l.rows.slice(1).forEach((r, i) => expect(r.top - l.rows[i].bottom).toBeGreaterThanOrEqual(8));
}

test('deck browser readable controls, separated rows, long query and empty state at three viewports', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await openDeck(page);
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    const l = await layout(page); checkLayout(l); expect(l.rows).toHaveLength(6);
    await page.screenshot({ path: info.outputPath(`deck-${width}.png`) });
  }
  await tap(page, 'deck-review-scroll-down-hit');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').cardReviewScroll)).toBe(1);
  await tap(page, 'deck-review-scroll-up-hit');
  for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowDown');
  expect((await layout(page)).rows.some(r => r.selected)).toBe(true);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').cardReviewScroll)).toBe(4);
  await page.keyboard.press('ArrowDown'); expect((await layout(page)).rows[0].selected).toBe(true);
  await page.keyboard.press('/'); await page.keyboard.type('wwwwwwwwwwwwwwwwwwwwwwww');
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    const l = await layout(page); checkLayout(l); expect(l.rows).toHaveLength(0);
    expect(l.texts.find(t => t.name === 'deck-review-control-guide')?.text).toContain('wwwwwwwwwwwwwwwwwwwwwwww');
    expect(l.labels.find(t => t.name === 'deck-review-filter-hit')?.enabled).toBe(false);
    await page.screenshot({ path: info.outputPath(`empty-search-${width}.png`) });
  }
  await page.keyboard.press('Escape'); // Ends search, does not close the reader.
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').deckOverlayOpen)).toBe(true);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').deckOverlayOpen)).toBe(false);
  expect(errors).toEqual([]);
});

test('deck browser long names and all toolbar states stay bounded', async ({ page }, info) => {
  await openDeck(page);
  await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    const render = r.routeDeckBrowserModule.renderRouteDeckBrowser;
    r.routeDeckBrowserModule = { ...r.routeDeckBrowserModule, renderRouteDeckBrowser: (scene: any, v: any) => render(scene, {
      ...v, filterLabel: 'PREENED', sortLabel: 'NAME', cards: v.cards.map((c: any, i: number) => ({ ...c,
        name: i % 2 ? 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW' : 'A deliberately long but complete rooftop bird card identity ENDNAME', pinned: i === 0 })),
      savedDecks: { ...v.savedDecks, status: w.toolbarStatus, count: w.toolbarStatus === 'full' ? 6 : 1 },
    }) };
  });
  for (const status of ['idle', 'saved', 'full', 'failed', 'loading']) {
    await page.evaluate(status => { const w = window as any; w.toolbarStatus = status; w.__birdSquadGame.scene.getScene('RouteScene').renderAll(); }, status);
    for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
      await page.setViewportSize({ width, height }); await settleCanvas(page);
      const l = await layout(page); checkLayout(l);
      const names = l.texts.filter(t => t.name === 'deck-review-row-title');
      expect(names.every(t => t.truncated && t.text.endsWith('…') && !!t.full)).toBe(true);
      const save = l.labels.find(c => c.name === 'deck-review-save-folio-hit')!;
      const pin = l.labels.find(c => c.name.startsWith('deck-review-compare-hit'))!;
      expect(pin.text.height).toBeLessThanOrEqual(26);
      expect(save.enabled).toBe(!['full', 'loading'].includes(status));
      if (status === 'failed') expect(save.label).toBe('Retry save');
      if (status === 'full') expect(save.label.replace(/\n/g, ' ')).toContain('Folios full 6/6');
      await page.screenshot({ path: info.outputPath(`${status}-${width}.png`) });
    }
  }
});

for (const mode of ['save', 'close', 'restart']) test(`deck browser delayed Folio save ${mode === 'save' ? 'coalesces repeated activation' : `cancels on ${mode}`}`, async ({ page }) => {
  const cancel = mode !== 'save';
  let release!: () => void; const gate = new Promise<void>(resolve => release = resolve);
  await page.route('**/saved-decks-*.js', async route => { await gate; await route.continue(); });
  try {
    await openDeck(page);
    await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      for (let i = 0; i < 5; i++) r.saveCurrentDeckToFolio();
    });
    const l = await layout(page);
    expect(l.labels.find(c => c.name === 'deck-review-save-folio-hit')).toMatchObject({ label: 'Saving…', enabled: false });
    if (mode === 'close') await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.closeDeckOverlay(); r.openDeckOverlay();
    });
    if (mode === 'restart') {
      const token = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), token = r.deckSaveRequestId;
        r.scene.restart({ runState: r.runState, card: r.runState.deck[0].id }); return token;
      });
      await page.waitForFunction(token => (window as any).__birdSquadGame.scene.getScene('RouteScene').deckSaveRequestId > token, token);
    }
    if(cancel) expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').deckSaveTimer===undefined)).toBe(true);
    release();
    await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').savedDeckModule);
    await expect.poll(() => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').savedDeckRecordState().count)).toBe(cancel ? 0 : 1);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').savedDeckRecordState().count)).toBe(cancel ? 0 : 1);
  } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
});

for(const retryWhilePending of [false,true]) test(`stalled Folio save recovers without an implicit late save, pending retry=${retryWhilePending}`,async({page})=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
  await page.route('**/saved-decks-*.js',async route=>{await gate;await route.continue();});
  try{
    await openDeck(page);await tap(page,'deck-review-save-folio-hit');
    await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').deckSaveStatus),{timeout:10000}).toBe('failed');
    expect((await layout(page)).labels.find(c=>c.name==='deck-review-save-folio-hit')).toMatchObject({label:'Retry save',enabled:true});
    expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').savedDeckRecordState().count)).toBe(0);
    if(retryWhilePending)await tap(page,'deck-review-save-folio-hit');
    release();
    await page.waitForFunction(()=>!!(window as any).__birdSquadGame.scene.getScene('RouteScene').savedDeckModule);
    await settleCanvas(page);
    expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('RouteScene').savedDeckRecordState().count)).toBe(retryWhilePending?1:0);
    if(!retryWhilePending){
      expect((await layout(page)).labels.find(c=>c.name==='deck-review-save-folio-hit')?.label).toBe('Retry save');
      await tap(page,'deck-review-save-folio-hit');
    }
    expect(await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');return{count:r.savedDeckRecordState().count,clean:r.deckSaveTimer===undefined};})).toEqual({count:1,clean:true});
  }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('deck browser stale controls respect modal ownership and failed storage can retry safely', async ({ page }) => {
  await openDeck(page);
  await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').savedDeckModule);
  const guarded = await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    const names = ['deck-review-close-hit', 'deck-review-filter-hit', 'deck-review-sort-hit', 'deck-review-search-hit', 'deck-review-scroll-down-hit', 'deck-review-save-folio-hit'];
    const hits = names.map(n => r.children.getByName(n));
    const before = JSON.stringify([r.runState, r.deckReviewFilter, r.deckReviewSort, r.deckReviewQuery, r.cardReviewScroll, r.savedDeckRecordState()]);
    for (const owner of ['pauseOverlayOpen', 'settingsOverlayOpen']) {
      r[owner] = true; hits.forEach(h => h.emit('pointerdown')); r[owner] = false;
    }
    const after = JSON.stringify([r.runState, r.deckReviewFilter, r.deckReviewSort, r.deckReviewQuery, r.cardReviewScroll, r.savedDeckRecordState()]);
    return { same: before === after, open: r.deckOverlayOpen };
  });
  expect(guarded).toEqual({ same: true, open: true });
  await page.evaluate(() => {
    const w = window as any; w.originalStorageSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key.startsWith('birdsquad.account')) throw new DOMException('Full', 'QuotaExceededError'); w.originalStorageSet.call(this, key, value); };
  });
  await tap(page, 'deck-review-save-folio-hit');
  expect((await layout(page)).labels.find(c => c.name === 'deck-review-save-folio-hit')?.label).toBe('Retry save');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').savedDeckRecordState().count)).toBe(0);
  await page.evaluate(() => { Storage.prototype.setItem = (window as any).originalStorageSet; });
  await tap(page, 'deck-review-save-folio-hit');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').savedDeckRecordState().count)).toBe(1);
  const capacity = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    for (let i = 0; i < 5; i++) r.saveCurrentDeckToFolio();
    const before = localStorage.getItem('birdsquad.account');
    r.saveCurrentDeckToFolio();
    return { unchanged: before === localStorage.getItem('birdsquad.account'), ...r.savedDeckRecordState() };
  });
  expect(capacity).toMatchObject({ count: 6, status: 'full', unchanged: true });
  expect((await layout(page)).labels.find(c => c.name === 'deck-review-save-folio-hit')?.enabled).toBe(false);
});

for (const failed of [false, true]) test(`deck browser ${failed ? 'failed' : 'delayed'} module has a readable touch exit without resurrecting the reader`, async ({ page }, info) => {
  let release!: () => void; const gate = new Promise<void>(resolve => release = resolve);
  await page.route('**/route-deck-browser-*.js', async route => { if (failed) await route.abort('failed'); else { await gate; await route.continue(); } });
  try {
    await openDeck(page, false);
    if (failed) {
      await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeDeckBrowserFailed);
      await expect(page.getByRole('dialog', { name: 'Download recovery' })).toBeVisible();
      // Native recovery now owns input: a touch cannot close the reader below it.
      await tap(page, 'deck-review-module-close');
      expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').deckOverlayOpen)).toBe(true);
      await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
    }
    for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
      await page.setViewportSize({ width, height }); await settleCanvas(page);
      const ui = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), scale = r.game.canvas.getBoundingClientRect().width / 1280;
        const title = r.children.getByName('deck-review-module-title'), hint = r.children.getByName('deck-review-module-hint'), close = r.children.getByName('deck-review-module-close');
        return { titleSize: parseFloat(title.style.fontSize) * scale, hintSize: parseFloat(hint.style.fontSize) * scale,
          width: close.width * scale, height: close.height * scale,
          separated: title.getBounds().bottom + 8 <= hint.getBounds().top && hint.getBounds().bottom + 8 <= close.getBounds().top };
      });
      expect(ui.titleSize).toBeGreaterThanOrEqual(16); expect(ui.hintSize).toBeGreaterThanOrEqual(14);
      expect(ui.width).toBeGreaterThanOrEqual(44); expect(ui.height).toBeGreaterThanOrEqual(44); expect(ui.separated).toBe(true);
      await page.screenshot({ path: info.outputPath(`module-${width}.png`) });
    }
    await tap(page, 'deck-review-module-close');
    release(); await page.unrouteAll({ behavior: 'wait' });
    if (!failed) await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').routeDeckBrowserModule);
    await settleCanvas(page);
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').deckOverlayOpen)).toBe(false);
    expect(await page.evaluate(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('deck-review-curtain'))).toBe(false);
    if (failed) {
      const saved = await page.evaluate(() => localStorage.getItem('birdsquad.run.active'));
      // Exercise the global recovery flow again after explicitly keeping play open.
      await page.evaluate(() => dispatchEvent(new Event('vite:preloadError')));
      await page.getByRole('button', { name: 'Reload options', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Reload saved checkpoint', exact: true })).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('birdsquad.run.active'))).toBe(saved);
      await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Reload saved checkpoint', exact: true }).click()]);
      await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
      expect(await page.evaluate(() => localStorage.getItem('birdsquad.run.active'))).toBe(saved);
      await page.evaluate(async () => {
        const w = window as any; await w.__birdSquadEnsureScene('RouteScene');
        w.__birdSquadGame.scene.stop('MenuScene'); w.__birdSquadGame.scene.start('RouteScene');
      });
      await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).assetReadiness?.fullArt);
    }
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').openDeckOverlay());
    await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('deck-review-detail-panel'));
  } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
});
