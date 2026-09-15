import { test, expect } from '@playwright/test';


for (const kind of ['scrap', 'mixed', 'leave']) for (const remapped of [false, true]) test(`${kind} decision review preserves every consequence, remapped=${remapped}`, async ({ page }, info) => {
  // This journey captures nine viewports and exercises every modal input guard.
  test.setTimeout(120000);
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
    r.runState.currentHp = 20;
    const effects = kind === 'scrap' ? ['gainScrap(35)'] : kind === 'leave' ? [] : ['gainScrap(25)', 'healMissingPct(50, 10)', 'reduceNextOpenSky(1)', 'bossDamageShield(16)', 'gainOpenSkyGuard(1)', 'addSnagToDiscard(bad_directions)'];
    r.openRouteRewardMenu(node, { key: 'review-' + kind, text: kind === 'leave' ? 'Leave the drawer closed.' : 'Review the rooftop cache.', effects }, structuredClone(r.runState));
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
      await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').cameras.main.fadeEffect.isRunning);
      await settle();
      const geometry = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), p = r.children.getByName('route-supply-reader'), scale = r.game.canvas.getBoundingClientRect().height / 720;
        return (p?.list ?? r.children.list).filter((o: any) => /reader-(next|previous|return)$|route-outcome-inspect-hit|route-decision-inspect-hit|route-reward-claim-hit/.test(o.name)).map((o: any) => o.height * scale);
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
    return { item: p.previewItem, projected: { scrap: p.projectedState.scrap, supplies: p.projectedState.supplies, marks: p.projectedState.routeMarks, deck: p.projectedState.deck, hp: p.projectedState.currentHp }, cards: (p.previewCards ?? []).map((c: any) => ({ name: c.name, text: c.upgraded ? c.upgradedText : c.text })), effect: p.effectText };
  });
  expect(expected.item).toBeUndefined();
  if (kind === 'mixed') expect(expected.cards).toHaveLength(1);
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
  expect(normalize(Object.values(pages).flat().join(''))).toContain(normalize(expected.effect));
  if (kind !== 'mixed') {
    expect((await reading()).total).toBe(1);
    expect(await page.evaluate(() => {
      const reader = (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-supply-reader');
      return Boolean(reader.getByName('route-supply-reader-next') || reader.getByName('route-supply-reader-previous'));
    })).toBe(false);
  }
  if (kind === 'mixed') {
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
  if (remapped && kind === 'scrap') await click('route-reward-claim-hit');
  else if (remapped) await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), buttons = new Set<string>();
    r.cardHoverDetailModule.updateRouteRewardGamepad(r, { A: false }, buttons);
    r.cardHoverDetailModule.updateRouteRewardGamepad(r, { A: true }, buttons);
  });
  else await press('Enter');
  await expect.poll(state).toBeUndefined();
  const committed = await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return { scrap: r.runState.scrap, supplies: r.runState.supplies, marks: r.runState.routeMarks, deck: r.runState.deck, hp: r.runState.currentHp }; });
  expect(committed).toEqual(expected.projected);
  expect(errors).toEqual([]);
});

for (const kind of ['card', 'supply']) test(`${kind} choice Details preserves armed picks and complete long consequences`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('RouteScene', {});
  });
  await page.waitForFunction(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return r.routeEssentialAssetsReady && r.cardHoverDetailModule && !r.cameras.main.fadeEffect.isRunning; });
  await page.evaluate(kind => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === (kind === 'card' ? 'cache' : 'basin'));
    r.openNodeChoices(node);
    if (kind === 'supply') r.chooseNodeOption('refill_supplies');
    else r.openRouteRewardMenu(node, { key: 'card-choice-review', text: 'Choose a card from the cache.', effects: ['addCard(chooseOneOfTwoUncommonOrRare)'] }, structuredClone(r.runState));
  }, kind);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-decision-inspect-hit'));
  const settle = async () => { const f = await page.evaluate(() => (window as any).__birdSquadGame.loop.frame); await page.waitForFunction(f => (window as any).__birdSquadGame.loop.frame >= f + 2, f); };
  const press = async (key: string) => { await page.keyboard.press(key); await settle(); };
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size);
    await page.waitForFunction(() => { const b = document.querySelector('canvas')!.getBoundingClientRect(); return b.width <= innerWidth + 1 && b.height <= innerHeight + 1; });
    await settle();
    await page.screenshot({ path: info.outputPath(`${kind}-choice-${size.width}.png`) });
  }
  await press('Enter');
  const stress = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), p = r.pendingRouteReward;
    p.choiceText = 'A long decision with a complete explanation. '.repeat(12) + 'UNBROKEN'.repeat(35);
    p.effectText = 'All costs and consequences must remain available before commitment. '.repeat(18);
    p.decisionPreview = Array.from({ length: 8 }, (_, i) => `Change ${i + 1}: a long projected consequence with a clear end marker ${i + 1}.`);
    for (const [index, card] of r.routeCardRewardChoices.entries()) card.name = `A deliberately long reward card name ${index + 1} with a complete readable identity`;
    r.renderAll();
    return { choice: p.choiceText, effect: p.effectText, rows: p.decisionPreview.join('\n') };
  });
  const stable = () => page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return JSON.stringify({ run: r.runState, pending: r.pendingRouteReward, card: r.routeRewardArmedCardId, supply: r.routeSupplyRewardArmedId, cardFocus: r.routeRewardChoiceIndex, supplyFocus: r.routeSupplyRewardChoiceIndex }); });
  const before = await stable();
  const bounds = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.children.list.filter((o: any) => /route-decision-(choice|summary|row)$|route-reward-build-(card-name|observation)$/.test(o.name)).map((o: any) => ({ name: o.name, text: o.text, right: o.getBounds().right, bottom: o.getBounds().bottom }));
  });
  bounds.forEach((b: any) => { expect(b.right).toBeLessThanOrEqual(550); expect(b.bottom).toBeLessThan(570); });
  expect(bounds.find((b: any) => b.name === 'route-decision-choice')?.text).toMatch(/…$/);
  await settle();
  await page.screenshot({ path: info.outputPath(`${kind}-stress-1000.png`) });
  const clickDetails = async () => {
    const p = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), b = r.children.getByName('route-decision-inspect-hit').getBounds(), c = r.game.canvas.getBoundingClientRect();
      return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
    });
    await page.mouse.click(p.x, p.y, { delay: 40 }); await settle();
  };
  const readAll = async (generic: boolean) => {
    const pages: Record<string, string[]> = {};
    for (let i = 0; i < 100; i++) {
      const read = await page.evaluate(generic => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), state = JSON.parse((window as any).render_game_to_text()).routeReward;
        const reader = generic ? r.children.getByName('route-supply-reader') : r.hoverCardDetail?.getByName('route-inspection-reader');
        const body = reader.getByName(generic ? 'route-supply-reader-body' : 'route-inspection-reader-body');
        return { ...(generic ? (state.itemInspection ?? state.supplyInspection).reading : reader.getData('reading')), bottom: body.getBounds().bottom, width: body.width, font: body.style.fontSize };
      }, generic);
      expect(read.bottom).toBeLessThanOrEqual(generic ? 498 : 518); expect(read.width).toBeLessThanOrEqual(generic ? 464 : 396); expect(read.font).toBe('22px');
      (pages[read.title] ??= []).push(read.text);
      if (read.page === read.total) break;
      await press('ArrowRight');
    }
    const normalize = (s: string) => s.replace(/\s/g, '');
    const complete = normalize(Object.values(pages).flat().join(''));
    expect(complete).toContain(normalize(stress.choice));
    expect(complete).toContain(normalize(stress.effect));
    expect(complete).toContain(normalize(stress.rows));
    return pages;
  };
  await clickDetails();
  await readAll(true); expect(await stable()).toBe(before);
  await press('Escape'); expect(await stable()).toBe(before);
  // Keyboard Inspect offers the same complete decision context, without requiring the pointer-only shortcut.
  await press('r');
  const pages = await readAll(kind === 'supply');
  if (kind === 'card') expect(pages['BUILD ADVICE']).toBeDefined();
  expect(await stable()).toBe(before);
  await press('Escape');
  await press('Escape');
  const cleared = await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return { pending: !!r.pendingRouteReward, armed: !!(r.routeRewardArmedCardId || r.routeSupplyRewardArmedId) }; });
  expect(cleared).toEqual({ pending: true, armed: false });
  expect(errors).toEqual([]);
});
