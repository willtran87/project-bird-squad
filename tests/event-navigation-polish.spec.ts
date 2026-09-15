import { test, expect, type Page } from '@playwright/test';
import { flockLeaders } from '../src/game/leaders';
import { settleCanvas } from './helpers/settled-canvas';
import { screenReaderSummary } from '../src/game/screen-reader-summary';
import { readFileSync } from 'node:fs';
// Runtime signals merge the rooftop file with the three district content files.
const signalIds: string[] = ['alpha-signals', 'map02-content', 'map03-content', 'map04-content']
  .flatMap(file => JSON.parse(readFileSync(new URL(`../data/game/${file}.json`, import.meta.url), 'utf8')).signals.map((signal: any) => signal.id));

async function click(page: Page, name: string, index = 0) {
  const point = await page.evaluate(({ name, index }) => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const root = r.children.getByName('route-event-reader') ?? r.children;
    const o = root.list.filter((o: any) => o.name === name)[index];
    const b = o.getBounds(), c = r.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, { name, index });
  await page.mouse.click(point.x, point.y, { delay: 40 }); await settleCanvas(page);
}

for (const remapped of [false, true]) test(`event choices support complete reading and deliberate navigation, remapped=${remapped}`, async ({ page }, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (remapped) await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1,
    bindings: { confirm: 'Backspace', back: 'KeyB', previous: 'PageUp', next: 'PageDown', roost: 'Delete' } })));
  const keys = remapped ? { confirm: 'Backspace', next: 'PageDown', previous: 'PageUp', inspect: 'Delete', back: 'b' }
    : { confirm: 'Enter', next: 'ArrowRight', previous: 'ArrowLeft', inspect: 'r', back: 'Escape' };
  const press = async (key: string) => { await page.keyboard.press(key); await settleCanvas(page); };
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async deck => {
    const w = window as any, [blueprints, generate, hash] = w.__routeAudit;
    const types = ['basin', 'nest', 'signal', 'cache', 'rival'];
    const seed = Array.from({ length: 100 }, (_, i) => `event-clarity-${i}`)
      .find(seed => types.every(type => generate(blueprints[0], hash(seed, 0)).nodes.some((n: any) => n.type === type)))!;
    await w.__birdSquadEnsureScene('RouteScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('RouteScene', { runState: { seed, deck: deck.map(id => ({ id })), leaderId: 'fledgling',
      currentHp: 38, scrap: 0, completedRouteNodeIds: [], routeLog: [] } });
  }, flockLeaders.find(l => l.id === 'fledgling')!.startingDeckIds);
  await page.waitForFunction(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.routeEssentialAssetsReady && r.routeDebugStateModule;
  });
  const read = () => page.evaluate(() => JSON.parse((window as any).render_game_to_text()));
  const open = async (type: string) => {
    await page.evaluate(type => {
      const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
      r.openNodeChoices(w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === type));
    }, type); await settleCanvas(page);
  };
  for (const type of ['basin', 'nest', 'signal', 'cache', 'rival']) {
    await open(type);
    const original = (await read()).run;
    await press(keys.next);
    expect((await read()).nodeChoice.focus.index).toBe(1);
    const hintFit = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      const hint = r.children.getByName('route-event-input-hint').getBounds();
      const row = r.children.list.find((o: any) => o.name === 'route-choice-option-frame').getBounds();
      return hint.bottom <= row.top - 1 && hint.left >= row.left && hint.right <= row.right;
    });
    expect(hintFit).toBe(true);
    expect(screenReaderSummary(await read())).toContain('Focused 2 of');
    // Stationary pointer over another row must not steal input focus.
    await page.mouse.move(1, 1); await settleCanvas(page);
    expect((await read()).nodeChoice.focus.index).toBe(1);
    await press('Shift+Tab'); expect((await read()).nodeChoice.focus.index).toBe(0);
    await press('ArrowDown'); expect((await read()).nodeChoice.focus.index).toBe(1);
    await press(keys.inspect);
    expect((await read()).nodeChoice.focus.open).toBe(true);
    const sections = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      return r.eventChoiceSections(r.eventChoices()[1]);
    });
    const pages: Array<{ title: string; text: string }> = [];
    const count = (await read()).nodeChoice.focus.reading.total;
    for (let i = 0; i < count; i++) {
      const reading = (await read()).nodeChoice.focus.reading;
      pages.push(reading);
      expect(screenReaderSummary(await read())).toContain('Nothing is spent');
      const bounds = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
        const body = r.children.getByName('route-event-reader').getByName('route-event-reader-body');
        return { bottom: body.getBounds().bottom, right: body.getBounds().right, font: body.style.fontSize };
      });
      expect(bounds.bottom).toBeLessThanOrEqual(495); expect(bounds.right).toBeLessThanOrEqual(984); expect(bounds.font).toBe('22px');
      await press(keys.next);
    }
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
    for (const section of sections) expect(normalize(pages.filter(p => p.title === section.title).map(p => p.text).join(' '))).toBe(normalize(section.text));
    expect((await read()).run).toEqual(original);
    for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(viewport); await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`${type}-reader-${viewport.width}.png`) });
    }
    // Confirm in the reader only returns; it cannot activate the underlying row.
    await press(keys.confirm);
    expect((await read()).nodeChoice.focus.open).toBe(false);
    expect((await read()).nodeChoice.focus.index).toBe(1);
    expect((await read()).run).toEqual(original);
    await page.screenshot({ path: info.outputPath(`${type}-choices-1000.png`) });
    const locked = (await read()).nodeChoice.choices.findIndex((c: any) => c.locked);
    if (locked >= 0) {
      await click(page, 'route-event-details-hit', locked);
      expect((await read()).nodeChoice.focus.open).toBe(true);
      expect((await read()).run).toEqual(original);
      await click(page, 'route-event-reader-return');
      await press(keys.confirm); // unavailable confirm reads requirements, not effects
      expect((await read()).nodeChoice.focus.open).toBe(true);
      await press(keys.back);
    }
  }
  if (!remapped) {
    const catalog = await page.evaluate(ids => {
      const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
      const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'signal');
      const originalPayload = node.payloadId;
      const failures: string[] = [];
      let choicesRead = 0;
      const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
      try {
        for (const id of ids) {
          node.payloadId = id; r.openNodeChoices(node);
          const count = r.eventChoices().length;
          for (let index = 0; index < count; index++) {
            r.children.list.filter((o: any) => o.name === 'route-event-details-hit')[index].emit('pointerdown');
            const panel = r.children.getByName('route-event-reader');
            const state = JSON.parse(w.render_game_to_text()).nodeChoice.focus;
            const expected = r.eventChoiceSections(r.eventChoices()[index]).map((s: any) => s.text).join(' ');
            const texts: string[] = [];
            for (let p = 0; p < state.reading.total; p++) {
              const body = panel.getByName('route-event-reader-body'), bounds = body.getBounds();
              if (bounds.bottom > 495 || bounds.right > 984) failures.push(`${id}/${index}: text outside reader`);
              texts.push(body.text); panel.getData('turnPage')(1);
            }
            if (normalize(texts.join(' ')) !== normalize(expected)) failures.push(`${id}/${index}: missing text`);
            panel.getByName('route-event-reader-return').emit('pointerdown'); choicesRead++;
          }
        }
      } finally { node.payloadId = originalPayload; }
      return { signals: ids.length, choicesRead, failures };
    }, signalIds);
    expect(catalog.signals).toBe(38); expect(catalog.choicesRead).toBeGreaterThan(100); expect(catalog.failures).toEqual([]);
    console.log('Authored Signal reading audit:', JSON.stringify(catalog));
    await info.attach('authored-signal-reading-audit', { body: JSON.stringify(catalog, null, 2), contentType: 'application/json' });
  }
  // A future long localized option must remain complete, including locked
  // requirements. Exercise the production reader without mutating run data.
  await open('signal');
  const longText = 'The crew repairs the rooftop signal and keeps every route consequence visible. '.repeat(18).trim();
  await page.evaluate(longText => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.savedEventChoicesForTest = r.eventChoices;
    r.eventChoices = () => [{ key: 'locked-reading-stress', text: longText, effects: [], locked: true,
      lockedText: 'Requires the repaired switchboard and 120 Scrap. No payment will be taken.' }];
    r.renderAll();
  }, longText);
  await settleCanvas(page); await click(page, 'route-event-details-hit');
  const stressTotal = (await read()).nodeChoice.focus.reading.total;
  expect(stressTotal).toBeGreaterThan(2);
  const stressPages: string[] = [];
  for (let i = 0; i < stressTotal; i++) {
    stressPages.push((await read()).nodeChoice.focus.reading.text);
    const hits = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), panel = r.children.getByName('route-event-reader');
      const b = panel.getByName('route-event-reader-body').getBounds(), scale = r.game.canvas.getBoundingClientRect().width / 1280;
      return { bottom: b.bottom, sizes: panel.list.filter((o: any) => o.name.startsWith('route-event-reader-') && o.input).map((o: any) => ({ w: o.width * scale, h: o.height * scale })) };
    });
    expect(hits.bottom).toBeLessThanOrEqual(495);
    for (const hit of hits.sizes) { expect(hit.w).toBeGreaterThanOrEqual(44); expect(hit.h).toBeGreaterThanOrEqual(44); }
    await click(page, 'route-event-reader-next');
  }
  expect(stressPages.join(' ').replace(/\s+/g, ' ')).toContain(longText);
  expect(stressPages.join(' ')).toContain('120 Scrap');
  await page.screenshot({ path: info.outputPath('long-locked-reader-1000.png') });
  await press(keys.back);
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.eventChoices = r.savedEventChoicesForTest; delete r.savedEventChoicesForTest;
  });
  await open('cache');
  // Controller events select the device hint; navigation uses real scene polling.
  const pad = async (button: 'right' | 'A' | 'Y' | 'B', held = false) => {
    await page.evaluate(({ button, held }) => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), plugin = r.input.gamepad, saved = plugin._pad1;
      const fake: any = { connected: true, isButtonDown: () => false, [button]: true };
      try {
        plugin._pad1 = fake;
        plugin.emit('down', fake, { index: { right: 15, A: 0, Y: 3, B: 1 }[button] });
        r.update(); if (held) for (let i = 0; i < 20; i++) r.update();
        fake[button] = false; r.update();
      } finally { plugin._pad1 = saved; }
    }, { button, held }); await settleCanvas(page);
  };
  await pad('right', true); expect((await read()).nodeChoice.focus.index).toBe(1);
  await pad('Y'); expect((await read()).nodeChoice.focus.open).toBe(true);
  const totalPages = (await read()).nodeChoice.focus.reading.total;
  await pad('right'); expect((await read()).nodeChoice.focus.reading.page).toBe(totalPages > 1 ? 2 : 1);
  await pad('B'); expect((await read()).nodeChoice.focus.open).toBe(false);
  const prior = (await read()).run;
  // Pause and settings own inputs and direct stale choice callbacks.
  await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.pauseOverlayOpen = true; });
  await press(keys.next); await press(keys.confirm); await pad('Y');
  expect((await read()).nodeChoice.focus.index).toBe(1);
  await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.pauseOverlayOpen = false; r.settingsOverlayOpen = true; r.chooseNodeOption(r.eventChoices()[0].key); });
  expect((await read()).run).toEqual(prior);
  await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.settingsOverlayOpen = false; });
  await pad('A', true);
  await page.waitForFunction(() => Boolean(JSON.parse((window as any).render_game_to_text()).routeReward));
  expect((await read()).run).toEqual(prior);
  expect(errors).toEqual([]);
});
