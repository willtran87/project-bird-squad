import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { boot, clickNamedGameObject } from './helpers/smoke';

// Split from the former tests/smoke.spec.ts (market topics). Tests drive
// scenes through the deterministic text-state harness on window.

test('market categories keep one merchandise family visible at a time', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const market = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes[0];
    market.type = 'market';
    scene.openMarketNode(market);
    // Opening is asynchronous; inventory reads below wait for the renderer.
    const visibleSections = () => scene.children.list
      .filter((child: any) => child.name === 'market-section-heading')
      .map((child: any) => child.text.toUpperCase());
    for (let i = 0; i < 200 && !scene.routeSecondaryPresentationModule; i++) await new Promise(resolve => setTimeout(resolve, 25));
    const states: Array<{ category: string; sections: string[] }> = [];
    states.push({ category: JSON.parse(window.render_game_to_text!()).market.category, sections: visibleSections() });
    for (const key of ['TWO', 'THREE', 'FOUR']) {
      scene.input.keyboard.emit(`keydown-${key}`);
      states.push({ category: JSON.parse(window.render_game_to_text!()).market.category, sections: visibleSections() });
    }
    return {
      states,
      tabObjects: scene.children.list.filter((child: any) => child.name === 'market-category-tab').length,
      merchandiseScrims: scene.children.list.filter((child: any) => child.name === 'market-merchandise-scrim').length,
      serviceLabels: scene.children.list
        .filter((child: any) => typeof child.text === 'string')
        .map((child: any) => child.text)
        .filter((text: string) => ['Preen a Card', 'Release a Card', 'Refresh stock'].includes(text))
    };
  });

  expect(result.states).toEqual([
    { category: 'cards', sections: ['CREW CARDS'] },
    { category: 'waymarks', sections: ['WAYMARKS'] },
    { category: 'supplies', sections: ['SUPPLIES'] },
    { category: 'services', sections: ['SERVICES'] }
  ]);
  expect(result.tabObjects).toBe(8);
  expect(result.merchandiseScrims).toBe(1);
  expect(result.serviceLabels).toEqual(expect.arrayContaining(['Preen a Card', 'Release a Card', 'Refresh stock']));
});

test('sold-out Market stock remains in the spoken unavailable inventory', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    for (let attempt = 0; attempt < 120 && !route.cardHoverDetailModule; attempt += 1) await wait(25);
    const market = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type !== 'boss');
    market.type = 'market';
    route.openMarketNode(market);
    route.marketCardShelf.slice(0, 2).forEach((offer: any) => { offer.sold = true; });
    route.marketCategory = 'cards';
    route.renderAll();
  });

  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.market.unavailableOffers.filter((offer: any) => offer.reason === 'SOLD OUT').length;
  })).toBe(2);
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('SOLD OUT');
});

test('Market card detail keeps live deck-fit guidance in the focused dossier', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    for (let attempt = 0; attempt < 120 && !route.cardHoverDetailModule; attempt += 1) await wait(25);
    const market = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type !== 'boss');
    market.type = 'market';
    route.openMarketNode(market);
    route.runState.scrap = 999;
    route.marketCategory = 'cards';
    route.renderAll();

    const listing = route.marketCardShelf[0];
    listing.id = 'aviary_35';
    route.renderAll();
    const card = route.marketCardOffers()[0].card;
    const expected = route.routeRewardCardObservations(card).slice(0, 2);
    route.showHoverCardDetail(card, 'Market offer', listing.price, 650, 360, route.marketCardDecisionPreview(listing));
    // Reproduce a late shelf-art redraw followed by the pending portrait refresh.
    route.renderAll();
    route.renderHoverCardDetailRequest();
    route.updateTextState();
    const dossier = route.hoverCardDetail.list.find((child: any) => child.name === 'market-fixed-card-inspector');
    const observations: string[] = [];
    for (let i = 0; i < dossier.getData('reading').total; i++) {
      const reading = dossier.getData('reading');
      if (reading.title === 'BUILD READ') observations.push(reading.text);
      dossier.getData('turnRulesPage')(1);
    }
    const panelBounds = dossier.getBounds();
    const dossierBounds = dossier?.getBounds();
    const state = JSON.parse(window.render_game_to_text!());
    return {
      expected,
      observations,
      focusObservations: state.market.input.observations,
      panel: panelBounds && {
        left: panelBounds.left,
        top: panelBounds.top,
        bottom: panelBounds.bottom,
      },
      dossier: dossierBounds && {
        left: dossierBounds.left,
        bottom: dossierBounds.bottom,
      },
      persistentShelfReads: route.children.list.filter((child: any) => (
        child.name === 'market-card-build-read' || child.name === 'market-card-build-observation'
      )).length,
      decisionPreview: state.market.decisionPreview,
      badgeCost: route.cardHoverDetailRequest.cost,
      cardCost: card.cost,
    };
  });

  expect(result.expected.length).toBeGreaterThan(0);
  expect(result.expected.length).toBeLessThanOrEqual(2);
  expect(result.observations.join(' ').replace(/\s+/g, ' ')).toBe(result.expected.join(' ').replace(/\s+/g, ' '));
  expect(result.focusObservations).toEqual(result.expected);
  for (const observation of result.expected) {
    await expect.poll(() => page.locator('#game-status').textContent()).toContain(observation);
  }
  expect(result.panel.left).toBe(84);
  expect(result.panel.top).toBe(118);
  expect(result.panel.bottom).toBeLessThan(657);
  expect(result.badgeCost).toBe(result.cardCost);
  expect(result.persistentShelfReads).toBe(0);
  expect(result.decisionPreview).toEqual(expect.arrayContaining([
    expect.stringMatching(/^DECK /),
    expect.stringMatching(/^SCRAP /),
    expect.stringMatching(/^BASE HAND /),
  ]));
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('BASE HAND');
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size);
    await page.waitForFunction(() => { const b = document.querySelector('canvas')!.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1; });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const geometry = await page.evaluate(() => {
      const route = window.__birdSquadGame.scene.getScene('RouteScene');
      const listing = route.marketCardShelf[0];
      route.showHoverCardDetail(route.marketCardOffers()[0].card, 'Market offer', listing.price, 650, 360, route.marketCardDecisionPreview(listing));
      const panel = route.hoverCardDetail.list.find((o: any) => o.name === 'market-fixed-card-inspector');
      const frame = panel.list[0].getBounds();
      const labels = panel.list.filter((o: any) => o.type === 'Text');
      const offers = route.children.list.filter((o: any) => String(o.getData?.('marketFocusId') ?? '').startsWith('card:'));
      return {
        overflow: labels.filter((o: any) => { const b = o.getBounds(); return b.left < frame.left + 8 || b.top < frame.top + 8 || b.right > frame.right - 8 || b.bottom > frame.bottom - 8; })
          .map((o: any) => ({ name: o.name, text: o.text, bounds: o.getBounds(), frame })),
        smallest: Math.min(...labels.map((o: any) => parseFloat(o.style.fontSize))),
        overlaps: offers.some((o: any) => { const b = o.getBounds(); return b.left < frame.right && b.right > frame.left && b.top < frame.bottom && b.bottom > frame.top; }),
      };
    });
    expect(geometry.overflow).toEqual([]);
    expect(geometry.smallest).toBe(19);
    expect(geometry.overlaps).toBe(false);
    await page.screenshot({ path: `.artifacts/test-results/market-purchase-read/${testInfo.project.name}-${size.width}x${size.height}.png` });
  }
  expect(await page.evaluate(() => {
    const route = window.__birdSquadGame.scene.getScene('RouteScene');
    route.marketCardShelf[0].sold = true;
    route.renderHoverCardDetailRequest();
    return { closed: !route.hoverCardDetail && !route.cardHoverDetailRequest, preview: route.marketDecisionPreview };
  })).toEqual({ closed: true, preview: [] });
});

test('Market rules pages preserve complete text and purchases across pointer keyboard and controller', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  await page.evaluate(async () => {
    const route = await window.__birdSquadStartScene!('RouteScene', {});
    for (let i = 0; i < 120 && !route.cardHoverDetailModule; i++) await new Promise(r => setTimeout(r, 25));
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type !== 'boss');
    market.type = 'market';
    route.openMarketNode(market);
    route.runState.scrap = 999;
    route.marketCategory = 'cards';
    route.marketCardShelf = [{ id: 'aviary_35', price: 40, sold: false }, { id: 'swords_05', price: 40, sold: false }];
    route.renderAll();
  });
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size);
    await page.waitForFunction(() => { const b = document.querySelector('canvas')!.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1; });
    const audit = await page.evaluate(() => {
      const route = window.__birdSquadGame.scene.getScene('RouteScene');
      const stable = () => JSON.stringify({ run: route.runState, storage: { ...localStorage }, focus: route.marketFocusId, armed: route.marketFocusArmedId });
      const results = [];
      for (const offer of route.marketCardOffers()) {
        route.showHoverCardDetail(offer.card, 'Market offer', offer.price, 650, 360);
        const view = route.cardHoverDetailRequest;
        const before = stable();
        const seen: Record<string, string[]> = {};
        const violations: string[] = [];
        for (let i = 0; i < view.marketRules.total; i++) {
          const dossier = route.hoverCardDetail.list.find((o: any) => o.name === 'market-fixed-card-inspector');
          const body = dossier.list.find((o: any) => o.name === 'market-rules-body');
          const frame = dossier.list.find((o: any) => o.name === 'market-rules-frame').getBounds();
          for (const button of dossier.list.filter((o: any) => o.input?.enabled)) {
            if (button.input.hitArea.height < 58 || button.input.hitArea.width < 58) violations.push('small touch target');
          }
          const rules = view.marketRules;
          (seen[rules.title] ??= []).push(rules.text);
          if (body.getBounds().bottom > 530) violations.push('footer overlap');
          if (body.style.maxLines || parseFloat(body.style.fontSize) !== 22) violations.push('clipped or small rules');
          for (const label of dossier.list.filter((o: any) => o.type === 'Text')) {
            const b = label.getBounds();
            if (b.left < frame.left + 8 || b.right > frame.right - 8 || b.bottom > frame.bottom - 4) violations.push(label.text);
          }
          dossier.getData('turnRulesPage')(1);
        }
        const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
        results.push({ id: offer.id, violations, unchanged: before === stable(),
          actual: Object.fromEntries(Object.entries(seen).map(([key, values]) => [key, normalize(values.join(' '))])),
          expected: { NOW: normalize(view.currentText), PREEN: normalize(view.upgradedText), MOLT: normalize(view.moltText) } });
      }
      const offer = route.marketCardOffers()[0];
      route.showHoverCardDetail(offer.card, 'Market offer', offer.price, 650, 360);
      route.updateTextState();
      return results;
    });
    for (const result of audit) {
      expect(result.violations, result.id).toEqual([]);
      expect(result.actual, result.id).toMatchObject(result.expected);
      expect(result.unchanged).toBe(true);
    }
    await page.screenshot({ path: `.artifacts/test-results/market-rules/${testInfo.project.name}-${size.width}x${size.height}-now.png` });
    await page.keyboard.press('r');
    await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).market.rules.page)).toBe(2);
    await page.screenshot({ path: `.artifacts/test-results/market-rules/${testInfo.project.name}-${size.width}x${size.height}-next.png` });
  }
  const before = await page.evaluate(() => {
    const route = window.__birdSquadGame.scene.getScene('RouteScene');
    route.marketFocusArmedId = route.marketFocusId;
    route.renderAll();
    return JSON.stringify({ run: route.runState, storage: { ...localStorage }, armed: route.marketFocusArmedId, focus: route.marketFocusId });
  });
  // Actual pointer activation outside the shelf must page, never buy or clear an armed offer.
  await clickNamedGameObject(page, 'RouteScene', 'market-rules-next');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).market.rules.page)).toBe(3);
  await clickNamedGameObject(page, 'RouteScene', 'market-rules-previous');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).market.rules.page)).toBe(2);
  await clickNamedGameObject(page, 'RouteScene', 'market-rules-next');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).market.rules.page)).toBe(3);
  await page.evaluate(() => {
    const route = window.__birdSquadGame.scene.getScene('RouteScene');
    route.input.gamepad.emit('down', {}, { index: 3 });
  });
  const after = await page.evaluate(() => {
    const route = window.__birdSquadGame.scene.getScene('RouteScene');
    const rules = { ...route.cardHoverDetailRequest.marketRules };
    route.renderAll(); route.renderHoverCardDetailRequest(); route.updateTextState();
    return { saved: JSON.stringify({ run: route.runState, storage: { ...localStorage }, armed: route.marketFocusArmedId, focus: route.marketFocusId }),
      rules, restored: route.cardHoverDetailRequest.marketRules };
  });
  expect(after.saved).toBe(before);
  expect(after.restored).toEqual(after.rules);
  await expect.poll(() => page.locator('#game-status').textContent()).toContain(after.rules.text.replace(/\s+/g, ' '));
  await page.keyboard.press('2');
  expect(await page.evaluate(() => {
    const route = window.__birdSquadGame.scene.getScene('RouteScene');
    return { visible: !!route.hoverCardDetail, request: !!route.cardHoverDetailRequest, itemReader: !!route.marketItemHover };
  })).toEqual({ visible: false, request: false, itemReader: true });
});

test('Market rules pagination keeps every catalog rule and long name inside its reading bounds', async ({ page }) => {
  test.setTimeout(90_000);
  const data = JSON.parse(await readFile('data/game/alpha-cards.json', 'utf8'));
  await boot(page);
  const audit = await page.evaluate(async (ids: string[]) => {
    const route = await window.__birdSquadStartScene!('RouteScene', {});
    for (let i = 0; i < 120 && !route.cardHoverDetailModule; i++) await new Promise(r => setTimeout(r, 25));
    route.marketCardShelf = ids.map(id => ({ id, price: 40, sold: false }));
    route.marketOpen = true; route.marketCategory = 'cards'; route.runState.scrap = 999;
    const violations: string[] = [];
    let pages = 0;
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    const catalog = route.marketCardOffers().map((offer: any) => offer.card);
    catalog.push({ ...catalog[0], id: 'pagination-stress', name: 'An Especially Long Card Name For Layout',
      text: catalog[0].text.repeat(16), upgradedText: catalog[0].upgradedText.repeat(16) });
    for (const card of catalog) {
      // Snags have no Molt rules: test every actual card state, not a fabricated empty Molt.
      for (const usesMolt of card.moltText ? [false, true] : [false]) {
        const view: any = { marketCardId: card.id, name: card.name, bird: card.bird, label: 'Card', zone: 'Market / 40 Scrap to buy',
          cost: card.cost, target: card.target, role: card.role, currentText: usesMolt ? card.moltText : card.text,
          upgradedText: card.upgradedText, baseText: card.text, moltText: card.moltText, upgradedMoltText: card.moltTextUpgraded, usesMolt,
          stats: Object.entries(card.runtime.flockStats ?? {}).map(([key, value]) => `${key} +${value}`),
          accent: 0x8df4ff, reducedMotion: true };
        const panel = route.cardHoverDetailModule.renderCardHoverDetail(route, view);
        const body = panel.list.find((o: any) => o.name === 'market-rules-body');
        const frame = panel.list.find((o: any) => o.name === 'market-rules-frame').getBounds();
        const seen: Record<string, string[]> = {};
        for (let i = 0; i < view.marketRules.total; i++) {
          pages++;
          const rules = view.marketRules;
          (seen[rules.title] ??= []).push(rules.text);
          if (body.getBounds().bottom > 530) violations.push(`${card.id}: footer`);
          if (body.style.maxLines || parseFloat(body.style.fontSize) !== 22) violations.push(`${card.id}: clipped`);
          for (const label of panel.list.filter((o: any) => o.type === 'Text')) {
            const b = label.getBounds();
            if (b.right > frame.right - 8 || b.left < frame.left + 8 || b.bottom > frame.bottom - 4) violations.push(`${card.id}: bounds ${label.text}`);
          }
          panel.getData('turnRulesPage')(1);
        }
        const expected = {
          ...(usesMolt ? { 'NOW / MOLT': card.moltText, BASE: card.text }
            : { NOW: card.text, PREEN: card.upgradedText, ...(card.moltText ? { MOLT: card.moltText } : {}) }),
          ...(card.moltTextUpgraded ? { 'MOLT / PREEN': card.moltTextUpgraded } : {}),
          'PASSIVE FLOCK BONUSES': view.stats.length ? view.stats.join('\n') : 'No passive contribution.',
        };
        for (const [key, value] of Object.entries(expected)) {
          if (normalize((seen[key] ?? []).join(' ')) !== normalize(value)) violations.push(`${card.id}: incomplete ${key}`);
        }
        panel.destroy(true);
      }
    }
    return { cards: ids.length, pages, violations };
  }, data.cards.map((card: any) => card.id));
  expect(audit.cards).toBeGreaterThan(100);
  expect(audit.pages).toBeGreaterThan(audit.cards * 4);
  expect(audit.violations).toEqual([]);
});

test('Market card hand previews match combat and rejected offers do not mutate saves', async ({ page }) => {
  await boot(page);
  const results = await page.evaluate(async () => {
    const route = await window.__birdSquadStartScene!('RouteScene', {});
    route.runState.deck = ['wands_02', 'wands_03', 'wands_04', 'wands_05'].map(id => ({ id }));
    route.runState.scrap = 100;
    route.runState.routeMarks = [];
    const listing = { id: 'wands_06', price: 40, sold: false };
    route.marketCardShelf = [listing];
    const cards = route.pickerEligibleCards('release').map((e: any) => e.card);
    const addition = route.marketCardOffers()[0].card;
    const battle = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    battle.hand = []; battle.discardPile = []; battle.clearedPile = []; battle.nextTurnDrawBonus = 0;
    const cases = [];
    for (const leader of ['fledgling', 'spark_caller', 'talon', 'tidewarden', 'roostkeeper']) {
      route.runState.leaderId = leader;
      const saved = JSON.stringify({ run: route.runState, storage: { ...localStorage } });
      const preview = route.marketCardDecisionPreview(listing);
      battle.runLeaderId = leader; battle.drawPile = cards;
      const before = battle.handTargetSize();
      battle.drawPile = [...cards, addition];
      const after = battle.handTargetSize();
      cases.push({ preview, expected: `BASE HAND ${before} > ${after}`,
        unchanged: saved === JSON.stringify({ run: route.runState, storage: { ...localStorage } }) });
    }
    route.runState.scrap = 10;
    const saved = JSON.stringify({ run: route.runState, storage: { ...localStorage } });
    const unavailable = route.marketCardDecisionPreview(listing);
    const sold = route.marketCardDecisionPreview({ ...listing, sold: true });
    return { cases, unavailable, sold, unchanged: saved === JSON.stringify({ run: route.runState, storage: { ...localStorage } }) };
  });
  for (const result of results.cases) {
    expect(result.preview).toContain(result.expected);
    expect(result.unchanged).toBe(true);
  }
  expect(results.unavailable).toEqual(['NEED 30 MORE SCRAP']);
  expect(results.sold).toEqual(['SOLD OUT']);
  expect(results.unchanged).toBe(true);
});

test('Market item dossiers explain live build fit across Waymarks Supplies and services', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    for (let attempt = 0; attempt < 120 && !route.cardHoverDetailModule; attempt += 1) await wait(25);
    const market = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type !== 'boss');
    market.type = 'market';
    route.openMarketNode(market);
    route.runState.scrap = 999;
    route.runState.routeMarks = ['supply_bell'];
    for (let i = 0; i < 200 && !route.routeSecondaryPresentationModule; i++) await wait(25);

    const inspect = (category: 'waymarks' | 'supplies' | 'services') => {
      route.setMarketCategory(category);
      const state = JSON.parse(window.render_game_to_text!());
      const focusId = state.market.input.focusId;
      const target = route.children.list.find((child: any) => (
        child.input?.enabled && child.getData?.('marketFocusId') === focusId
      ));
      target?.emit('pointerover');
      route.updateTextState();
      const focused = JSON.parse(window.render_game_to_text!()).market.input;
      const pages: string[] = [];
      const reader = route.marketItemHover;
      for (let i = 0; i < reader.getData('reading').total; i++) {
        const current = reader.getData('reading');
        if (current.title === 'BUILD READ') pages.push(`${current.title}\n${current.text}`);
        reader.getData('turnRulesPage')(1);
      }
      const bounds = route.marketItemHover?.getBounds();
      return {
        focusId,
        observations: focused.observations,
        detail: pages.join('\n').replace(/\s+/g, ' '),
        bounds: bounds && { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom },
      };
    };

    return {
      waymark: inspect('waymarks'),
      supply: inspect('supplies'),
      service: inspect('services'),
      persistentBuildReads: route.children.list.filter((child: any) => child.name === 'market-item-build-read').length,
    };
  });

  for (const item of [result.waymark, result.supply, result.service]) {
    expect(item.observations.length).toBeGreaterThan(0);
    expect(item.observations.length).toBeLessThanOrEqual(2);
    expect(item.detail).toContain('BUILD READ');
    for (const observation of item.observations) expect(item.detail).toContain(observation.replace(/\s+/g, ' '));
    expect(item.bounds.left).toBeGreaterThanOrEqual(0);
    expect(item.bounds.right).toBeLessThanOrEqual(1280);
    expect(item.bounds.top).toBeGreaterThanOrEqual(0);
    expect(item.bounds.bottom).toBeLessThanOrEqual(720);
  }
  expect(result.supply.observations.some((observation: string) => observation.includes('Supply Waymark'))).toBe(true);
  expect(result.persistentBuildReads).toBe(0);
  for (const observation of result.service.observations) {
    await expect.poll(() => page.locator('#game-status').textContent()).toContain(observation);
  }
  const supplyCenter = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.setMarketCategory('supplies');
    const target = route.children.list.find((child: any) => (
      child.input?.enabled && String(child.getData?.('marketFocusId')).startsWith('utility:')
    ));
    const bounds = target.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  });
  const canvas = page.locator('canvas');
  const canvasBounds = await canvas.boundingBox();
  if (!canvasBounds) throw new Error('Missing game canvas');
  await canvas.hover({ position: {
    x: canvasBounds.width * (supplyCenter.x / 1280),
    y: canvasBounds.height * (supplyCenter.y / 720),
  } });
  await expect.poll(() => page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return !!route.marketItemHover?.getData('reading');
  })).toBe(true);
  await page.evaluate(() => {
    const reader = (window.__birdSquadGame.scene.getScene('RouteScene') as any).marketItemHover;
    for (let i = 0; i < reader.getData('reading').total && reader.getData('reading').title !== 'BUILD READ'; i++) reader.getData('turnRulesPage')(1);
  });
  await canvas.screenshot({ path: '.artifacts/test-results/market-item-build-read-1000x560.png' });
});

test('market purchases require intentional input and block route commitment across pointer keyboard and controller', async ({ page }) => {
  // This integrated flow covers purchases, cancellation, hover, section changes,
  // and all three input modes; software-rendered CI exceeded its old 2-minute budget.
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  const initial = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    for (let attempt = 0; attempt < 120 && !route.cardHoverDetailModule; attempt += 1) await wait(25);
    const market = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type !== 'boss');
    market.type = 'market';
    route.openMarketNode(market);
    route.runState.scrap = 999;
    route.routeCommitCalls = 0;
    // The optional Market renderer downloads on first open. Verify the settled
    // offer inventory, rather than the cancellable pending panel.
    for (let attempt = 0; attempt < 120 && !route.routeSecondaryPresentationModule; attempt += 1) await wait(25);
    route.commitRouteNodeAnimated = () => { route.routeCommitCalls += 1; };
    const inputModule = route.cardHoverDetailModule;
    route.cardHoverDetailModule = undefined;
    route.activateRouteSelection();
    route.cardHoverDetailModule = inputModule;
    route.renderAll();
    return {
      offerIds: route.marketCardShelf.map((offer: any) => offer.id),
      deckSize: route.runState.deck.length,
      routeCommitCalls: route.routeCommitCalls,
      input: JSON.parse(window.render_game_to_text!()).market.input,
    };
  });
  expect(initial.offerIds).toHaveLength(4);
  expect(initial.routeCommitCalls).toBe(0);
  expect(initial.input).toMatchObject({
    focusId: 'card:0',
    index: 0,
    count: 4,
    armed: false,
    focusVisible: true,
    routeCommitBlocked: true,
  });

  const marketInputHelp = async () => page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.children.list
      .filter((child: any) => child.name === 'market-input-help' || child.name === 'market-input-help-text')
      .map((child: any) => ({
        type: child.type,
        text: child.text,
        width: child.displayWidth,
        height: child.displayHeight,
        fontSize: Number.parseFloat(child.style?.fontSize ?? '0'),
      }));
  });
  const browsingHelp = await marketInputHelp();
  expect(browsingHelp).toHaveLength(2);
  expect(browsingHelp.find((item: any) => item.type === 'Rectangle')).toMatchObject({ width: 1120, height: 64 });
  expect(browsingHelp.find((item: any) => item.type === 'Text')).toMatchObject({
    text: expect.stringMatching(/^\d+ Scrap · Have 999 · After purchase \d+$/),
    fontSize: 19,
  });

  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.focusId === 'card:1');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.cardOffers.filter((offer: any) => offer.sold).length === 1);
  const keyboardPurchase = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return {
      routeCommitCalls: route.routeCommitCalls,
      sold: route.marketCardShelf.map((offer: any) => !!offer.sold),
      deckIds: route.runState.deck.map((card: any) => card.id),
      input: JSON.parse(window.render_game_to_text!()).market.input,
    };
  });
  expect(keyboardPurchase.routeCommitCalls).toBe(0);
  expect(keyboardPurchase.sold).toEqual([false, true, false, false]);
  expect(keyboardPurchase.deckIds).toContain(initial.offerIds[1]);
  expect(keyboardPurchase.input.focusId).toBe('card:0');

  const clickMarketTarget = async (focusId: string) => {
    const center = await page.evaluate((id) => {
      const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
      const target = route.children.list.find((child: any) => (
        child.input?.enabled && child.getData?.('marketFocusId') === id
      ));
      if (!target) throw new Error(`Missing Market target ${id}`);
      const bounds = target.getBounds();
      return { x: bounds.centerX, y: bounds.centerY };
    }, focusId);
    const canvas = page.locator('canvas');
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('Missing game canvas');
    const position = {
      x: bounds.width * (center.x / 1280),
      y: bounds.height * (center.y / 720),
    };
    await canvas.hover({ position });
    await canvas.click({ position, delay: 50 });
  };
  const moveToMarketTarget = async (focusId: string) => {
    const center = await page.evaluate((id) => {
      const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
      const target = route.children.list.find((child: any) => (
        child.input?.enabled && child.getData?.('marketFocusId') === id
      ));
      if (!target) throw new Error(`Missing Market target ${id}`);
      const bounds = target.getBounds();
      return { x: bounds.centerX, y: bounds.centerY };
    }, focusId);
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Missing game canvas');
    await page.mouse.move(
      canvas.x + canvas.width * (center.x / 1280),
      canvas.y + canvas.height * (center.y / 720),
    );
  };
  const clickMarketCommand = async (label: string) => {
    const center = await page.evaluate((commandLabel) => {
      const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
      const target = route.children.list.find((child: any) => (
        child.name === 'market-enamel-button-hit'
        && child.input?.enabled
        && child.getData?.('label') === commandLabel
      ));
      if (!target) throw new Error(`Missing Market ${commandLabel} control`);
      const bounds = target.getBounds();
      return { x: bounds.centerX, y: bounds.centerY };
    }, label);
    const canvas = page.locator('canvas');
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('Missing game canvas');
    const position = {
      x: bounds.width * (center.x / 1280),
      y: bounds.height * (center.y / 720),
    };
    await canvas.hover({ position });
    await canvas.click({ position, delay: 50 });
  };
  const clickMarketTab = async (label: string) => {
    const center = await page.evaluate((tabLabel) => {
      const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
      const target = route.children.list.find((child: any) => (
        child.name === 'market-category-tab-hit'
        && child.input?.enabled
        && child.getData?.('label') === tabLabel
      ));
      if (!target) throw new Error(`Missing Market ${tabLabel} tab`);
      const bounds = target.getBounds();
      return { x: bounds.centerX, y: bounds.centerY };
    }, label);
    const canvas = page.locator('canvas');
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('Missing game canvas');
    const position = {
      x: bounds.width * (center.x / 1280),
      y: bounds.height * (center.y / 720),
    };
    await canvas.hover({ position });
    await canvas.click({ position, delay: 50 });
  };
  const marketDecision = () => page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return {
      open: route.marketOpen,
      focusId: route.marketFocusId,
      armedId: route.marketFocusArmedId,
      scrap: route.runState.scrap,
      deckIds: route.runState.deck.map((card: any) => card.id),
      sold: route.marketCardShelf.map((offer: any) => !!offer.sold),
      commands: route.children.list
        .filter((child: any) => child.name === 'market-enamel-button-hit' && child.input?.enabled)
        .map((child: any) => child.getData('label')),
    };
  });
  const marketHoverHierarchy = (focusId: string) => page.evaluate((id) => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const target = route.children.list.find((child: any) => child.getData?.('marketFocusId') === id);
    const ring = route.children.list.find((child: any) => child.name === 'market-input-focus-ring');
    return {
      target: target ? { x: target.x, y: target.y } : undefined,
      ring: ring ? { x: ring.x, y: ring.y, strokeColor: ring.strokeColor } : undefined,
      hoverOpen: Boolean(route.hoverCardDetail?.active),
      inspectedCardId: route.cardHoverDetailRequest?.marketCardId,
      input: JSON.parse(window.render_game_to_text!()).market.input,
    };
  }, focusId);
  const marketSectionState = () => page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const target = route.children.list.find((child: any) => (
      child.getData?.('marketFocusId') === route.marketFocusId
    ));
    const ring = route.children.list.find((child: any) => child.name === 'market-input-focus-ring');
    return {
      category: route.marketCategory,
      focusId: route.marketFocusId,
      armedId: route.marketFocusArmedId,
      scrap: route.runState.scrap,
      deckIds: route.runState.deck.map((card: any) => card.id),
      sold: route.marketCardShelf.map((offer: any) => !!offer.sold),
      hoverOpen: Boolean(route.hoverCardDetail?.active),
      ring: ring ? { x: ring.x, y: ring.y, strokeColor: ring.strokeColor } : undefined,
      target: target ? { x: target.x, y: target.y } : undefined,
      commands: route.children.list
        .filter((child: any) => child.name === 'market-enamel-button-hit' && child.input?.enabled)
        .map((child: any) => child.getData('label')),
    };
  });

  await clickMarketTarget('card:0');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.armed === true);
  await page.waitForFunction(() => document.getElementById('game-status')?.textContent?.includes('Purchase confirmation is armed'));
  const armedResult = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const offerTargets = route.children.list
      .filter((child: any) => child.input?.enabled && child.getData?.('marketFocusId')?.startsWith('card:'));
    offerTargets[0]?.emit('pointerover');
    const inspectorBounds = route.hoverCardDetail?.list.find((child: any) => child.name === 'market-fixed-card-inspector')?.getBounds();
    const offerBounds = offerTargets.map((child: any) => child.getBounds());
    const leftmostOffer = Math.min(...offerBounds.map((bounds: any) => bounds.left));
    return {
      market: JSON.parse(window.render_game_to_text!()).market,
      layout: {
        inspectorRight: inspectorBounds?.right,
        leftmostOffer,
        gap: inspectorBounds ? leftmostOffer - inspectorBounds.right : -1,
      },
    };
  });
  const armed = armedResult.market;
  const armedAnnouncement = await page.locator('#game-status').textContent();
  expect(armed.cardOffers.filter((offer: any) => offer.sold)).toHaveLength(1);
  expect(armed.input).toMatchObject({ focusId: 'card:0', armed: true, focusVisible: true });
  expect(armedResult.layout.inspectorRight).toBeLessThan(armedResult.layout.leftmostOffer);
  expect(armedResult.layout.gap).toBeGreaterThanOrEqual(8);
  expect(armedAnnouncement).toContain('Route commitment is blocked while the Market is open');
  const armedDecision = await marketDecision();
  expect(armedDecision).toMatchObject({
    open: true,
    focusId: 'card:0',
    armedId: 'card:0',
  });
  expect(armedDecision.commands).toContain('Clear');
  expect(armedDecision.commands).not.toContain('Close');
  const confirmationHelp = await marketInputHelp();
  expect(confirmationHelp).toHaveLength(2);
  expect(confirmationHelp.find((item: any) => item.type === 'Rectangle')).toMatchObject({ width: 1120, height: 64 });
  expect(confirmationHelp.find((item: any) => item.type === 'Text')).toEqual(expect.objectContaining({
    text: expect.stringMatching(/^\d+ Scrap · Have \d+ · After purchase \d+$/),
    fontSize: 19,
  }));
  await page.screenshot({ path: '.artifacts/test-results/market-intentional-purchase-1000x560.png' });

  await moveToMarketTarget('card:2');
  const armedAfterHover = await marketHoverHierarchy('card:0');
  expect(armedAfterHover.input).toMatchObject({ focusId: 'card:0', armed: true });
  expect(armedAfterHover.ring).toMatchObject({
    ...armedAfterHover.target,
    strokeColor: 0xffcf70,
  });
  expect(armedAfterHover.hoverOpen).toBe(true);
  expect(armedAfterHover.inspectedCardId).toBe(armed.cardOffers[0].id);
  expect((await marketDecision()).commands).toContain('Clear');
  await page.screenshot({ path: '.artifacts/test-results/market-hover-locked-confirmation-1000x560.png' });

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.armed === false);
  const keyboardCancelled = await marketDecision();
  expect(keyboardCancelled).toEqual({
    ...armedDecision,
    armedId: undefined,
    commands: expect.arrayContaining(['Close']),
  });

  await moveToMarketTarget('card:2');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.focusId === 'card:2');
  const neutralAfterHover = await marketHoverHierarchy('card:2');
  expect(neutralAfterHover.input).toMatchObject({ focusId: 'card:2', armed: false });
  expect(neutralAfterHover.ring).toMatchObject({
    ...neutralAfterHover.target,
    strokeColor: 0x8df4ff,
  });
  expect(neutralAfterHover.hoverOpen).toBe(true);
  await page.screenshot({ path: '.artifacts/test-results/market-hover-browse-1000x560.png' });

  await clickMarketTarget('card:0');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.armed === true);
  await clickMarketCommand('Clear');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.armed === false);
  const pointerCancelled = await marketDecision();
  expect(pointerCancelled).toEqual({
    ...keyboardCancelled,
    commands: expect.arrayContaining(['Close']),
  });
  await page.screenshot({ path: '.artifacts/test-results/market-purchase-cleared-1000x560.png' });

  await clickMarketTarget('card:0');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.armed === true);
  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.input.gamepad.emit('down', route.input.gamepad.pad1, { index: 1 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.armed === false);
  expect(await marketDecision()).toEqual(pointerCancelled);

  const sectionSwitchBaseline = await marketSectionState();
  await clickMarketTarget('card:0');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.armed === true);
  await clickMarketTab('Crew Cards');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.armed === false);
  const sameSectionClear = await marketSectionState();
  expect(sameSectionClear).toMatchObject({
    category: 'cards',
    focusId: 'card:0',
    armedId: undefined,
    scrap: sectionSwitchBaseline.scrap,
    deckIds: sectionSwitchBaseline.deckIds,
    sold: sectionSwitchBaseline.sold,
    // Clearing confirmation retains the fixed rules dossier for the focused offer.
    hoverOpen: true,
    ring: { ...sameSectionClear.target, strokeColor: 0x8df4ff },
    commands: expect.arrayContaining(['Close']),
  });
  expect(sameSectionClear.commands).not.toContain('Clear');
  await page.screenshot({ path: '.artifacts/test-results/market-same-section-tab-cleared-1000x560.png' });

  await clickMarketTarget('card:0');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.armed === true);
  await clickMarketTab('Waymarks');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.category === 'waymarks');
  const pointerSectionSwitch = await marketSectionState();
  expect(pointerSectionSwitch).toMatchObject({
    category: 'waymarks',
    armedId: undefined,
    scrap: sectionSwitchBaseline.scrap,
    deckIds: sectionSwitchBaseline.deckIds,
    sold: sectionSwitchBaseline.sold,
    hoverOpen: false,
    ring: { ...pointerSectionSwitch.target, strokeColor: 0x8df4ff },
    commands: expect.arrayContaining(['Close']),
  });
  expect(pointerSectionSwitch.focusId).toMatch(/^waymark:/);
  expect(pointerSectionSwitch.commands).not.toContain('Clear');
  await page.screenshot({ path: '.artifacts/test-results/market-section-switch-pointer-1000x560.png' });

  await page.keyboard.press('1');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.category === 'cards');
  await clickMarketTarget('card:0');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.armed === true);
  await page.keyboard.press('3');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.category === 'supplies');
  const keyboardSectionSwitch = await marketSectionState();
  expect(keyboardSectionSwitch).toMatchObject({
    category: 'supplies',
    armedId: undefined,
    scrap: sectionSwitchBaseline.scrap,
    deckIds: sectionSwitchBaseline.deckIds,
    sold: sectionSwitchBaseline.sold,
    hoverOpen: false,
    ring: { ...keyboardSectionSwitch.target, strokeColor: 0x8df4ff },
    commands: expect.arrayContaining(['Close']),
  });
  expect(keyboardSectionSwitch.focusId).toMatch(/^utility:/);
  expect(keyboardSectionSwitch.commands).not.toContain('Clear');

  await clickMarketTarget(keyboardSectionSwitch.focusId);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.armed === true);
  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.input.gamepad.emit('down', route.input.gamepad.pad1, { index: 5 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.category === 'services');
  const controllerSectionSwitch = await marketSectionState();
  expect(controllerSectionSwitch).toMatchObject({
    category: 'services',
    armedId: undefined,
    scrap: sectionSwitchBaseline.scrap,
    deckIds: sectionSwitchBaseline.deckIds,
    sold: sectionSwitchBaseline.sold,
    hoverOpen: false,
    ring: { ...controllerSectionSwitch.target, strokeColor: 0x8df4ff },
    commands: expect.arrayContaining(['Close']),
  });
  expect(controllerSectionSwitch.commands).not.toContain('Clear');
  await page.screenshot({ path: '.artifacts/test-results/market-section-switch-controller-1000x560.png' });

  await page.keyboard.press('1');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.category === 'cards');

  await clickMarketTarget('card:0');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.armed === true);
  await clickMarketTarget('card:0');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.cardOffers.filter((offer: any) => offer.sold).length === 2);
  const pointerPurchase = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return {
      routeCommitCalls: route.routeCommitCalls,
      sold: route.marketCardShelf.map((offer: any) => !!offer.sold),
      deckIds: route.runState.deck.map((card: any) => card.id),
    };
  });
  expect(pointerPurchase.routeCommitCalls).toBe(0);
  expect(pointerPurchase.sold).toEqual([true, true, false, false]);
  expect(pointerPurchase.deckIds).toEqual(expect.arrayContaining(initial.offerIds.slice(0, 2)));
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.market.unavailableOffers.filter((offer: any) => offer.reason === 'SOLD OUT').length;
  })).toBe(2);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('SOLD OUT');
  await page.screenshot({ path: '.artifacts/test-results/market-sold-spoken-inventory-1000x560.png' });

  await page.keyboard.press('2');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.category === 'waymarks');
  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.input.gamepad.emit('down', route.input.gamepad.pad1, { index: 5 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.category === 'supplies');
  const suppliesBefore = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.runState.supplies.length;
  });
  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.controllerButtonsDown.clear();
    route.cardHoverDetailModule.updateRouteRewardGamepad(route, {
      left: false, right: true, up: false, down: false, A: false,
    }, route.controllerButtonsDown);
    route.controllerButtonsDown.clear();
    route.cardHoverDetailModule.updateRouteRewardGamepad(route, {
      left: false, right: false, up: false, down: false, A: true,
    }, route.controllerButtonsDown);
  });
  await page.waitForFunction((before) => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.runState.supplies.length === before + 1;
  }, suppliesBefore);
  const controllerPurchase = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return {
      category: route.marketCategory,
      supplies: route.runState.supplies.length,
      routeCommitCalls: route.routeCommitCalls,
    };
  });
  expect(controllerPurchase).toEqual({
    category: 'supplies',
    supplies: suppliesBefore + 1,
    routeCommitCalls: 0,
  });

  const mixedBaseline = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.marketCardShelf.forEach((offer: any, index: number) => {
      offer.price = 40 + index * 40;
      offer.sold = false;
    });
    route.runState.scrap = 100;
    route.marketCategory = 'cards';
    route.marketFocusId = undefined;
    route.marketFocusArmedId = undefined;
    route.renderAll();
    const disabled = route.children.list
      .filter((child: any) => child.input?.enabled && child.getData?.('marketAvailable') === false)
      .sort((a: any, b: any) => a.x - b.x)[0];
    if (!disabled) throw new Error('Missing mixed-shelf unavailable inspection target');
    return {
      disabled: { x: disabled.x, y: disabled.y },
      scrap: route.runState.scrap,
      deckIds: route.runState.deck.map((card: any) => card.id),
      sold: route.marketCardShelf.map((offer: any) => !!offer.sold),
      input: JSON.parse(window.render_game_to_text!()).market.input,
    };
  });
  expect(mixedBaseline.input).toMatchObject({
    focusId: 'card:0',
    index: 0,
    count: 4,
    armed: false,
    focusVisible: true,
  });
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.focusId === 'card:1');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.focusId === 'card:2');
  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.controllerButtonsDown.clear();
    route.cardHoverDetailModule.updateRouteRewardGamepad(route, {
      left: true, right: false, up: false, down: false, A: false,
    }, route.controllerButtonsDown);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.focusId === 'card:1');
  const mixedCanvas = await page.locator('canvas').boundingBox();
  if (!mixedCanvas) throw new Error('Missing game canvas');
  const mixedDisabledPoint = {
    x: mixedCanvas.x + mixedCanvas.width * (mixedBaseline.disabled.x / 1280),
    y: mixedCanvas.y + mixedCanvas.height * (mixedBaseline.disabled.y / 720),
  };
  await page.mouse.move(mixedDisabledPoint.x, mixedDisabledPoint.y);
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text!());
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return state.market.input.focusId === 'card:2'
      && state.market.input.focusVisible === true
      && Boolean(route.hoverCardDetail?.active);
  });
  const mixedHover = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const ring = route.children.list.find((child: any) => child.name === 'market-input-focus-ring');
    return {
      sceneFocusId: route.marketFocusId,
      input: JSON.parse(window.render_game_to_text!()).market.input,
      ringVisible: ring?.visible,
      hoverOpen: Boolean(route.hoverCardDetail?.active),
      inspectionZone: route.cardHoverDetailRequest?.zone,
      decisionPreview: JSON.parse(window.render_game_to_text!()).market.decisionPreview,
    };
  });
  expect(mixedHover).toMatchObject({
    sceneFocusId: 'card:2',
    input: { focusId: 'card:2', count: 4, available: false, armed: false, focusVisible: true },
    ringVisible: true,
    hoverOpen: true,
    inspectionZone: 'Market / 120 Scrap to buy',
    decisionPreview: ['NEED 20 MORE SCRAP'],
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('Unavailable in this section');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('NEED 20 MORE SCRAP');
  await page.screenshot({ path: '.artifacts/test-results/market-mixed-shelf-inspection-1000x560.png' });
  await page.mouse.click(mixedDisabledPoint.x, mixedDisabledPoint.y);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.input.focusId === 'card:2');
  await page.keyboard.press('Enter');
  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.controllerButtonsDown.clear();
    route.cardHoverDetailModule.updateRouteRewardGamepad(route, {
      left: false, right: false, up: false, down: false, A: true,
    }, route.controllerButtonsDown);
  });
  const mixedAfterDisabledConfirm = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return {
      scrap: route.runState.scrap,
      deckIds: route.runState.deck.map((card: any) => card.id),
      sold: route.marketCardShelf.map((offer: any) => !!offer.sold),
      armedId: route.marketFocusArmedId,
      input: JSON.parse(window.render_game_to_text!()).market.input,
    };
  });
  expect(mixedAfterDisabledConfirm).toEqual({
    scrap: mixedBaseline.scrap,
    deckIds: mixedBaseline.deckIds,
    sold: mixedBaseline.sold,
    armedId: undefined,
    input: expect.objectContaining({ focusId: 'card:2', index: 2, count: 4, available: false, armed: false, focusVisible: true }),
  });
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => {
    const input = JSON.parse(window.render_game_to_text!()).market.input;
    return input.focusId === 'card:3' && input.focusVisible === true;
  });
  await page.mouse.move(mixedCanvas.x + 4, mixedCanvas.y + 4);

  const fullSupply = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const capacity = Number(JSON.parse(window.render_game_to_text!()).routeStatus.supplies.split('/')[1]);
    const supplyId = route.marketUtilityShelf.find((offer: any) => offer.supplyId)?.supplyId ?? 'supply_bell';
    route.runState.supplies = Array.from({ length: capacity }, () => supplyId);
    route.runState.scrap = 999;
    route.marketCategory = 'supplies';
    route.marketFocusId = undefined;
    route.marketFocusArmedId = undefined;
    route.renderAll();
    const target = route.children.list.find((child: any) => (
      child.input?.enabled && child.getData?.('marketAvailable') === false
    ));
    if (!target) throw new Error('Missing full-pouch Supply inspection target');
    const bounds = target.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  });
  await page.mouse.move(
    mixedCanvas.x + mixedCanvas.width * (fullSupply.x / 1280),
    mixedCanvas.y + mixedCanvas.height * (fullSupply.y / 720),
  );
  await page.waitForFunction(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return Boolean(route.marketItemHover?.active);
  });
  const fullSupplyDetail = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return [...route.marketItemHover.list, route.children.getByName('market-input-help-text')]
      .filter((child: any) => child.type === 'Text')
      .map((child: any) => child.text)
      .join('\n');
  });
  expect(fullSupplyDetail).toContain('SUPPLY POUCH FULL');
  expect(fullSupplyDetail).not.toMatch(/SUPPLIES \d+\/\d+ >/);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('SUPPLY POUCH FULL');
  await page.screenshot({ path: '.artifacts/test-results/market-full-supply-reason-1000x560.png' });
  await page.mouse.move(mixedCanvas.x + 4, mixedCanvas.y + 4);

  const noPreen = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.runState.deck.forEach((entry: any) => { entry.upgraded = true; });
    route.marketCategory = 'services';
    route.marketFocusId = undefined;
    route.marketFocusArmedId = undefined;
    route.renderAll();
    const target = route.children.list.find((child: any) => (
      child.input?.enabled
      && child.getData?.('marketAvailable') === false
      && child.getData?.('label') === 'Preen a Card'
    ));
    if (!target) throw new Error('Missing no-eligible-card Preen inspection target');
    const bounds = target.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  });
  await page.mouse.move(
    mixedCanvas.x + mixedCanvas.width * (noPreen.x / 1280),
    mixedCanvas.y + mixedCanvas.height * (noPreen.y / 720),
  );
  await page.waitForFunction(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return Boolean(route.marketItemHover?.active);
  });
  const noPreenDetail = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return [...route.marketItemHover.list, route.children.getByName('market-input-help-text')]
      .filter((child: any) => child.type === 'Text')
      .map((child: any) => child.text)
      .join('\n');
  });
  expect(noPreenDetail).toContain('NO ELIGIBLE CARD');
  expect(noPreenDetail).not.toContain('CHOOSE CARD FIRST');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('Preen a Card, NO ELIGIBLE CARD');
  await page.screenshot({ path: '.artifacts/test-results/market-no-eligible-service-reason-1000x560.png' });
  await page.mouse.move(mixedCanvas.x + 4, mixedCanvas.y + 4);

  const unavailableWaymark = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.runState.scrap = 0;
    route.marketCategory = 'waymarks';
    route.marketFocusId = undefined;
    route.marketFocusArmedId = undefined;
    route.renderAll();
    const target = route.children.list.find((child: any) => (
      child.input?.enabled && child.getData?.('marketAvailable') === false
    ));
    if (!target) throw new Error('Missing unaffordable Waymark inspection target');
    const listing = route.marketWaymarkShelf.find((offer: any) => !offer.sold);
    return { x: target.x, y: target.y, shortfall: listing.price };
  });
  await page.mouse.move(
    mixedCanvas.x + mixedCanvas.width * (unavailableWaymark.x / 1280),
    mixedCanvas.y + mixedCanvas.height * (unavailableWaymark.y / 720),
  );
  await page.waitForFunction(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return Boolean(route.marketItemHover?.active);
  });
  const unavailableWaymarkDetail = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return [...route.marketItemHover.list, route.children.getByName('market-input-help-text')]
      .filter((child: any) => child.type === 'Text')
      .map((child: any) => child.text)
      .join('\n');
  });
  expect(unavailableWaymarkDetail).toContain(`NEED ${unavailableWaymark.shortfall} MORE SCRAP`);
  expect(unavailableWaymarkDetail).not.toMatch(/WAYMARKS \d+ > /);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain(`NEED ${unavailableWaymark.shortfall} MORE SCRAP`);
  await page.screenshot({ path: '.artifacts/test-results/market-unavailable-waymark-reason-1000x560.png' });
  await page.mouse.move(mixedCanvas.x + 4, mixedCanvas.y + 4);

  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.runState.scrap = 0;
    route.renderAll();
  });
  await page.keyboard.press('1');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).market.category === 'cards');
  const unavailableBaseline = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const unavailable = route.children.list.find((child: any) => (
      child.input?.enabled && child.getData?.('marketAvailable') === false
    ));
    if (!unavailable) throw new Error('Missing unavailable Market inspection target');
    return {
      target: { x: unavailable.x, y: unavailable.y },
      scrap: route.runState.scrap,
      deckIds: route.runState.deck.map((card: any) => card.id),
      sold: route.marketCardShelf.map((offer: any) => !!offer.sold),
      input: JSON.parse(window.render_game_to_text!()).market.input,
      actionableTargets: route.children.list.filter((child: any) => (
        child.input?.enabled && typeof child.getData?.('marketFocusId') === 'string' && child.getData('marketAvailable') !== false
      )).length,
    };
  });
  expect(unavailableBaseline).toMatchObject({
    scrap: 0,
    input: { focusId: 'card:0', count: 4, available: false, armed: false, focusVisible: true },
    actionableTargets: 0,
  });
  const unavailableCanvas = await page.locator('canvas').boundingBox();
  if (!unavailableCanvas) throw new Error('Missing game canvas');
  await page.mouse.click(
    unavailableCanvas.x + unavailableCanvas.width * (unavailableBaseline.target.x / 1280),
    unavailableCanvas.y + unavailableCanvas.height * (unavailableBaseline.target.y / 720),
  );
  await page.keyboard.press('Enter');
  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.controllerButtonsDown.clear();
    route.cardHoverDetailModule.updateRouteRewardGamepad(route, {
      left: false, right: false, up: false, down: false, A: true,
    }, route.controllerButtonsDown);
  });
  const unavailableAfterInputs = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return {
      scrap: route.runState.scrap,
      deckIds: route.runState.deck.map((card: any) => card.id),
      sold: route.marketCardShelf.map((offer: any) => !!offer.sold),
      armedId: route.marketFocusArmedId,
      hoverOpen: Boolean(route.hoverCardDetail?.active),
      focusRings: route.children.list.filter((child: any) => child.name === 'market-input-focus-ring').length,
      help: route.children.list
        .filter((child: any) => child.name === 'market-input-help-text' && child.type === 'Text')
        .map((child: any) => child.text),
      commands: route.children.list
        .filter((child: any) => child.name === 'market-enamel-button-hit' && child.input?.enabled)
        .map((child: any) => child.getData('label')),
    };
  });
  expect(unavailableAfterInputs).toEqual({
    scrap: unavailableBaseline.scrap,
    deckIds: unavailableBaseline.deckIds,
    sold: unavailableBaseline.sold,
    armedId: undefined,
    hoverOpen: true,
    focusRings: 1,
    help: [expect.stringMatching(/^\d+ Scrap · Have \d+ · NEED \d+ MORE SCRAP$/)],
    commands: expect.arrayContaining(['Close']),
  });
  expect(unavailableAfterInputs.commands).not.toContain('Clear');
  await page.screenshot({ path: '.artifacts/test-results/market-unavailable-inspection-1000x560.png' });

  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.input.gamepad.emit('down', route.input.gamepad.pad1, { index: 1 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).marketOpen === false);
});

test('market shelves stock multiple finite offers and paid refreshes', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 160; i += 1) {
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      if (state.assetReadiness?.fullArt) break;
      await wait(50);
    }
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type !== 'boss');
    market.type = 'market';
    scene.openMarketNode(market);
    scene.runState.scrap = 999;
    const firstOffer = scene.marketCardOffer()?.id;
    for (let i = 0; i < 200 && !scene.routeSecondaryPresentationModule; i++) await wait(25);
    const beforeCardOffers = scene.marketCardOffers().map((offer: any) => ({ id: offer.id, price: offer.price, sold: !!offer.sold }));
    const beforeWaymarkOffers = scene.marketRouteMarkOffers().map((offer: any) => ({ id: offer.id, price: offer.price, sold: !!offer.sold }));
    const beforeSupplyOffers = scene.marketUtilityShelf
      .filter((offer: any) => offer.id === 'supply')
      .map((offer: any) => ({ id: offer.supplyId, price: offer.price, sold: !!offer.sold }));
    const beforeRefreshCost = scene.marketRefreshCost();
    scene.buyMarketCard();
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.marketSoldSlatFrame?.count >= 1) break;
      await wait(50);
    }
    const soldSlatAfterBuy = JSON.parse(window.render_game_to_text!()).marketSoldSlatFrame;
    const soldSlatFramesAfterBuy = scene.children.list
      .filter((child: any) => child?.texture?.key === 'ui-icon-market-sold-slat-frame')
      .map((child: any) => ({
        name: child.name,
        x: Math.round(child.x),
        y: Math.round(child.y),
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        angle: Math.round(child.angle),
        alpha: Number(child.alpha.toFixed(2)),
        visible: child.visible
      }));
    const purchaseFlourishAfterBuy = JSON.parse(window.render_game_to_text!()).market.purchaseFlourish;
    const afterBuyOffer = scene.marketCardOffer()?.id ?? '';
    const afterCardOffers = scene.marketCardOffers().map((offer: any) => ({ id: offer.id, price: offer.price, sold: !!offer.sold }));
    const deckHasOffer = scene.runState.deck.some((card: any) => card.id === firstOffer);
    const collectionRecord = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').cardCollection?.[firstOffer];
    const scrapAfterBuy = scene.runState.scrap;
    scene.refreshMarket();
    const purchaseFlourishAfterRefresh = JSON.parse(window.render_game_to_text!()).market.purchaseFlourish;
    const refreshedCardOffers = scene.marketCardOffers().map((offer: any) => ({ id: offer.id, price: offer.price, sold: !!offer.sold }));
    return {
      firstOffer,
      beforeCardOffers,
      beforeWaymarkOffers,
      beforeSupplyOffers,
      beforeRefreshCost,
      afterBuyOffer,
      afterCardOffers,
      deckHasOffer,
      collectionRecord,
      scrapAfterBuy,
      scrapAfterRefresh: scene.runState.scrap,
      refreshCount: scene.marketRefreshCount,
      refreshedCardOffers,
      soldSlatAfterBuy,
      soldSlatFramesAfterBuy,
      purchaseFlourishAfterBuy,
      purchaseFlourishAfterRefresh
    };
  });
  expect(result.firstOffer).toBeTruthy();
  expect(result.beforeCardOffers).toHaveLength(4);
  expect(result.beforeWaymarkOffers).toHaveLength(3);
  expect(result.beforeSupplyOffers).toHaveLength(3);
  expect(new Set(result.beforeCardOffers.map((offer: any) => offer.price)).size).toBeGreaterThan(1);
  expect(result.deckHasOffer).toBe(true);
  expect(result.collectionRecord).toMatchObject({ timesClaimed: 1, firstSource: 'market' });
  expect(result.afterCardOffers.filter((offer: any) => offer.sold)).toHaveLength(1);
  expect(result.afterBuyOffer).toBeTruthy();
  expect(result.afterBuyOffer).not.toBe(result.firstOffer);
  expect(result.soldSlatAfterBuy).toEqual(expect.objectContaining({
    loaded: true,
    rendered: true,
    count: expect.any(Number)
  }));
  expect(result.soldSlatAfterBuy.count).toBeGreaterThanOrEqual(1);
  expect(result.soldSlatFramesAfterBuy).toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: 'market-sold-slat-frame',
      width: 194,
      height: 58,
      angle: -16,
      visible: true
    })
  ]));
  expect(result.purchaseFlourishAfterBuy.loaded).toBe(true);
  expect(result.purchaseFlourishAfterBuy.rendered).toBe(true);
  expect(result.purchaseFlourishAfterBuy.bursts).toBeGreaterThanOrEqual(1);
  expect(result.refreshCount).toBe(1);
  expect(result.scrapAfterRefresh).toBe(result.scrapAfterBuy - result.beforeRefreshCost);
  expect(result.refreshedCardOffers.every((offer: any) => !offer.sold)).toBe(true);
  expect(result.purchaseFlourishAfterRefresh.loaded).toBe(true);
  expect(result.purchaseFlourishAfterRefresh.rendered).toBe(true);
  expect(result.purchaseFlourishAfterRefresh.bursts).toBeGreaterThanOrEqual(2);
});

test('late markets sell premium boss-prep and route-scout services', async ({ page }, info) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {
      runState: {
        deck: [{ id: 'major_00' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'late-market-prep-test',
        currentHp: 36,
        scrap: 999,
        routeMarks: [],
        supplies: [],
        mapIndex: 2,
        completedRouteNodeIds: [],
        currentRouteNodeId: undefined,
        routeLog: [],
        nextCombat: undefined,
        signalChoices: [],
        rewardEvents: [],
        suppliesUsed: [],
        combatResults: [],
        freePreenNextDistrict: 0
      }
    });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type !== 'boss');
    market.type = 'market';
    scene.openMarketNode(market);
    scene.marketCategory = 'services';
    scene.renderAll();

    const bossIndex = scene.marketUtilityShelf.findIndex((offer: any) => offer.id === 'boss_guard');
    const scoutIndex = scene.marketUtilityShelf.findIndex((offer: any) => offer.id === 'route_scout');
    const beforeScrap = scene.runState.scrap;
    const bossPrice = scene.marketUtilityShelf[bossIndex]?.price ?? 0;
    const scoutPrice = scene.marketUtilityShelf[scoutIndex]?.price ?? 0;
    const serviceKeys = [
      'ui-icon-market-boss-rigging-service',
      'ui-icon-market-route-plan-service',
      'ui-icon-market-refresh-service',
      'ui-icon-scrap-gear'
    ];
    for (let i = 0; i < 80; i += 1) {
      const ready = serviceKeys.every((key) => scene.textures.exists(key)
        && (key === 'ui-icon-scrap-gear' || scene.children.list.some((child: any) => child.texture?.key === key)));
      if (ready) break;
      await wait(50);
    }
    const textureState = Object.fromEntries(serviceKeys.map((key) => [key, {
      loaded: scene.textures.exists(key),
      rendered: scene.children.list.some((child: any) => child.texture?.key === key)
    }]));
    const shelfAssetKeys = scene.marketShelfArtAssets().map((asset: any) => asset?.key).filter(Boolean);
    if (bossIndex >= 0) scene.buyMarketUtility(bossIndex);
    if (scoutIndex >= 0) scene.buyMarketUtility(scoutIndex);

    return {
      bossIndex,
      scoutIndex,
      bossPrice,
      scoutPrice,
      scrapDelta: beforeScrap - scene.runState.scrap,
      nextCombat: scene.runState.nextCombat,
      routeLog: scene.runState.routeLog,
      textureState,
      shelfAssetKeys,
      serviceIds: scene.marketUtilityShelf.map((offer: any) => offer.id),
      renderedIcons: scene.children.list.filter((child: any) => child.texture?.key?.includes('service')).map((child: any) => child.texture.key),
      sold: scene.marketUtilityShelf
        .filter((offer: any) => offer.id === 'boss_guard' || offer.id === 'route_scout')
        .map((offer: any) => ({ id: offer.id, sold: !!offer.sold }))
    };
  });

  expect(result.bossIndex).toBeGreaterThanOrEqual(0);
  await info.attach('market-services', { body: JSON.stringify(result), contentType: 'application/json' });
  expect(result.scoutIndex).toBeGreaterThanOrEqual(0);
  expect(result.scrapDelta).toBe(result.bossPrice + result.scoutPrice);
  expect(result.nextCombat.openSkyGuard).toBe(2);
  expect(result.nextCombat.bossDamageShield).toBe(18);
  expect(result.routeLog.some((entry: string) => entry.startsWith('Route plan set:'))).toBe(true);
  expect(result.textureState['ui-icon-market-boss-rigging-service']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-route-plan-service']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-refresh-service']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-scrap-gear']).toEqual({ loaded: true, rendered: false }); // Prices spell out Scrap.
  expect(result.shelfAssetKeys).toContain('ui-icon-market-boss-rigging-service');
  expect(result.shelfAssetKeys).toContain('ui-icon-market-route-plan-service');
  expect(result.shelfAssetKeys).toContain('ui-icon-market-refresh-service');
  expect(result.sold).toEqual(expect.arrayContaining([
    { id: 'boss_guard', sold: true },
    { id: 'route_scout', sold: true }
  ]));
});

test('market preen service lets the player choose a card before paying', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    scene.runState.scrap = 999;
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type !== 'boss');
    market.type = 'market';
    scene.openMarketNode(market);
    const preenIndex = scene.marketUtilityShelf.findIndex((offer: any) => offer.id === 'preen');
    if (preenIndex < 0) return { missing: true };
    const shelfPrice = scene.marketUtilityShelf[preenIndex].price;
    const scrapBeforeOpen = scene.runState.scrap;
    scene.buyMarketUtility(preenIndex);
    const pickerMode = scene.cardPickerMode;
    const pickerContext = scene.cardPickerContext;
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (
        scene.children.getByName('card-picker-price')
        && scene.children.getByName('card-picker-back-label')
      ) break;
      await wait(50);
    }
    const pickerState = JSON.parse(window.render_game_to_text!());
    const pickerFrameState = pickerState.cardPickerFrame;
    const pickerCostBadgeState = pickerState.cardPickerCostBadge;
    const marketEnamelCommandFrameState = pickerState.marketEnamelCommandFrame;
    const marketCommandFrames = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-market-enamel-command-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
        visible: child.visible
      }));
    const hasBackToMarketLabel = scene.children.list
      .filter((child: any) => typeof child.text === 'string')
      .some((child: any) => child.text === 'Back to Market');
    const soldBeforePick = !!scene.marketUtilityShelf[preenIndex].sold;
    const scrapAfterOpen = scene.runState.scrap;
    const choice = scene.pickerEligibleCards('preen', 'market').find((entry: any) => scene.runState.scrap >= entry.cost);
    const decisionDeltas = pickerState.cardPickerDecisionDeltas;
    const decisionPreview = decisionDeltas[0];
    scene.applyCardPick(choice.index);
    return {
      missing: false,
      shelfPrice,
      chosenCost: choice.cost,
      pickerMode,
      pickerContext,
      soldBeforePick,
      scrapBeforeOpen,
      scrapAfterOpen,
      scrapAfterPick: scene.runState.scrap,
      upgraded: !!scene.runState.deck[choice.index].upgraded,
      soldAfterPick: !!scene.marketUtilityShelf[preenIndex].sold,
      shelfPriceAfterPick: scene.marketUtilityShelf[preenIndex].price,
      pickerCleared: !scene.cardPickerMode && !scene.cardPickerContext,
      pickerFrameState,
      pickerCostBadgeState,
      decisionPreview,
      decisionDeltas,
      marketEnamelCommandFrameState,
      marketCommandFrames,
      hasBackToMarketLabel
    };
  });
  expect(result.missing).toBe(false);
  expect(result.pickerMode).toBe('preen');
  expect(result.pickerContext).toBe('market');
  expect(result.pickerFrameState).toEqual(expect.objectContaining({
    rendered: false,
    count: 0,
    mode: 'preen',
    context: 'market'
  }));
  expect(result.pickerCostBadgeState).toEqual(expect.objectContaining({
    rendered: false,
    count: 0
  }));
  expect(result.decisionPreview).toMatch(/\n> /);
  expect(result.decisionDeltas).toContain(result.decisionPreview);
  expect(result.decisionDeltas.every((delta: string) => {
    const [before, after] = delta.split('\n> ');
    return !!before && !!after && before !== after;
  })).toBe(true);
  expect(result.marketEnamelCommandFrameState.rendered).toBe(result.marketEnamelCommandFrameState.count > 0);
  // Market's underlying controls remain, but the picker return is a quiet button.
  expect(result.hasBackToMarketLabel).toBe(true);
  expect(result.soldBeforePick).toBe(false);
  expect(result.scrapAfterOpen).toBe(result.scrapBeforeOpen);
  expect(result.upgraded).toBe(true);
  expect(result.soldAfterPick).toBe(true);
  expect(result.scrapAfterPick).toBe(result.scrapBeforeOpen - result.chosenCost);
  expect(result.shelfPriceAfterPick).toBe(result.chosenCost);
  expect(result.shelfPrice).toBeLessThanOrEqual(result.chosenCost);
  expect(result.pickerCleared).toBe(true);
});

test('market remove service lets the player choose which card leaves the deck', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    scene.runState.scrap = 999;
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type !== 'boss');
    market.type = 'market';
    scene.openMarketNode(market);
    const removeIndex = scene.marketUtilityShelf.findIndex((offer: any) => offer.id === 'release');
    if (removeIndex < 0) return { missing: true };
    const deckBefore = scene.runState.deck.length;
    const scrapBeforeOpen = scene.runState.scrap;
    scene.buyMarketUtility(removeIndex);
    const pickerMode = scene.cardPickerMode;
    const pickerContext = scene.cardPickerContext;
    const soldBeforePick = !!scene.marketUtilityShelf[removeIndex].sold;
    const scrapAfterOpen = scene.runState.scrap;
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.cardPickerDecisionDeltas?.length > 0) break;
      await wait(50);
    }
    const decisionDeltas = JSON.parse(window.render_game_to_text!()).cardPickerDecisionDeltas;
    const choice = scene.pickerEligibleCards('release', 'market').find((entry: any) => scene.runState.scrap >= entry.cost);
    scene.applyCardPick(choice.index);
    return {
      missing: false,
      chosenCost: choice.cost,
      pickerMode,
      pickerContext,
      soldBeforePick,
      scrapBeforeOpen,
      scrapAfterOpen,
      scrapAfterPick: scene.runState.scrap,
      deckBefore,
      deckAfter: scene.runState.deck.length,
      decisionDeltas,
      soldAfterPick: !!scene.marketUtilityShelf[removeIndex].sold,
      pickerCleared: !scene.cardPickerMode && !scene.cardPickerContext
    };
  });
  expect(result.missing).toBe(false);
  expect(result.pickerMode).toBe('release');
  expect(result.pickerContext).toBe('market');
  expect(result.soldBeforePick).toBe(false);
  expect(result.scrapAfterOpen).toBe(result.scrapBeforeOpen);
  expect(result.decisionDeltas.every((delta: string) => delta === `DECK ${result.deckBefore} > ${result.deckBefore - 1}`)).toBe(true);
  expect(result.deckAfter).toBe(result.deckBefore - 1);
  expect(result.soldAfterPick).toBe(true);
  expect(result.scrapAfterPick).toBe(result.scrapBeforeOpen - result.chosenCost);
  expect(result.pickerCleared).toBe(true);
});

test('route workbench decision deltas update after each committed removal', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const node = window.__birdSquadCurrentMap!().nodes.find((candidate: any) => candidate.type !== 'boss');
    scene.cardPickerMode = 'release';
    scene.cardPickerContext = 'route';
    scene.cardPickerRemainingPicks = 2;
    scene.nodeChoiceNodeId = node.id;
    scene.nodeChoiceOpen = false;
    scene.renderAll();
    const settle = async (expected: string) => {
      for (let i = 0; i < 40; i += 1) {
        const state = JSON.parse(window.render_game_to_text!());
        if (state.cardPickerDecisionDeltas?.length > 0 && state.cardPickerDecisionDeltas.every((delta: string) => delta === expected)) {
          return state.cardPickerDecisionDeltas;
        }
        await wait(50);
      }
      return JSON.parse(window.render_game_to_text!()).cardPickerDecisionDeltas;
    };
    const deckBefore = scene.runState.deck.length;
    const beforeDeltas = await settle(`DECK ${deckBefore} > ${deckBefore - 1}`);
    const choice = scene.pickerEligibleCards('release', 'route')[0];
    scene.applyCardPick(choice.index);
    const deckAfter = scene.runState.deck.length;
    const afterDeltas = await settle(`DECK ${deckAfter} > ${deckAfter - 1}`);
    return {
      deckBefore,
      deckAfter,
      beforeDeltas,
      afterDeltas,
      pickerMode: scene.cardPickerMode,
      remainingPicks: scene.cardPickerRemainingPicks,
    };
  });

  expect(result.beforeDeltas.length).toBeGreaterThan(0);
  expect(result.beforeDeltas.every((delta: string) => delta === `DECK ${result.deckBefore} > ${result.deckBefore - 1}`)).toBe(true);
  expect(result.deckAfter).toBe(result.deckBefore - 1);
  expect(result.afterDeltas.length).toBeGreaterThan(0);
  expect(result.afterDeltas.every((delta: string) => delta === `DECK ${result.deckAfter} > ${result.deckAfter - 1}`)).toBe(true);
  expect(result.pickerMode).toBe('release');
  expect(result.remainingPicks).toBe(1);
});

test('market overlay renders generated shopkeeper sign and counter kit', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    scene.runState.scrap = 999;
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes[0];
    market.type = 'market';
    scene.openMarketNode(market);
    scene.marketCategory = 'catalog';
    scene.renderAll();
    const keys = [
      'market-kit-background',
      'market-kit-shopkeeper-starling',
      'market-kit-sign',
      'market-kit-counter-wares',
      'ui-icon-market-offer-tray',
      'ui-icon-market-object-backplate-frame',
      'ui-icon-market-section-header-frame',
      'ui-icon-market-vendor-title-plaque',
      'ui-icon-market-supply-crate',
      'ui-icon-market-waymark-badge',
      'ui-icon-market-preen-service',
      'ui-icon-market-remove-service',
      'ui-icon-market-refresh-service',
      'ui-icon-market-service-button-frame',
      'ui-icon-market-item-label-frame',
      'ui-icon-market-card-price-tag-frame',
      'ui-icon-market-price-chip-frame',
      'ui-icon-scrap-gear'
    ];
    for (let i = 0; i < 80; i += 1) {
      const loaded = keys.every((key) => scene.textures.exists(key));
      const quietFrames = ['market-offer-tray', 'market-object-backplate-frame', 'market-service-button-frame', 'market-card-price-tag-frame', 'market-price-chip-frame'];
      const rendered = keys.filter(key => key !== 'ui-icon-market-section-header-frame' && !quietFrames.some(name => key === `ui-icon-${name}`))
        .every((key) => scene.children.list.some((child: any) => child.texture?.key === key));
      if (loaded && rendered) break;
      await wait(50);
    }
    const textureState = Object.fromEntries(keys.map((key) => [key, {
      loaded: scene.textures.exists(key),
      rendered: scene.children.list.some((child: any) => child.texture?.key === key)
    }]));
    const offerTrayTelemetry = JSON.parse(window.render_game_to_text!()).market.offerTray;
    const priceChipFrameTelemetry = JSON.parse(window.render_game_to_text!()).market.priceChipFrame;
    const serviceButtonFrameTelemetry = JSON.parse(window.render_game_to_text!()).market.serviceButtonFrame;
    const itemLabelFrameTelemetry = JSON.parse(window.render_game_to_text!()).market.itemLabelFrame;
    const cardPriceTagFrameTelemetry = JSON.parse(window.render_game_to_text!()).market.cardPriceTagFrame;
    const objectBackplateFrameTelemetry = JSON.parse(window.render_game_to_text!()).market.objectBackplateFrame;
    const sectionHeaderFrameTelemetry = JSON.parse(window.render_game_to_text!()).market.sectionHeaderFrame;
    const vendorTitlePlaqueTelemetry = JSON.parse(window.render_game_to_text!()).marketVendorTitlePlaque;
    const objectBackplateFrames = scene.children.list
      .filter((child: any) => child.name === 'market-object-backplate-frame' && child.type === 'Rectangle')
      .map((child: any) => ({
        name: child.name,
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        visible: child.visible
      }));
    const sectionHeaderFrames = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-market-section-header-frame')
      .map((child: any) => ({
        name: child.name,
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        visible: child.visible
      }));
    const vendorTitlePlaques = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-market-vendor-title-plaque')
      .map((child: any) => ({
        name: child.name,
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        visible: child.visible
      }));
    const serviceButtonFrames = scene.children.list
      .filter((child: any) => child.name === 'market-service-button-frame' && child.type === 'Rectangle')
      .map((child: any) => ({
        name: child.name,
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha.toFixed(2)),
        visible: child.visible
      }));
    const itemLabelFrames = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-market-item-label-frame')
      .map((child: any) => ({
        name: child.name,
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha.toFixed(2)),
        visible: child.visible
      }));
    const cardPriceTagFrames = scene.children.list
      .filter((child: any) => child.name === 'market-card-price-tag-frame' && child.type === 'Rectangle')
      .map((child: any) => ({
        name: child.name,
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha.toFixed(2)),
        visible: child.visible
      }));
    const shelfAssetKeys = scene.marketShelfArtAssets().map((asset: any) => asset?.key).filter(Boolean);
    const expectedServiceButtonFrames = scene.marketUtilityShelf.filter((offer: any) => offer.id !== 'supply').length + 1;
    const expectedItemLabelFrames = scene.marketWaymarkShelf.length
      + scene.marketUtilityShelf.filter((offer: any) => offer.id === 'supply').length;
    const expectedCardPriceTagFrames = scene.marketCardShelf.length;
    return {
      textureState,
      offerTrayTelemetry,
      offerTraySurfaces: scene.children.list.filter((child: any) => child.name === 'market-offer-tray' && child.type === 'Rectangle').length,
      priceChipFrameTelemetry,
      priceChipFrameSurfaces: scene.children.list.filter((child: any) => child.name === 'market-price-chip-frame' && child.type === 'Rectangle').length,
      serviceButtonFrameTelemetry,
      serviceButtonFrameSurfaces: scene.children.list.filter((child: any) => child.name === 'market-service-button-frame' && child.type === 'Rectangle').length,
      itemLabelFrameTelemetry,
      cardPriceTagFrameTelemetry,
      cardPriceTagFrameSurfaces: scene.children.list.filter((child: any) => child.name === 'market-card-price-tag-frame' && child.type === 'Rectangle').length,
      objectBackplateFrameTelemetry,
      objectBackplateFrameSurfaces: scene.children.list.filter((child: any) => child.name === 'market-object-backplate-frame' && child.type === 'Rectangle').length,
      sectionHeaderFrameTelemetry,
      vendorTitlePlaqueTelemetry,
      objectBackplateFrames,
      sectionHeaderFrames,
      quietHeaders: scene.children.list.filter((child:any)=>child.name==='market-section-surface')
        .map((child:any)=>({width:child.displayWidth,height:child.displayHeight,alpha:child.fillAlpha})),
      vendorTitlePlaques,
      serviceButtonFrames,
      itemLabelFrames,
      cardPriceTagFrames,
      expectedServiceButtonFrames,
      expectedItemLabelFrames,
      expectedCardPriceTagFrames,
      shelfAssetKeys,
      supplyShelfOffers: scene.marketUtilityShelf.filter((offer: any) => offer.id === 'supply').length,
      waymarkShelfOffers: scene.marketWaymarkShelf.length
    };
  });

  expect(result.textureState['market-kit-background']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['market-kit-shopkeeper-starling']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['market-kit-sign']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['market-kit-counter-wares']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-offer-tray']).toEqual({ loaded: true, rendered: false });
  expect(result.offerTrayTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.offerTraySurfaces).toBeGreaterThanOrEqual(10);
  expect(result.textureState['ui-icon-market-object-backplate-frame']).toEqual({ loaded: true, rendered: false });
  expect(result.objectBackplateFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.objectBackplateFrameSurfaces).toBeGreaterThanOrEqual(6);
  expect(result.objectBackplateFrames.every((frame: { name: string; width: number; height: number; visible: boolean }) => (
    frame.name === 'market-object-backplate-frame'
    && frame.width === 112
    && frame.height === 94
    && frame.visible
  ))).toBe(true);
  expect(result.textureState['ui-icon-market-section-header-frame']).toEqual({ loaded: true, rendered: false });
  expect(result.sectionHeaderFrameTelemetry).toMatchObject({ rendered: false, count: 0 });
  expect(result.sectionHeaderFrames).toEqual([]);
  expect(result.quietHeaders).toHaveLength(4);
  expect(result.quietHeaders.every((frame: { width: number; height: number; alpha: number }) => (
    frame.width >= 240 && frame.height === 52 && frame.alpha === 1
  ))).toBe(true);
  expect(result.textureState['ui-icon-market-vendor-title-plaque']).toEqual({ loaded: true, rendered: true });
  expect(result.vendorTitlePlaqueTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: 1 }));
  expect(result.vendorTitlePlaques).toEqual([
    expect.objectContaining({
      name: 'market-vendor-title-plaque',
      width: 500,
      height: 104,
      visible: true
    })
  ]);
  expect(result.textureState['ui-icon-market-supply-crate']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-waymark-badge']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-preen-service']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-remove-service']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-refresh-service']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-service-button-frame']).toEqual({ loaded: true, rendered: false });
  expect(result.serviceButtonFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.serviceButtonFrameSurfaces).toBe(result.expectedServiceButtonFrames);
  expect(result.serviceButtonFrames).toHaveLength(result.expectedServiceButtonFrames);
  expect(result.serviceButtonFrames.every((frame: { name: string; width: number; height: number; alpha: number; visible: boolean }) => (
    frame.name === 'market-service-button-frame'
    && frame.width === 144
    && frame.height === 48
    && frame.alpha >= 0.9
    && frame.visible
  ))).toBe(true);
  expect(result.textureState['ui-icon-market-item-label-frame']).toEqual({ loaded: true, rendered: true });
  expect(result.itemLabelFrameTelemetry).toEqual({
    loaded: true,
    rendered: true,
    count: result.expectedItemLabelFrames
  });
  expect(result.itemLabelFrames).toHaveLength(result.expectedItemLabelFrames);
  expect(result.itemLabelFrames.every((frame: { name: string; width: number; height: number; alpha: number; visible: boolean }) => (
    frame.name === 'market-item-label-frame'
    && frame.width === 154
    && frame.height === 62
    && frame.alpha >= 0.9
    && frame.visible
  ))).toBe(true);
  expect(result.textureState['ui-icon-market-card-price-tag-frame']).toEqual({ loaded: true, rendered: false });
  expect(result.cardPriceTagFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.cardPriceTagFrameSurfaces).toBe(result.expectedCardPriceTagFrames);
  expect(result.cardPriceTagFrames).toHaveLength(result.expectedCardPriceTagFrames);
  expect(result.cardPriceTagFrames.every((frame: { name: string; width: number; height: number; alpha: number; visible: boolean }) => (
    frame.name === 'market-card-price-tag-frame'
    && frame.width === 122
    && frame.height === 26
    && frame.alpha >= 0.9
    && frame.visible
  ))).toBe(true);
  expect(result.textureState['ui-icon-market-price-chip-frame']).toEqual({ loaded: true, rendered: false });
  expect(result.priceChipFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.priceChipFrameSurfaces).toBeGreaterThanOrEqual(10);
  expect(result.textureState['ui-icon-scrap-gear']).toEqual({ loaded: true, rendered: true });
  expect(result.supplyShelfOffers).toBeGreaterThan(0);
  expect(result.waymarkShelfOffers).toBeGreaterThan(0);
  expect(result.shelfAssetKeys).toContain('ui-icon-market-supply-crate');
  expect(result.shelfAssetKeys).toContain('ui-icon-market-waymark-badge');
  expect(result.shelfAssetKeys).toContain('ui-icon-market-preen-service');
  expect(result.shelfAssetKeys).toContain('ui-icon-market-remove-service');
  expect(result.shelfAssetKeys).toContain('ui-icon-market-refresh-service');
  expect(result.shelfAssetKeys.some((key: string) => key.startsWith('supply-'))).toBe(false);
  expect(result.shelfAssetKeys.some((key: string) => key.startsWith('waymark-'))).toBe(false);
});

test('market item detail surfaces non-card offer stats', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const countTexture = (container: any, textureKey: string): number => (container?.list ?? []).reduce((sum: number, child: any) => {
      const self = child?.texture?.key === textureKey ? 1 : 0;
      const nested = child?.list ? countTexture(child, textureKey) : 0;
      return sum + self + nested;
    }, 0);
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    await wait(80);
    const route: any = g.scene.getScene('RouteScene');
    route.runState.scrap = 999;
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type !== 'boss');
    market.type = 'market';
    route.openMarketNode(market);
    await wait(120);
    const offer = route.marketRouteMarkOffers().find((candidate: any) => !candidate.sold);
    route.showMarketWaymarkDetail({
      ...offer,
      family: 'route',
      rarity: 'common',
      source: 'market',
      trigger: 'Market hover',
      effect: offer.text,
      description: offer.text
    }, offer.price, 510, 568);
    for (let i = 0; i < 40; i += 1) {
      if (route.marketItemHover?.getData('reading')) break;
      await wait(50);
    }
    const texts = (route?.marketItemHover?.list ?? [])
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text);
    const reader = route.marketItemHover;
    for (let i = 0; i < reader.getData('reading').total; i++) {
      texts.push(reader.getData('reading').text);
      reader.getData('turnRulesPage')(1);
    }
    return {
      texts,
      frameCount: countTexture(route.marketItemHover, 'ui-icon-market-detail-dossier-frame'),
      telemetry: JSON.parse(window.render_game_to_text!()).marketItemDetailFrame
    };
  });
  expect(result.texts.some((text: string) => /^Cost \d+ Scrap$/.test(text))).toBe(true);
  expect(result.texts.some((text: string) => text.toLowerCase().includes('waymark'))).toBe(true);
  expect(result.texts.some((text: string) => text.includes('Trigger:'))).toBe(true);
  expect(result.texts.some((text: string) => text.includes('Effect:'))).toBe(true);
  expect(result.frameCount).toBe(0);
  expect(result.telemetry).toEqual(expect.objectContaining({ loaded: true, rendered: false, count: 0 }));
});

test('every Market purchase previews the same primary deltas its commit resolves', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {
      runState: {
        deck: [{ id: 'major_00' }, { id: 'wands_ace' }],
        leaderId: 'fledgling', difficulty: 0, seed: 'market-preview-parity', runMode: 'full',
        currentHp: 36, scrap: 1500, routeMarks: ['ledger_tab'], supplies: [], mapIndex: 2,
        completedRouteNodeIds: [], currentRouteNodeId: undefined, routeLog: [], nextCombat: undefined,
        signalChoices: [], rewardEvents: [], routeDecisions: [], suppliesUsed: [], combatResults: [],
        freePreenNextDistrict: 0
      }
    });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const market = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type !== 'boss');
    market.type = 'market';
    scene.openMarketNode(market);
    scene.runState.scrap = 1500;

    const cardListing = scene.marketCardShelf[0];
    const cardBefore = {
      deck: scene.runState.deck.length,
      guard: scene.runState.nextCombat?.openSkyGuard ?? 0,
      skyCut: scene.runState.nextCombat?.reduceNextOpenSky ?? 0,
      scrap: scene.runState.scrap
    };
    const cardPreview = scene.marketCardDecisionPreview(cardListing);
    const card = scene.marketCardOffers()[0].card;
    scene.showHoverCardDetail(card, 'Market offer', cardListing.price, 650, 360, cardPreview);
    const cardRenderedPreview = JSON.parse(window.render_game_to_text!()).market.decisionPreview;
    scene.buyMarketCard(0);
    const cardAfter = {
      deck: scene.runState.deck.length,
      guard: scene.runState.nextCombat?.openSkyGuard ?? 0,
      skyCut: scene.runState.nextCombat?.reduceNextOpenSky ?? 0,
      scrap: scene.runState.scrap
    };

    const waymarkListing = scene.marketWaymarkShelf.find((listing: any) => !listing.sold);
    const waymarkOffer = scene.marketRouteMarkOffers().find((offer: any) => offer.id === waymarkListing.id);
    const waymarkBefore = { count: scene.runState.routeMarks.length, scrap: scene.runState.scrap };
    const waymarkPreview = scene.marketWaymarkDecisionPreview(waymarkListing);
    scene.showMarketWaymarkDetail({
      ...waymarkOffer,
      family: 'route', rarity: 'common', source: 'market', trigger: 'Market hover',
      effect: waymarkOffer.text, effects: [], description: waymarkOffer.text
    }, waymarkListing.price, 510, 568);
    const waymarkRenderedPreview = JSON.parse(window.render_game_to_text!()).market.decisionPreview;
    scene.buyMarketRouteMark(scene.marketWaymarkShelf.indexOf(waymarkListing));
    const waymarkAfter = { count: scene.runState.routeMarks.length, scrap: scene.runState.scrap };

    const supplyIndex = scene.marketUtilityShelf.findIndex((listing: any) => listing.id === 'supply' && !listing.sold);
    const supplyListing = scene.marketUtilityShelf[supplyIndex];
    const supplyBefore = {
      count: scene.runState.supplies.length,
      cap: JSON.parse(window.render_game_to_text!()).run.supplySlots,
      scrap: scene.runState.scrap
    };
    const supplyPreview = scene.marketUtilityDecisionPreview(supplyListing);
    scene.buyMarketUtility(supplyIndex);
    const supplyAfter = {
      count: scene.runState.supplies.length,
      cap: JSON.parse(window.render_game_to_text!()).run.supplySlots,
      scrap: scene.runState.scrap
    };

    const bossIndex = scene.marketUtilityShelf.findIndex((listing: any) => listing.id === 'boss_guard');
    const bossListing = scene.marketUtilityShelf[bossIndex];
    const bossBefore = {
      shield: scene.runState.nextCombat?.bossDamageShield ?? 0,
      guard: scene.runState.nextCombat?.openSkyGuard ?? 0,
      scrap: scene.runState.scrap
    };
    const bossPreview = scene.marketUtilityDecisionPreview(bossListing);
    scene.showMarketUtilityDetail(bossListing, 780, 300);
    const bossRenderedPreview = JSON.parse(window.render_game_to_text!()).market.decisionPreview;
    scene.buyMarketUtility(bossIndex);
    const bossAfter = {
      shield: scene.runState.nextCombat?.bossDamageShield ?? 0,
      guard: scene.runState.nextCombat?.openSkyGuard ?? 0,
      scrap: scene.runState.scrap
    };

    const scoutIndex = scene.marketUtilityShelf.findIndex((listing: any) => listing.id === 'route_scout');
    const scoutListing = scene.marketUtilityShelf[scoutIndex];
    const scoutBefore = {
      guard: scene.runState.nextCombat?.openSkyGuard ?? 0,
      skyCut: scene.runState.nextCombat?.reduceNextOpenSky ?? 0,
      scrap: scene.runState.scrap
    };
    const scoutPreview = scene.marketUtilityDecisionPreview(scoutListing);
    scene.buyMarketUtility(scoutIndex);
    const scoutAfter = {
      guard: scene.runState.nextCombat?.openSkyGuard ?? 0,
      skyCut: scene.runState.nextCombat?.reduceNextOpenSky ?? 0,
      scrap: scene.runState.scrap
    };

    const refreshBefore = { round: scene.marketRefreshCount, scrap: scene.runState.scrap };
    const refreshCost = scene.marketRefreshCost();
    const refreshPreview = scene.marketRefreshDecisionPreview(refreshCost);
    scene.showMarketRefreshDetail(refreshCost, 780, 560);
    const refreshRenderedPreview = JSON.parse(window.render_game_to_text!()).market.decisionPreview;
    scene.refreshMarket();
    const refreshAfter = { round: scene.marketRefreshCount, scrap: scene.runState.scrap };

    return {
      cardBefore, cardAfter, cardPreview, cardRenderedPreview,
      waymarkBefore, waymarkAfter, waymarkPreview, waymarkRenderedPreview,
      supplyBefore, supplyAfter, supplyPreview,
      bossBefore, bossAfter, bossPreview, bossRenderedPreview,
      scoutBefore, scoutAfter, scoutPreview,
      refreshBefore, refreshAfter, refreshPreview, refreshRenderedPreview
    };
  });

  expect(result.cardPreview).toEqual(result.cardRenderedPreview);
  expect(result.cardPreview).toContain(`DECK ${result.cardBefore.deck} > ${result.cardAfter.deck}`);
  expect(result.cardPreview).toContain(`SKY GUARD ${result.cardBefore.guard} > ${result.cardAfter.guard}`);
  expect(result.cardPreview).toContain(`OPEN SKY CUT ${result.cardBefore.skyCut} > ${result.cardAfter.skyCut}`);
  expect(result.cardPreview).toContain(`SCRAP ${result.cardBefore.scrap} > ${result.cardAfter.scrap}`);
  expect(result.waymarkPreview).toEqual(result.waymarkRenderedPreview);
  expect(result.waymarkPreview.some((row: string) => row.startsWith('WAYMARK'))).toBe(true);
  expect(result.waymarkPreview).toContain(`SCRAP ${result.waymarkBefore.scrap} > ${result.waymarkAfter.scrap}`);
  expect(result.waymarkAfter.count).toBe(result.waymarkBefore.count + 1);
  expect(result.supplyPreview).toContain(`SUPPLIES ${result.supplyBefore.count}/${result.supplyBefore.cap} > ${result.supplyAfter.count}/${result.supplyAfter.cap}`);
  expect(result.supplyPreview).toContain(`SCRAP ${result.supplyBefore.scrap} > ${result.supplyAfter.scrap}`);
  expect(result.bossPreview).toEqual(result.bossRenderedPreview);
  expect(result.bossPreview).toContain(`BOSS SHIELD ${result.bossBefore.shield} > ${result.bossAfter.shield}`);
  expect(result.bossPreview).toContain(`SKY GUARD ${result.bossBefore.guard} > ${result.bossAfter.guard}`);
  expect(result.bossPreview).toContain(`SCRAP ${result.bossBefore.scrap} > ${result.bossAfter.scrap}`);
  expect(result.scoutPreview).toContain(`SKY GUARD ${result.scoutBefore.guard} > ${result.scoutAfter.guard}`);
  expect(result.scoutPreview).toContain(`OPEN SKY CUT ${result.scoutBefore.skyCut} > ${result.scoutAfter.skyCut}`);
  expect(result.scoutPreview).toContain(`SCRAP ${result.scoutBefore.scrap} > ${result.scoutAfter.scrap}`);
  expect(result.refreshPreview).toEqual(result.refreshRenderedPreview);
  expect(result.refreshPreview).toContain(`STOCK ROUND ${result.refreshBefore.round} > ${result.refreshAfter.round}`);
  expect(result.refreshPreview).toContain(`SCRAP ${result.refreshBefore.scrap} > ${result.refreshAfter.scrap}`);
});
