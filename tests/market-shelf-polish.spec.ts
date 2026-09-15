import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const marks = JSON.parse(readFileSync(new URL('../data/game/alpha-route-marks.json', import.meta.url), 'utf8'));
const supplies = JSON.parse(readFileSync(new URL('../data/game/alpha-supplies.json', import.meta.url), 'utf8'));

test('Market merchandise separates identity price and art with complete readable rules', async ({ page }, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('RouteScene', {});
  });
  await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').cardHoverDetailModule);
  await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'market') ?? w.__birdSquadCurrentMap().nodes.find((n: any) => n.type !== 'boss');
    node.type = 'market'; r.runState.scrap = 999; r.openMarketNode(node);
  });
  for (const category of ['waymarks', 'supplies']) {
    await page.evaluate(c => (window as any).__birdSquadGame.scene.getScene('RouteScene').setMarketCategory(c), category);
    await page.waitForFunction(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      return r.children.list.filter((o: any) => o.name === 'market-merchandise-art').length === 3;
    });
    for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(viewport);
      const geometry = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
        const find = (name: string) => r.children.list.filter((o: any) => o.name === `market-merchandise-${name}`);
        const frames = find('frame'), titles = find('title'), prices = find('price'), art = find('art'), hits = find('hit');
        return {
          count: frames.length,
          text: titles.every((t: any, i: number) => {
            const b = t.getBounds(), f = frames[i].getBounds(), p = prices[i].getBounds();
            return b.left >= f.left + 16 && b.right <= f.right - 16 && b.top >= art[i].getBounds().bottom + 16 && b.bottom <= p.top - 12 && p.bottom <= f.bottom - 8 && t.style.fontSize === '18px' && t.style.resolution === 2;
          }),
          separated: frames.every((f: any, i: number) => f.getBounds().left >= 528 && f.getBounds().right <= 1136 && (!i || f.getBounds().left >= frames[i - 1].getBounds().right + 10)),
          touch: hits.every((h: any) => h.width === 184 && h.height === 256),
          art: art.map((a: any) => a.texture.key),
        };
      });
      expect(geometry.count).toBe(3); expect(geometry.text).toBe(true); expect(geometry.separated).toBe(true); expect(geometry.touch).toBe(true);
      expect(new Set(geometry.art).size).toBe(3);
      await page.screenshot({ path: info.outputPath(`${category}-${viewport.width}.png`) });
    }
  }
  const reading = await page.evaluate(({ marks, supplies }) => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), original = r.showMarketItemDetail;
    let captured: any;
    r.showMarketItemDetail = (view: any) => { captured = view; };
    try {
      return {
        marks: marks.map((mark: any) => { r.showMarketWaymarkDetail(mark, 1, 0, 0); return { id: mark.id, trigger: mark.trigger, effects: mark.effects ?? [mark.effect], meta: captured.meta }; }),
        supplies: supplies.map((s: any) => { r.showMarketUtilityDetail({ id: 'supply', supplyId: s.id, price: 1 }, 0, 0); return { id: s.id, meta: captured.meta }; }),
      };
    } finally { r.showMarketItemDetail = original; }
  }, { marks: marks.routeMarks, supplies: supplies.supplies });
  for (const row of [...reading.marks, ...reading.supplies]) expect(row.meta, row.id).not.toMatch(/\w+\([^)]*\)/);
  for (const row of reading.marks) {
    if (/onNthCardThisTurn|onLowCardTurn|onEnterMolt|onResonanceSpent/.test(row.trigger)) expect(row.meta, row.id).toContain('each combat');
    if (row.trigger === 'onLowCardTurn(2)') expect(row.meta).toContain('1–2 cards');
    if (row.trigger === 'onSupplyUsed') expect(row.meta).toContain(row.effects.some((e: string) => e.startsWith('repeatNextSupply(')) ? 'Whenever a Supply is used' : 'First Supply used each combat');
    if (/onSuitPlayed|onEnemyCoverBroken|onHealFlock/.test(row.trigger)) expect(row.meta, row.id).toContain('each turn');
  }
  const names = [...marks.routeMarks, ...supplies.supplies].map((item: { name: string }) => item.name);
  names.push('An exceptionally long merchandise name '.repeat(10), 'W'.repeat(100));
  const namesFit = await page.evaluate(names => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return names.every(title => {
      const before = new Set(r.children.list);
      r.cardHoverDetailModule.renderMarketMerchandise(r, { index: 0, title, price: 999, enabled: true, accent: 0xe5bd79, kind: 'waymark', focusId: 'test', onInspect() {} });
      const added = r.children.list.filter((o: any) => !before.has(o));
      const label = added.find((o: any) => o.name === 'market-merchandise-title'), price = added.find((o: any) => o.name === 'market-merchandise-price');
      const ok = label.width <= 152 && label.getBounds().bottom <= price.getBounds().top - 12 && label.getData('fullTitle') === title && (label.text.replace(/\s/g, '') === title.replace(/\s/g, '') || label.text.endsWith('…'));
      added.forEach((o: any) => o.destroy()); return ok;
    });
  }, names);
  expect(namesFit).toBe(true);
  await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.marketUtilityShelf.filter((o: any) => o.id === 'supply')[0].sold = true; r.renderAll(); });
  expect(await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return { hits: r.children.list.filter((o: any) => o.name === 'market-merchandise-hit').length, sold: r.children.list.some((o: any) => o.name === 'market-merchandise-price' && o.text === 'Sold') };
  })).toEqual({ hits: 2, sold: true });
  await page.screenshot({ path: info.outputPath('sold-1000.png') });
  expect(errors).toEqual([]);
});
