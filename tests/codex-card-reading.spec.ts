import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test.use({ hasTouch: true });
async function boot(page: Page) {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.addInitScript(() => {
    const ids = ['major_00', 'major_01', 'wands_ace'];
    const raw = JSON.stringify({ discoveredCards: ids, cardCollection: {
      major_00: { timesClaimed: 1, firstAcquiredAt: 10, firstSource: 'starter_flock', isNew: false },
    } });
    localStorage.setItem('birdsquad.account', raw); localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('CodexScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('CodexScene').codexData));
}
async function tap(page: Page, name: string) {
  await settleCanvas(page);
  const p = await page.evaluate(name => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const n = c.root.getByName(name), b = n.getBounds(), canvas = document.querySelector('canvas')!.getBoundingClientRect();
    return { x: canvas.x + b.centerX * canvas.width / 1280, y: canvas.y + b.centerY * canvas.height / 720,
      height: b.height * canvas.height / 720 };
  }, name);
  expect(p.height).toBeGreaterThanOrEqual(44); await page.touchscreen.tap(p.x, p.y); await settleCanvas(page);
}

test('card reader keeps every authored entry readable with separated controls in all collection states', async ({ page }, info) => {
  const pageErrors: string[] = []; page.on('pageerror', e => pageErrors.push(e.message));
  await boot(page);
  const result = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const errors: string[] = []; let count = 0;
    const check = (id: string) => {
      const nodes = c.root.list;
      const hits = nodes.filter((n: any) => n.name?.match(/^codex-card-(favorite|tag|showcase|flight-deck|mark-seen|protect|target)-hit$/));
      const intersects = (a: any, b: any) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      for (const h of hits) {
        const b = h.getBounds();
        for (const other of hits) if (other !== h && intersects(b, other.getBounds())) errors.push(`${id}: overlapping actions`);
        if (h.height < 58 || b.left < 40 || b.right > 1240 || b.top < 24 || b.bottom > 696) errors.push(`${id}: action bounds`);
        for (const suffix of ['label', 'hint']) {
          const t = c.root.getByName(h.name.replace(/hit$/, suffix));
          if (!t) continue;
          const a = t.getBounds();
          if (a.left < b.left + 6 || a.right > b.right - 6 || a.top < b.top || a.bottom > b.bottom
            || t.style.resolution !== 2 || parseInt(t.style.fontSize) < (suffix === 'label' ? 18 : 14)) errors.push(`${id}: ${t.name}`);
        }
      }
      const flightHit = c.root.getByName('codex-card-flight-deck-hit');
      if (flightHit && intersects(flightHit.getBounds(), c.root.getByName('codex-detail-close-hit').getBounds())) errors.push('flight/close overlap');
      for (const n of nodes.filter((n: any) => n.name?.startsWith('codex-card-detail-') && n.type === 'Text')) {
        if (n.style.maxLines || n.getBounds().right > 1208 || n.style.resolution !== 2) errors.push(`${id}: truncated reader`);
        if (n.name === 'codex-card-detail-paragraph' && parseInt(n.style.fontSize) < 18) errors.push(`${id}: tiny body`);
      }
      const art = c.root.getByName('codex-card-detail-art') ?? c.root.getByName('codex-card-detail-art-pending');
      const a = art.getBounds();
      if (a.left !== 64 || a.right !== 384 || a.top !== 104 || a.bottom !== 584) errors.push(`${id}: cropped artwork`);
      for (const n of nodes.slice(nodes.indexOf(art) + 1).filter((n: any) => n.type === 'Rectangle' && n.fillAlpha > 0.5)) {
        const b = n.getBounds();
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) errors.push(`${id}: art covered`);
      }
      const paragraphs = nodes.filter((n: any) => n.name === 'codex-card-detail-paragraph');
      if (paragraphs.at(-1).getBounds().bottom - c.detailMaxScroll > 568) errors.push(`${id}: unreachable ending`);
    };
    for (const card of c.allCards()) {
      c.detailId = card.id; c.detailScroll = c.detailScrollTarget = 0;
      c.root.removeAll(true); c.renderDetail(card.id); check(card.id); count++;
    }
    const id = 'major_00';
    for (const state of ['new', 'protected', 'tagged', 'showcased', 'full', 'tracked', 'flight']) {
      c.newlyAcquiredCards = new Set(state === 'new' ? [id] : []);
      c.lockedCards = new Set(state === 'protected' ? [id] : []);
      c.favoriteCards = new Set([id]); c.cardTags[id] = state === 'tagged' ? 'experiment' : '';
      c.cardShowcase = state === 'showcased' ? [id] : state === 'full' ? c.allCards().filter((x: any) => x.id !== id).slice(0, 6).map((x: any) => x.id) : [];
      c.collectionTargets = new Set(state === 'tracked' ? [id] : state === 'full' ? ['a', 'b', 'c'] : []);
      c.cardCollection = ['tracked', 'full'].includes(state) ? {} : { [id]: { timesClaimed: 1, firstSource: 'starter_flock' } };
      c.activeFlightCardUsage = state === 'flight' ? { cards: { [id]: 'preened' } } : undefined;
      c.returnScene = 'RouteScene'; c.detailId = id; c.root.removeAll(true); c.renderDetail(id); check(state);
    }
    c.activeFlightCardUsage = undefined; c.detailId = undefined; c.renderAll();
    return { count, errors };
  });
  expect(result.count).toBe(110); expect(result.errors).toEqual([]);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').openCodexDetail('major_00'));
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('CodexScene').root.getByName('codex-card-detail-art')));
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`card-reader-${size.width}.png`) });
  }
  expect(pageErrors).toEqual([]);
});

test('card reader pages full notes using touch keyboard and wheel and returns without changing the collection', async ({ page }, info) => {
  await boot(page); await page.setViewportSize({ width: 1000, height: 560 });
  const saved = await page.evaluate(() => localStorage.getItem('birdsquad.account'));
  const before = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    c.cardJournal.major_00 = 'A complete private note stays readable. '.repeat(12) + 'FINAL PRIVATE NOTE.';
    c.focusZone = 'entries'; c.entryFocusIndex = 0; c.renderAll();
    const before = { scroll: c.gridScroll, index: c.entryFocusIndex, tab: c.activeTab };
    c.openCodexDetail('major_00'); return before;
  });
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').detailScroll > 0);
  await page.mouse.move(600, 320); await page.mouse.wheel(0, 200); await settleCanvas(page);
  await tap(page, 'codex-card-scroll-back');
  let reachedEnd = false;
  for (let i = 0; i < 30; i++) {
    reachedEnd = await page.evaluate(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'); return c.detailScroll >= c.detailMaxScroll - 1;
    });
    if (reachedEnd) break;
    await tap(page, 'codex-card-scroll-more');
  }
  expect(reachedEnd).toBe(true);
  expect(await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    return c.root.getByName('codex-card-journal-note').text.endsWith('FINAL PRIVATE NOTE.')
      && c.root.getByName('codex-card-detail-reading-status').text === 'End of entry'
      && !c.root.getByName('codex-card-scroll-more').input?.enabled;
  })).toBe(true);
  await page.screenshot({ path: info.outputPath('card-reader-end-1000.png') });
  await tap(page, 'codex-detail-close-hit');
  expect(await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    return { scroll: c.gridScroll, index: c.entryFocusIndex, tab: c.activeTab };
  })).toEqual(before);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(saved);
});

test('card reader collection actions remain independent touch targets at compact size', async ({ page }) => {
  await boot(page); await page.setViewportSize({ width: 1000, height: 560 });
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').openCodexDetail('major_00'));
  for (const name of ['favorite', 'protect', 'tag', 'showcase']) await tap(page, `codex-card-${name}-hit`);
  const result = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    return { favorite: c.favoriteCards.has('major_00'), protected: c.lockedCards.has('major_00'),
      tag: c.cardTags.major_00, showcased: c.cardShowcase.includes('major_00'), detail: c.detailId };
  });
  expect(result).toMatchObject({ favorite: true, protected: true, showcased: true, detail: 'major_00' });
  expect(result.tag).toBeTruthy();
});
