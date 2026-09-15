import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

for (const mode of ['preen', 'release']) test(`${mode} confirmation is readable and commits the armed purchase exactly once`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('RouteScene');
  });
  await page.waitForFunction(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.routeEssentialAssetsReady && r.cardHoverDetailModule;
  });
  const before = await page.evaluate(mode => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    r.runState.scrap = 999;
    r.openMarketNode({ ...w.__birdSquadCurrentMap().nodes.find((n: any) => n.type !== 'boss'), type: 'market' });
    const slot = r.marketUtilityShelf.findIndex((o: any) => o.id === mode);
    r.openMarketCardPicker(slot, mode);
    const entry = r.pickerEligibleCards(mode)[0];
    r.requestCardPick(entry.index);
    return { deck: structuredClone(r.runState.deck), scrap: r.runState.scrap, index: entry.index, cost: entry.cost, slot };
  }, mode);
  const snapshot = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return { deck: r.runState.deck, scrap: r.runState.scrap, armed: r.cardPickerArmedIndex };
  });
  const armed = await snapshot();
  const hover = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const hits = r.children.list.filter((o: any) => o.name === 'card-picker-card-hit');
    hits[1].emit('pointerover');
    const rings = r.children.list.filter((o: any) => o.name === 'card-picker-input-focus-ring');
    return { count: rings.length, bounds: rings[0].getBounds(), expected: hits[1].getBounds(), armed: r.cardPickerArmedIndex };
  });
  expect(hover.count).toBe(1); expect(hover.bounds).toEqual(hover.expected); expect(hover.armed).toBe(before.index);
  const click = async () => {
    const p = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      const b = r.children.getByName('card-picker-confirmation-command-frame').getBounds(), c = r.game.canvas.getBoundingClientRect();
      return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
    });
    await page.mouse.move(p.x, p.y); await settleCanvas(page);
    await page.mouse.click(p.x, p.y, { delay: 40 });
  };
  for (const long of [false, true]) {
    if (long) await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      r.__pickerOriginal = r.pickerEligibleCards;
      r.pickerEligibleCards = function (...args: any[]) {
        return this.__pickerOriginal(...args).map((e: any) => ({ ...e, name: 'An extraordinarily long card name '.repeat(12) }));
      };
      r.renderAll();
    });
    for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(size); await settleCanvas(page);
      const metrics = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
        const rail = r.children.getByName('card-picker-confirmation-rail').getBounds();
        const button = r.children.getByName('card-picker-confirmation-command-frame'), bb = button.getBounds();
        const labels = ['title', 'summary'].map(suffix => r.children.getByName(`card-picker-confirmation-${suffix}`));
        const names = r.children.list.filter((o: any) => o.name === 'card-picker-card-name');
        const plates = r.children.list.filter((o: any) => o.name === 'card-picker-choice-plate');
        return {
          cards: names.map((o: any, index: number) => {
            const b = o.getBounds(), p = plates[index].getBounds();
            return { text: o.text, font: o.style.fontSize, truncated: o.getData('truncated'),
              contained: b.left >= p.left + 6 && b.right <= p.right - 6 && b.top >= p.top && b.bottom <= p.bottom - 6 };
          }),
          tinyDeltas: r.children.list.filter((o: any) => o.name === 'card-picker-decision-delta').length,
          labels: labels.map((o: any) => ({ text: o.text, font: Number.parseFloat(o.style.fontSize), full: o.getData('fullText'),
            inside: o.getBounds().left >= rail.left + 16 && o.getBounds().right <= bb.left - 8
              && o.getBounds().top >= rail.top && o.getBounds().bottom <= rail.bottom })),
          separated: labels[0].getBounds().bottom + 2 <= labels[1].getBounds().top,
          buttonSize: button.height * r.game.canvas.getBoundingClientRect().height / 720,
          gridGap: rail.top - Math.max(...r.children.list.filter((o: any) => o.name === 'card-picker-card-hit').map((o: any) => o.getBounds().bottom)),
          inspect: ['label', 'binding'].map(suffix => {
            const o = r.children.getByName(`card-picker-card-inspect-${suffix}`), b = o.getBounds(), h = r.children.getByName('card-picker-card-inspect-hit').getBounds();
            return { font: Number.parseFloat(o.style.fontSize), inside: b.left >= h.left + 8 && b.right <= h.right - 8 && b.top >= h.top + 4 && b.bottom <= h.bottom - 4 };
          }),
        };
      });
      metrics.labels.forEach(o => { expect(o.font).toBeGreaterThanOrEqual(16); expect(o.inside, JSON.stringify(o)).toBe(true); });
      expect(metrics.cards).toHaveLength(10); expect(metrics.tinyDeltas).toBe(0);
      metrics.cards.forEach(o => { expect(o.font).toBe('18px'); expect(o.contained, o.text).toBe(true); if (long) expect(o.truncated).toBe(true); });
      expect(metrics.separated).toBe(true); expect(metrics.buttonSize).toBeGreaterThanOrEqual(44); expect(metrics.gridGap).toBeGreaterThanOrEqual(8);
      metrics.inspect.forEach(o => { expect(o.font).toBeGreaterThanOrEqual(16); expect(o.inside).toBe(true); });
      if (long) expect(metrics.labels[0].text).toMatch(/…$/);
      await page.screenshot({ path: info.outputPath(`${long ? 'long' : 'normal'}-${size.width}.png`) });
      expect(await snapshot()).toEqual(armed);
    }
  }
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.pickerEligibleCards = r.__pickerOriginal; delete r.__pickerOriginal; r.renderAll();
    (window as any).__stalePickerConfirm = r.children.getByName('card-picker-confirmation-command-frame').listeners('pointerdown')[0];
  });
  await page.keyboard.press('r');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').cardPickerInspectionOpen);
  await page.evaluate(() => (window as any).__stalePickerConfirm());
  expect(await snapshot()).toEqual(armed);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as any).__stalePickerConfirm());
  expect(await snapshot()).toEqual({ ...armed, armed: undefined });
  await page.evaluate(index => (window as any).__birdSquadGame.scene.getScene('RouteScene').requestCardPick(index), before.index);
  await page.evaluate(() => { (window as any).__birdSquadGame.scene.getScene('RouteScene').runState.scrap = 0; });
  await click();
  expect(await snapshot()).toEqual({ ...armed, scrap: 0 });
  await page.evaluate(scrap => { (window as any).__birdSquadGame.scene.getScene('RouteScene').runState.scrap = scrap; }, before.scrap);
  await click();
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').cardPickerMode);
  const after = await snapshot();
  const expectedDeck = structuredClone(before.deck);
  if (mode === 'preen') expectedDeck[before.index].upgraded = true;
  else expectedDeck.splice(before.index, 1);
  expect(after.deck).toEqual(expectedDeck); expect(after.scrap).toBe(before.scrap - before.cost);
  expect(await page.evaluate(slot => (window as any).__birdSquadGame.scene.getScene('RouteScene').marketUtilityShelf[slot].sold, before.slot)).toBe(true);
  expect(errors).toEqual([]);
});
