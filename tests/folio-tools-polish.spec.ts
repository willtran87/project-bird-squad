import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { settleCanvas } from './helpers/settled-canvas';
import {targetGeometry,checkTargetGeometry} from './helpers/target-geometry';
import { screenReaderSummary } from '../src/game/screen-reader-summary';
test.use({ hasTouch: true });

const cards = JSON.parse(readFileSync(new URL('../data/game/alpha-cards.json', import.meta.url), 'utf8')) as { cards: { id: string }[] };

test('Deep Folio tools announce the visible change without rereading the whole deck', () => {
  const base = { open: true, source: { name: 'Source', revision: 3 }, selectedTarget: { id: 'parent', name: 'Parent', revision: 2 },
    changePage: 5, changeCount: 62, comparison: { cardChanges: Array.from({ length: 60 }, () => ({ current: { name: 'Hidden card' }, target: { name: 'Other hidden card' } })) } };
  for (const currentChange of [
    { label: 'Card 3 · replaced', current: 'First Flight', target: 'Plume Flash', currentCard: { upgraded: true }, targetCard: { upgraded: false } },
    { label: 'Leader change', current: 'The Spark-Caller', target: 'The Fledgling Flock' },
  ]) {
    const summary = screenReaderSummary({ mode: 'profile', savedFlightFolios: { revisionTrail: { ...base, currentChange } } });
    expect(summary).toContain(currentChange.label); expect(summary).toContain(currentChange.current); expect(summary).toContain(currentChange.target);
    expect(summary).toContain('Reviewing change 5 of 62'); expect(summary).not.toContain('Hidden card');
    if ('currentCard' in currentChange) { expect(summary).toContain('First Flight, Preened'); expect(summary).toContain('Plume Flash, Base'); }
  }
});

const sizes = [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }];
const state = (page: Page) => page.evaluate(() => JSON.parse((window as any).render_game_to_text()).savedFlightFolios);
const account = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account')!));
async function tap(page: Page, name: string, index = 0) {
  await settleCanvas(page);
  const p = await page.evaluate(({ name, index }) => {
    const scene = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
    const hit = scene.children.list.filter((o: any) => o.name === name && o.input?.enabled)[index];
    if (!hit) throw new Error(`Missing enabled ${name}`);
    const canvas = scene.game.canvas.getBoundingClientRect();
    return { x: canvas.x + hit.x * canvas.width / 1280, y: canvas.y + hit.y * canvas.height / 720 };
  }, { name, index });
  await page.touchscreen.tap(p.x, p.y); await settleCanvas(page);
}
async function capture(page: Page, info: TestInfo, key: string, prefix: string) {
  await settleCanvas(page);
  const result = await page.evaluate(prefix => {
    const scene = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
    const children = scene.children.list.slice(scene.children.list.findIndex((o: any) => o.name === `${prefix}-scrim`));
    const frame = scene.children.getByName(`${prefix}-frame`).getBounds();
    const scale = scene.game.canvas.getBoundingClientRect().width / 1280;
    const inside = (b: any) => b.left >= frame.left && b.top >= frame.top && b.right <= frame.right && b.bottom <= frame.bottom;
    const clear = (a: any, b: any) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
    const texts = children.filter((o: any) => o.type === 'Text' && o.visible);
    const hits = children.filter((o: any) => o.input?.enabled && o.name !== `${prefix}-scrim`);
    return {
      texts: texts.map((o: any) => ({ text: o.text, fits: inside(o.getBounds()), size: parseFloat(o.style.fontSize) * scale, primary: parseFloat(o.style.fontSize) >= 21 })),
      overlaps: texts.flatMap((a: any, i: number) => texts.slice(i + 1).filter((b: any) => !clear(a.getBounds(), b.getBounds())).map((b: any) => [a.text, b.text])),
      hits: hits.map((o: any) => ({ name: o.name, fits: inside(o.getBounds()), width: o.width * scale, height: o.height * scale })),
      hitOverlap: hits.some((a: any, i: number) => hits.slice(i + 1).some((b: any) => !clear(a.getBounds(), b.getBounds()))),
      art: children.filter((o: any) => o.type === 'Image').map((o: any) => ({ name: o.name, fits: inside(o.getBounds()), undistorted: Math.abs(o.scaleX - o.scaleY) < 0.0001 })),
    };
  }, prefix);
  for (const text of result.texts) {
    expect(text.fits, text.text).toBe(true); expect(text.size, text.text).toBeGreaterThanOrEqual(text.primary ? 16 : 14);
    expect(text.text).not.toMatch(/\b1 (revisions|changes|Folios)\b/);
  }
  expect(result.overlaps).toEqual([]); expect(result.hitOverlap).toBe(false);
  checkTargetGeometry(await targetGeometry(page,'ProfileScene'),'Folio tools');
  for (const hit of result.hits) { expect(hit.fits, hit.name).toBe(true); expect(hit.width, hit.name).toBeGreaterThanOrEqual(44); expect(hit.height, hit.name).toBeGreaterThanOrEqual(44); }
  for (const art of result.art) { expect(art.fits, art.name).toBe(true); expect(art.undistorted, art.name).toBe(true); }
  await page.screenshot({ path: info.outputPath(`${key}.png`) });
}
async function replaceAccount(page: Page, value: unknown) {
  await page.evaluate(value => {
    for (const key of ['birdsquad.account', 'birdsquad.account.backup']) localStorage.setItem(key, JSON.stringify(value));
    (window as any).__birdSquadGame.scene.getScene('ProfileScene').renderPremiumProfileScene();
  }, value); await settleCanvas(page);
}
test('Deep Folio tools preserve portrait space through delayed, failed and recovered art', async ({ page }, info) => {
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  let blocked = true, requests = 0;
  await page.route(/\/cups_elder-[^/]+\.webp$/, async route => {
    requests++;
    if (blocked) { await held; await route.abort(); } else await route.continue();
  });
  await page.addInitScript(() => {
    const value = { decks: [{ id: 'art-test', name: 'Portrait recovery', leaderId: 'fledgling',
      cards: [{ id: 'cups_elder', upgraded: false }], createdAt: 1, updatedAt: 1, runMode: 'quick' }] };
    for (const key of ['birdsquad.account', 'birdsquad.account.backup']) localStorage.setItem(key, JSON.stringify(value));
  });
  await page.setViewportSize(sizes[0]); await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('ProfileScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('ProfileScene');
  });
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('ProfileScene').cameras.main.fadeEffect.isRunning);
  await tap(page, 'profile-folios-tab-hit'); await tap(page, 'profile-folio-lab-hit');
  const portrait = () => page.evaluate(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
    const slot = s.children.getByName('profile-flight-lab-card-art-slot');
    return { bounds: [slot.x, slot.y, slot.width, slot.height], state: slot.getData('artState'),
      image: Boolean(s.children.getByName('profile-flight-lab-card-art')) };
  });
  try {
    await expect.poll(() => requests).toBeGreaterThan(0);
    expect(await portrait()).toMatchObject({ state: 'loading', image: false });
    const bounds = (await portrait()).bounds;
    await capture(page, info, 'portrait-delayed-2560', 'profile-flight-lab');
    release();
    await expect.poll(async () => (await portrait()).state).toBe('unavailable');
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').children
      .getByName('profile-flight-lab-card-art-status').getWrappedText())).toEqual(['Art', 'missing']);
    expect((await portrait()).bounds).toEqual(bounds);
    await capture(page, info, 'portrait-failed-2560', 'profile-flight-lab');
    blocked = false;
    await tap(page, 'profile-flight-lab-close-hit'); await tap(page, 'profile-folio-lab-hit');
    await expect.poll(async () => (await portrait()).state).toBe('ready');
    expect(await portrait()).toMatchObject({ bounds, image: true });
    await capture(page, info, 'portrait-recovered-2560', 'profile-flight-lab');
    await page.setViewportSize(sizes[2]); await capture(page, info, 'portrait-recovered-1000', 'profile-flight-lab');
  } finally { release(); }
});
for (const remapped of [false, true]) test(`Deep Folio tools keep all views readable and immutable, remapped=${remapped}`, async ({ page }, info) => {
  test.setTimeout(240_000); // Multi-screen, three-size matrix plus maximum-history traversal and write failures.
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const ids = cards.cards.map(card => card.id);
  await page.addInitScript(({ ids, remapped }) => {
    const deck = { id: 'deep-source', lineageId: 'deep-lineage', revision: 99, parentId: 'deep-parent-0',
      name: 'W'.repeat(32), leaderId: 'spark_caller', runMode: 'quick', createdAt: 10000, updatedAt: 10000,
      favorite: true, archived: false, sourceSeed: 'private',
      cards: ids.slice(0, 60).map((id, i) => ({ id, upgraded: i % 2 === 0 })) };
    const parents = Array.from({ length: 29 }, (_, i) => ({ ...deck, id: `deep-parent-${i}`, revision: i + 1,
      parentId: undefined, favorite: false, archived: i < 24, createdAt: i + 1, updatedAt: i + 1,
      leaderId: 'fledgling', runMode: 'full', cards: [...deck.cards].reverse().map(card => ({ ...card, upgraded: !card.upgraded })) }));
    const value = { unlockedLeaders: ['fledgling', 'spark_caller'], discoveredCards: ids, decks: [deck, ...parents],
      cardCollection: Object.fromEntries(ids.map((id, i) => [id, { firstAcquiredAt: 100 + i, timesClaimed: 1, firstSource: 'combat_reward' }])) };
    for (const key of ['birdsquad.account', 'birdsquad.account.backup']) localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem('birdsquad.screenReader', 'on');
    if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { previous: 'KeyJ', next: 'KeyK', confirm: 'KeyQ', back: 'KeyB' } }));
  }, { ids, remapped });
  await page.setViewportSize(sizes[0]); await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => { const w = window as any; await w.__birdSquadEnsureScene('ProfileScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('ProfileScene'); });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('ProfileScene') && !(window as any).__birdSquadGame.scene.getScene('ProfileScene').cameras.main.fadeEffect.isRunning);
  await tap(page, 'profile-folios-tab-hit'); await tap(page, 'profile-folio-lab-hit');
  const baseline = await account(page);
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const [section, hit] of [['hand', 'profile-flight-lab-view-0-hit'], ['study', 'profile-flight-lab-view-1-hit'], ['tools', 'profile-flight-lab-tools-hit']] as const) {
      await tap(page, hit); expect((await state(page)).flightLab.section).toBe(section);
      await capture(page, info, `lab-${section}-${size.width}`, 'profile-flight-lab');
    }
  }
  await tap(page, 'profile-flight-lab-view-0-hit');
  await page.keyboard.press('Tab');
  expect((await state(page)).flightLab.section).toBe('hand');
  await page.keyboard.press(remapped ? 'q' : 'Enter');
  expect((await state(page)).flightLab.section).toBe('study');
  await tap(page, 'profile-flight-lab-view-0-hit');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').input.gamepad.emit('down', {}, { index: 7 }));
  expect((await state(page)).flightLab.section).toBe('study');
  await page.keyboard.press('PageDown');
  expect((await state(page)).flightLab).toMatchObject({ section: 'hand', sample: { page: 2, index: 0 } });
  await page.keyboard.press(remapped ? 'k' : 'ArrowRight');
  expect((await state(page)).flightLab).toMatchObject({ section: 'hand', sample: { index: 1 } });
  await page.keyboard.press('g');
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (let section = 0; section < 4; section++) {
      await tap(page, 'profile-collection-signals-section-hit', section);
      await capture(page, info, `signals-${section}-${size.width}`, 'profile-collection-signals');
    }
  }
  await page.keyboard.press(remapped ? 'k' : 'ArrowRight'); expect((await state(page)).collectionSignals.section).toBe('unused');
  await tap(page, 'profile-collection-signals-section-hit', 0);
  await page.keyboard.press('Tab');
  expect((await state(page)).collectionSignals.section).toBe('unused');
  await page.keyboard.press(remapped ? 'q' : 'Enter');
  expect((await state(page)).collectionSignals.section).toBe('frequent');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').input.gamepad.emit('down', {}, { index: 5 }));
  expect((await state(page)).collectionSignals.section).toBe('recent');
  await page.keyboard.press(remapped ? 'b' : 'Escape'); await page.keyboard.press('r');
  const count = (await state(page)).revisionTrail.changeCount; expect(count).toBeGreaterThan(50);
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const change of [0, 2, count - 1]) {
      await page.evaluate(change => { const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
        s.profileViewState.savedDeckHistoryChangePage = change; s.renderPremiumProfileScene(); }, change);
      await capture(page, info, `history-${change}-${size.width}`, 'profile-folio-history');
    }
  }
  await page.keyboard.press('PageDown'); expect((await state(page)).revisionTrail.changePage).toBe(1);
  expect((await state(page)).revisionTrail.currentChange.label).toBe('Leader change');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? '')).toContain('Leader change');
  for (let i = 1; i < count; i++) { await page.keyboard.press('PageDown'); expect((await state(page)).revisionTrail.changePage).toBe(i + 1); }
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').input.gamepad.emit('down', {}, { index: 7 }));
  expect((await state(page)).revisionTrail.changePage).toBe(1);
  await tap(page, 'profile-folio-history-next-hit'); expect((await state(page)).revisionTrail.targetIndex).toBe(1);
  expect((await state(page)).revisionTrail.changePage).toBe(1);
  await page.keyboard.press(remapped ? 'b' : 'Escape'); await page.keyboard.press('t');
  for (const size of sizes) { await page.setViewportSize(size); await capture(page, info, `tuning-full-${size.width}`, 'profile-folio-workshop'); }
  await page.keyboard.press(remapped ? 'q' : 'Enter'); expect(await account(page)).toEqual(baseline);
  await page.keyboard.press('ArrowDown'); expect((await state(page)).workshop.suggestionIndex).toBe(1);
  await tap(page, 'profile-folio-workshop-next-hit'); expect((await state(page)).workshop.sourceCardIndex).toBe(1);
  expect(await account(page)).toEqual(baseline);
  // Save failures preserve both source and parent, with visible feedback.
  const small = { ...baseline, decks: baseline.decks.slice(0, 2) };
  await replaceAccount(page, small);
  await page.evaluate(() => { const w = window as any; w.__deepWrite = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key.startsWith('birdsquad.account')) throw new DOMException('Full', 'QuotaExceededError'); w.__deepWrite.call(this, key, value); }; });
  await tap(page, 'profile-folio-workshop-save-hit'); expect(await account(page)).toEqual(small);
  await capture(page, info, 'tuning-save-failed', 'profile-folio-workshop');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').children.getByName('profile-folio-workshop-context').text)).toContain('Could not save');
  await page.keyboard.press(remapped ? 'b' : 'Escape'); await page.keyboard.press('r');
  await tap(page, 'profile-folio-history-restore-hit'); expect(await account(page)).toEqual(small);
  await capture(page, info, 'history-save-failed', 'profile-folio-history');
  await page.evaluate(() => { Storage.prototype.setItem = (window as any).__deepWrite; });
  await page.keyboard.press(remapped ? 'b' : 'Escape');
  const empty = { ...small, cardCollection: {}, decks: [{ ...small.decks[0], cards: [{ id: 'retired_test_card', upgraded: false }] }] };
  await replaceAccount(page, empty);
  for (const [key, prefix] of [['g', 'profile-collection-signals'], ['r', 'profile-folio-history'], ['t', 'profile-folio-workshop']] as const) {
    await page.keyboard.press(key);
    for (const size of sizes) { await page.setViewportSize(size); await capture(page, info, `empty-${key}-${size.width}`, prefix); }
    await page.keyboard.press(remapped ? 'b' : 'Escape');
  }
  expect(await account(page)).toEqual(empty); expect(errors).toEqual([]);
});
