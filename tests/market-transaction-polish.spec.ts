import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { installVirtualController, pressController } from './helpers/virtual-controller';

test.use({ hasTouch: true });

async function boot(page: Page) {
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('RouteScene');
    w.__birdSquadGame.scene.stop('MenuScene'); w.__birdSquadGame.scene.start('RouteScene');
  });
  await page.waitForFunction(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.cardHoverDetailModule && JSON.parse((window as any).render_game_to_text()).assetReadiness?.fullArt;
  });
  await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    const nodes = w.__birdSquadCurrentMap().nodes;
    const node = nodes.find((n: any) => n.type === 'market') ?? nodes.find((n: any) => n.type !== 'boss');
    node.type = 'market'; // Fixture must not depend on procedural stock of node types.
    r.runState.scrap = 999; r.openMarketNode(node);
  });
  await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('market-purchase-action'));
}
async function click(page: Page, name: string, touch = false) {
  const p = await page.evaluate(name => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const all = (list: any[]): any[] => list.flatMap(o => [o, ...(o.list ? all(o.list) : [])]);
    const o = all(r.children.list).find(o => o.name === name || o.getData?.('marketFocusId') === name);
    const b = o.getBounds(), c = r.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, name);
  if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
  await settleCanvas(page);
}
const state = (page: Page) => page.evaluate(() => {
  const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
  return { run: JSON.stringify(r.runState), scrap: r.runState.scrap, deck: r.runState.deck.length,
    armed: r.marketFocusArmedId, focus: r.marketFocusId, category: r.marketCategory,
    title: r.children.getByName('market-transaction-title')?.text,
    summary: r.children.getByName('market-input-help-text')?.text,
    action: r.children.getByName('market-purchase-label')?.text,
    picker: r.cardPickerMode, preview: r.marketDecisionPreview, pending: r.routeCommitPending };
});

test('Market transaction hierarchy stays readable across categories, compact views and blockers', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page);
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size); await settleCanvas(page);
    for (const category of ['cards', 'waymarks', 'supplies', 'services']) {
      await page.evaluate(category => (window as any).__birdSquadGame.scene.getScene('RouteScene').setMarketCategory(category), category);
      await settleCanvas(page);
      const geometry = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
        const reader = r.hoverCardDetail?.getByName('market-fixed-card-inspector') ?? r.marketItemHover;
        const all = [r.children.getByName('market-transaction-title'), r.children.getByName('market-input-help-text'), r.children.getByName('market-purchase-label'), r.children.getByName('market-purchase-hint'), ...reader.list.filter((o: any) => o.type === 'Text')];
        const scale = r.game.canvas.getBoundingClientRect().height / 720;
        const small = all.filter((o: any) => parseFloat(o.style.fontSize) * scale < 14).map((o: any) => o.text);
        const overlaps = all.flatMap((a: any, i: number) => all.slice(i + 1).filter((b: any) => {
          const x = a.getBounds(), y = b.getBounds();
          return x.left < y.right && y.left < x.right && x.top < y.bottom && y.top < x.bottom;
        }).map((b: any) => [a.text, b.text]));
        return { small, overlaps, offstage: all.filter((o: any) => o.getBounds().bottom > 720).map((o: any) => o.text),
          controlsClear: reader.list.filter((o: any) => o.type === 'Text').every((label: any) => {
            const a = label.getBounds();
            return reader.list.filter((o: any) => o.type === 'Rectangle' && o.input && o.height === 58).every((button: any) => {
              const b = button.getBounds();
              const inside = a.left >= b.left && a.right <= b.right && a.top >= b.top && a.bottom <= b.bottom;
              const outside = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
              return inside || outside;
            });
          }),
          target: r.children.getByName('market-purchase-action').height * scale };
      });
      expect(geometry.small).toEqual([]); expect(geometry.overlaps).toEqual([]); expect(geometry.offstage).toEqual([]);
      expect(geometry.target).toBeGreaterThanOrEqual(44);
      expect(geometry.controlsClear).toBe(true);
      expect((await state(page)).title).toContain('Inspecting');
      await page.screenshot({ path: info.outputPath(`${category}-${size.width}.png`) });
    }
  }
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.runState.scrap = 0; r.setMarketCategory('cards'); r.renderAll();
  });
  const before = await state(page);
  expect(before.title).toContain('Unavailable'); expect(before.summary).toMatch(/NEED \d+ MORE SCRAP/);
  await click(page, 'market-purchase-action', true);
  expect((await state(page)).run).toBe(before.run); expect((await state(page)).armed).toBeUndefined();
  await page.screenshot({ path: info.outputPath('unaffordable-1000.png') });
  expect(errors).toEqual([]);
});

test('Market primary action selects before buying, preserves services and blocks background input', async ({ page }) => {
  test.setTimeout(90000);
  await installVirtualController(page); await boot(page);
  const before = await state(page);
  const price = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').marketCardShelf[0].price);
  await click(page, 'market-purchase-action');
  expect((await state(page)).run).toBe(before.run); expect((await state(page)).title).toContain('Selected');
  expect((await state(page)).action).toBe('Buy');
  await page.keyboard.press('p'); await settleCanvas(page);
  await click(page, 'market-purchase-action');
  expect((await state(page)).run).toBe(before.run);
  await page.keyboard.press('p'); await settleCanvas(page);
  await page.keyboard.press('Escape'); await settleCanvas(page);
  expect((await state(page)).armed).toBeUndefined(); expect((await state(page)).run).toBe(before.run);
  await click(page, 'card:0', true); await click(page, 'market-purchase-action', true);
  expect((await state(page)).scrap).toBe(before.scrap - price); expect((await state(page)).deck).toBe(before.deck + 1);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').marketCardShelf[0].sold)).toBe(true);
  const after = await state(page);
  await click(page, 'market-purchase-action'); // Next item must be selected, not immediately bought.
  expect((await state(page)).run).toBe(after.run);
  await pressController(page, 1); // Clear selection.
  await page.keyboard.press('4'); await settleCanvas(page);
  expect((await state(page)).category).toBe('services');
  await click(page, 'market-purchase-action'); expect((await state(page)).action).toBe('Choose card');
  await click(page, 'market-purchase-action'); expect((await state(page)).picker).toBe('preen');
  expect((await state(page)).scrap).toBe(after.scrap);
  await page.keyboard.press('Escape'); await settleCanvas(page);
  expect((await state(page)).picker).toBeUndefined(); expect((await state(page)).pending).toBe(false);
});

test('Market exposes pouch and eligibility blockers and controller purchases exactly once', async ({ page }, info) => {
  test.setTimeout(90000);
  await installVirtualController(page);
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await page.setViewportSize({ width: 1000, height: 560 });
  await boot(page);
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const id = r.marketUtilityShelf.find((o: any) => o.supplyId).supplyId;
    r.runState.supplies = Array(12).fill(id); r.setMarketCategory('supplies');
  });
  const full = await state(page);
  expect(full.summary).toContain('SUPPLY POUCH FULL'); expect(full.action).toBe('Unavailable');
  await pressController(page, 0); await click(page, 'market-purchase-action', true);
  expect((await state(page)).run).toBe(full.run);
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('SUPPLY POUCH FULL');
  await page.screenshot({ path: info.outputPath('full-pouch.png') });
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.runState.supplies = []; r.runState.deck.forEach((c: any) => { c.upgraded = true; });
    r.setMarketCategory('services');
  });
  const ineligible = await state(page);
  expect(ineligible.summary).toContain('NO ELIGIBLE CARD'); expect(ineligible.action).toBe('Unavailable');
  await pressController(page, 0); expect((await state(page)).run).toBe(ineligible.run);
  await page.screenshot({ path: info.outputPath('no-eligible-card.png') });
  // Procedural stock may include Ledger Tab, whose purchase immediately rebates
  // 12 Scrap. Exercise that authored transaction deterministically, exactly once.
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.runState.routeMarks = [];
    r.marketWaymarkShelf[0].id = 'ledger_tab';
  });
  await page.keyboard.press('2'); await settleCanvas(page);
  const before = await state(page);
  const price = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').marketWaymarkShelf[0].price);
  await pressController(page, 0);
  expect((await state(page)).scrap).toBe(before.scrap - price + 12);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState.routeMarks)).toEqual(['ledger_tab']);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').marketWaymarkShelf[0].sold)).toBe(true);
  expect((await state(page)).pending).toBe(false);
  await page.screenshot({ path: info.outputPath('sold-waymark.png') });
});
