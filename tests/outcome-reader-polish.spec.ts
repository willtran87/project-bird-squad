import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const marks = JSON.parse(readFileSync(new URL('../data/game/alpha-route-marks.json', import.meta.url), 'utf8')).routeMarks;

for (const kind of ['supply', 'waymark']) for (const remapped of [false, true]) test(`${kind} outcome reader preserves the transaction, remapped=${remapped}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  if (remapped) await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { roost: 'KeyJ', next: 'KeyE', previous: 'KeyQ', back: 'KeyB' } })));
  const keys = remapped ? { inspect: 'j', next: 'e', back: 'b' } : { inspect: 'r', next: 'ArrowRight', back: 'Escape' };
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('RouteScene', {});
  });
  await page.waitForFunction(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return r.routeEssentialAssetsReady && r.cardHoverDetailModule; });
  const open = () => page.evaluate(kind => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'cache');
    r.openNodeChoices(node);
    if (kind === 'waymark') r.chooseNodeOption('cache_mark');
    else r.openRouteRewardMenu(node, { key: 'single-supply-fixture', text: 'Seed offering.', effects: ['gainSupply(seed_packet)', 'loseCohesion(2)'] }, structuredClone(r.runState));
  }, kind);
  await open();
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-outcome-inspect-hit'));
  const state = () => page.evaluate(() => JSON.parse((window as any).render_game_to_text()).routeReward);
  const reading = async () => (await state())?.itemInspection?.reading ?? null;
  const stable = () => page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return JSON.stringify({ run: r.runState, pending: r.pendingRouteReward, armed: r.routeSupplyRewardArmedId, focus: r.routeSupplyRewardChoiceIndex }); });
  const settle = async () => { const f = await page.evaluate(() => (window as any).__birdSquadGame.loop.frame); await page.waitForFunction(f => (window as any).__birdSquadGame.loop.frame >= f + 2, f); };
  const press = async (key: string) => { await page.keyboard.press(key); await settle(); };
  const click = async (name: string) => {
    await page.waitForFunction(() => { const b = document.querySelector('canvas')!.getBoundingClientRect(); return b.width <= innerWidth + 1 && b.height <= innerHeight + 1 && b.left >= -1 && b.top >= -1; });
    await settle();
    const p = await page.evaluate(name => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      const o = r.children.getByName('route-supply-reader')?.getByName(name) ?? r.children.getByName(name), b = o.getBounds(), c = r.game.canvas.getBoundingClientRect();
      return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
    }, name);
    await page.mouse.move(p.x, p.y);
    await page.waitForFunction(name => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return r.input.hitTestPointer(r.input.activePointer).some((o: any) => o.name === name); }, name);
    await page.mouse.click(p.x, p.y, { delay: 40 }); await settle();
  };
  const capture = async (surface: string) => {
    if (remapped) return;
    for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(size);
      await page.waitForFunction(() => { const b = document.querySelector('canvas')!.getBoundingClientRect(); return b.width <= innerWidth + 1 && b.height <= innerHeight + 1 && b.left >= -1 && b.top >= -1; });
      await settle();
      const geometry = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), p = r.children.getByName('route-supply-reader'), scale = r.game.canvas.getBoundingClientRect().height / 720;
        return (p?.list ?? r.children.list).filter((o: any) => /reader-(next|previous|return)$|route-outcome-inspect-hit|route-reward-claim-hit/.test(o.name)).map((o: any) => o.height * scale);
      });
      geometry.forEach((height: number) => expect(height).toBeGreaterThanOrEqual(44));
      await page.screenshot({ path: info.outputPath(`${kind}-${surface}-${size.width}.png`) });
    }
  };
  await capture('outcome');
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Route outcome.');
  const before = await stable();
  const expected = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), p = r.pendingRouteReward;
    return { item: p.previewItem, projected: { supplies: p.projectedState.supplies, marks: p.projectedState.routeMarks, deck: p.projectedState.deck, hp: p.projectedState.currentHp }, cards: (p.previewCards ?? []).map((c: any) => ({ name: c.name, text: c.upgraded ? c.upgradedText : c.text })), effect: p.effectText };
  });
  expect(expected.item.kind).toBe(kind);
  if (kind === 'waymark') expect(expected.cards).toHaveLength(1);
  await click('route-outcome-inspect-hit'); await expect.poll(reading).not.toBeNull();
  await page.mouse.move(5, 5); expect(await stable()).toBe(before);
  await capture('reader');
  const pages: Record<string, string[]> = {};
  for (let i = 0; i < 100; i++) {
    const read = await reading(); (pages[read.title] ??= []).push(read.text);
    const bounds = await page.evaluate(() => { const o = (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-supply-reader').getByName('route-supply-reader-body'), b = o.getBounds(); return { bottom: b.bottom, width: b.width, font: o.style.fontSize }; });
    expect(bounds.bottom).toBeLessThanOrEqual(498); expect(bounds.width).toBeLessThanOrEqual(464); expect(bounds.font).toBe('22px');
    if (read.page === read.total) break;
    await press(keys.next);
  }
  const normalize = (s: string) => s.replace(/\s/g, '');
  expect(normalize(pages['COMPLETE OUTCOME'].join(''))).toBe(normalize(expected.effect));
  if (kind === 'waymark') {
    expect(normalize(pages['COMPANION CARD'].join(''))).toContain(normalize(expected.cards[0].text));
    expect(pages['COMPANION CARD'].join('')).toContain('Snag · Unplayable');
    await press(keys.back); await press(keys.inspect);
    while ((await reading()).title !== 'COMPANION CARD') await press(keys.next);
    await capture('companion');
  }
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Your choice is unchanged');
  const currentPage = (await reading()).page;
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').renderAll());
  expect((await reading()).page).toBe(currentPage);
  for (const overlay of ['pauseOverlayOpen', 'settingsOverlayOpen']) {
    await page.evaluate(overlay => (window as any).__birdSquadGame.scene.getScene('RouteScene')[overlay] = true, overlay);
    await press(keys.next); await press('Enter');
    expect((await reading()).page).toBe(currentPage);
    await page.evaluate(overlay => (window as any).__birdSquadGame.scene.getScene('RouteScene')[overlay] = false, overlay);
  }
  await click('route-supply-reader-return'); expect(await reading()).toBeNull(); expect(await stable()).toBe(before);
  await press(keys.inspect); await expect.poll(reading).not.toBeNull();
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), held = new Set();
    for (let i = 0; i < 4; i++) r.cardHoverDetailModule.updateRouteRewardGamepad(r, { A: true }, held);
  });
  expect(await reading()).toBeNull(); expect(await stable()).toBe(before);
  await press(keys.inspect); await page.keyboard.down('Enter'); await expect.poll(reading).toBeNull();
  await page.keyboard.down('Enter'); await page.keyboard.up('Enter'); await settle(); expect(await stable()).toBe(before);
  await press(keys.inspect); await press(keys.back); expect(await stable()).toBe(before);
  // A tap over Claim while the reader is open closes only the scrim.
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').input.gamepad.emit('down', {}, { index: 3 }));
  await expect.poll(reading).not.toBeNull();
  const coveredClaim = await page.evaluate(() => { const c = document.querySelector('canvas')!.getBoundingClientRect(); return { x: c.left + 952 * c.width / 1280, y: c.top + 599 * c.height / 720 }; });
  await page.mouse.click(coveredClaim.x, coveredClaim.y, { delay: 40 }); await settle();
  expect(await reading()).toBeNull(); expect(await stable()).toBe(before);
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Route outcome.');
  if (remapped && kind === 'supply') await click('route-reward-claim-hit');
  else if (remapped) await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), buttons = new Set<string>();
    r.cardHoverDetailModule.updateRouteRewardGamepad(r, { A: false }, buttons);
    r.cardHoverDetailModule.updateRouteRewardGamepad(r, { A: true }, buttons);
  });
  else await press('Enter');
  await expect.poll(state).toBeUndefined();
  const committed = await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return { supplies: r.runState.supplies, marks: r.runState.routeMarks, deck: r.runState.deck, hp: r.runState.currentHp }; });
  expect(committed).toEqual(expected.projected);
  expect(errors).toEqual([]);
});

test('every Waymark retains full text in the outcome reader', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => { const w = window as any; await w.__birdSquadEnsureScene('RouteScene'); for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key); w.__birdSquadGame.scene.start('RouteScene', {}); });
  await page.waitForFunction(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return r.routeEssentialAssetsReady && r.cardHoverDetailModule; });
  await page.evaluate(() => { const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene'); r.openNodeChoices(w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'cache')); r.chooseNodeOption('cache_mark'); });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-outcome-inspect-hit'));
  const results = await page.evaluate(marks => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    return marks.map((mark: any) => {
      r.pendingRouteReward.previewItem = { kind: 'waymark', id: mark.id }; r.renderAll();
      r.cardHoverDetailModule.handleRouteRewardAction(r, 'inspect');
      const seen: Record<string, string[]> = {}, bounds: any[] = [];
      for (let i = 0; i < 100; i++) {
        const read = JSON.parse(w.render_game_to_text()).routeReward.itemInspection.reading;
        (seen[read.title] ??= []).push(read.text);
        const b = r.children.getByName('route-supply-reader').getByName('route-supply-reader-body').getBounds(); bounds.push({ bottom: b.bottom, width: b.width });
        if (read.page === read.total) break;
        r.cardHoverDetailModule.handleRouteRewardAction(r, 'next');
      }
      r.cardHoverDetailModule.handleRouteRewardAction(r, 'back');
      return { id: mark.id, seen, bounds };
    });
  }, marks);
  for (const result of results) {
    expect(result.seen.EFFECT.join('').replace(/\s/g, '')).toBe(marks.find((m: any) => m.id === result.id).description.replace(/\s/g, ''));
    expect(result.seen.TRIGGER.join('')).not.toMatch(/on[A-Z]|\w+\(/);
    expect(result.seen.RULES.join('')).not.toMatch(/\w+\(/);
    expect(result.seen['WAYMARK DETAILS'].join('').replace(/\s/g, '')).toContain(marks.find((m: any) => m.id === result.id).name.replace(/\s/g, ''));
    result.bounds.forEach((b: any) => { expect(b.bottom).toBeLessThanOrEqual(498); expect(b.width).toBeLessThanOrEqual(464); });
  }
});
