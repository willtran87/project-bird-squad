import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test.use({ hasTouch: true });
async function boot(page: Page) {
  await page.setViewportSize({ width: 2560, height: 1600 }); await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('CodexScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('CodexScene').codexData));
}
async function decorate(page: Page) {
  await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'), ids = c.allCards().map((x: any) => x.id);
    c.discovered = new Set(ids); c.favoriteCards = new Set(ids); c.collectionTargets = new Set(ids); c.newlyAcquiredCards = new Set(ids);
    c.cardTags = Object.fromEntries(ids.map((id: string) => [id, 'experiment']));
    c.cardCollection = Object.fromEntries(ids.map((id: string) => [id, { quantity: 1 }]));
    c.cardFolioUsage = Object.fromEntries(ids.map((id: string) => [id, { active: 2, total: 3, archived: 1 }]));
    c.renderAll();
  });
}

test('all card gallery titles and collection markers fit outside the complete artwork', async ({ page }) => {
  await boot(page); await decorate(page);
  const result = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const issues: string[] = []; let count = 0;
    for (const card of c.allCards()) {
      c.root.removeAll(true); c.renderThumb(c.root, card, 640, 360);
      const tile = c.root.getByName('codex-card-tile'), b = tile.getByName('codex-card-entry-hit').getBounds();
      const artBox = { left: 548, right: 732, top: b.top + 88, bottom: b.top + 364 };
      const texts = tile.list.filter((n: any) => n.type === 'Text' && !['codex-card-art-placeholder', 'codex-card-art-streaming-label'].includes(n.name));
      for (const n of texts) {
        const a = n.getBounds();
        if (a.left < b.left + 6 || a.right > b.right - 6 || a.top < b.top + 6 || a.bottom > b.bottom - 6) issues.push(`${card.id}: outside tile`);
        if (n.style.resolution !== 2) issues.push(`${card.id}: low-res text`);
        if (a.left < artBox.right && a.right > artBox.left && a.top < artBox.bottom && a.bottom > artBox.top) issues.push(`${card.id}: art obscured`);
        for (const other of texts) {
          if (other === n) continue;
          const d = other.getBounds();
          if (a.left < d.right && a.right > d.left && a.top < d.bottom && a.bottom > d.top) issues.push(`${card.id}: overlapping labels`);
        }
      }
      for (const name of ['codex-card-ownership-marker', 'codex-card-folio-marker', 'codex-new-card-marker', 'codex-card-tag-marker', 'codex-favorite-marker', 'codex-hunt-marker']) {
        if (!tile.getByName(name)) issues.push(`${card.id}: missing ${name}`);
      }
      count++;
    }
    c.discovered.clear();
    for (const card of c.allCards()) {
      c.root.removeAll(true); c.renderThumb(c.root, card, 640, 360);
      const tile = c.root.getByName('codex-card-tile');
      if (tile.getByName('codex-card-title').text !== 'Undiscovered' || tile.getByName('codex-card-cost-label')
        || tile.getByName('codex-card-ownership-marker') || tile.getByName('codex-card-art')) issues.push('undiscovered information leak');
    }
    return { count, issues };
  });
  expect(result.count).toBe(110); expect(result.issues).toEqual([]);
});

test('card gallery loads every illustration and keeps full cards clear of collection controls', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page); await decorate(page);
  const seen = new Set<string>();
  for (let tab = 0; tab < 7; tab++) {
    const count = await page.evaluate(tab => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      c.activeTab = tab; c.entryFocusIndex = 0; c.gridScroll = c.gridScrollTarget = 0; c.renderAll();
      return c.currentCodexCards().length;
    }, tab);
    for (let index = 0; index < count; index += 5) {
      await page.evaluate(index => {
        const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'); c.entryFocusIndex = index;
        c.ensureFocusedEntryVisible(); c.gridScroll = c.gridScrollTarget; c.renderAll();
      }, index);
      await page.waitForFunction(() => {
        const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'), shape = c.codexGridShape();
        const tiles = c.gridLayer.list.filter((n: any) => n.name === 'codex-card-tile' && n.getByName('codex-card-entry-hit').getBounds().bottom > shape.top
          && n.getByName('codex-card-entry-hit').getBounds().top < shape.bottom);
        return tiles.length && tiles.every((t: any) => t.getByName('codex-card-art'));
      });
      const result = await page.evaluate(() => {
        const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'), shape = c.codexGridShape();
        const entry = c.codexFocusEntries()[c.entryFocusIndex], tile = c.gridLayer.list.find((n: any) => n.getData('cardId') === entry.id);
        const b = tile.getByName('codex-card-entry-hit').getBounds(), f = c.entryFocusGeometry();
        return { ids: c.gridLayer.list.filter((n: any) => n.getByName('codex-card-art')).map((n: any) => n.getData('cardId')),
          top: b.top, bottom: b.bottom, shape, dx: Math.abs(b.centerX - f.x), dy: Math.abs(b.centerY - f.y),
          ratios: c.gridLayer.list.filter((n: any) => n.getByName('codex-card-art')).map((n: any) => {
            const a = n.getByName('codex-card-art'); return a.displayWidth / a.displayHeight;
          }) };
      });
      result.ids.forEach((id: string) => seen.add(id));
      expect(result.top).toBeGreaterThanOrEqual(result.shape.top); expect(result.bottom).toBeLessThanOrEqual(result.shape.bottom);
      expect(result.dx).toBeLessThan(1); expect(result.dy).toBeLessThan(1);
      result.ratios.forEach((ratio: number) => expect(ratio).toBeCloseTo(2 / 3));
      if (index === 0 && [0, 2, 6].includes(tab)) for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
        await page.setViewportSize(size); await settleCanvas(page);
        await page.screenshot({ path: info.outputPath(`gallery-${tab}-${size.width}.png`) });
      }
    }
  }
  expect(seen.size).toBe(110); expect(errors).toEqual([]);
});

test('card gallery title and artwork open details without changing collection or return position', async ({ page }) => {
  await boot(page); await decorate(page); await page.setViewportSize({ width: 1000, height: 560 });
  for (const target of ['codex-card-title', 'codex-card-art']) {
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').gridLayer.list[0].getByName('codex-card-art'));
    const point = await page.evaluate(target => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'), tile = c.gridLayer.list[0];
      const a = tile.getByName(target).getBounds(), b = document.querySelector('canvas')!.getBoundingClientRect();
      return { id: tile.getData('cardId'), x: b.x + a.centerX * b.width / 1280, y: b.y + a.centerY * b.height / 720,
        scroll: c.gridScroll, saved: JSON.stringify(localStorage) };
    }, target);
    if (target === 'codex-card-title') await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await page.waitForFunction(id => JSON.parse((window as any).render_game_to_text()).detailOpen === id, point.id);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !JSON.parse((window as any).render_game_to_text()).detailOpen);
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(point.saved);
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').gridScroll)).toBe(point.scroll);
  }
});
