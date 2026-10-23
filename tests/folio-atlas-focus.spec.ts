import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { installVirtualController, pressController, controllerButton } from './helpers/virtual-controller';

test.use({ hasTouch: true });
const sizes = [[2560, 1600], [1440, 900], [1000, 560]];
const snapshot = (page: Page) => page.evaluate(() => JSON.parse((window as any).render_game_to_text()));
async function boot(page: Page, scene = 'ProfileScene') {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await installVirtualController(page);
  await page.addInitScript(() => {
    const ids = ['major_00', 'major_01', 'wands_ace'];
    const account = { discoveredCards: ids, cardCollection: Object.fromEntries(ids.map(id => [id,
      { timesClaimed: 1, firstAcquiredAt: 10, firstSource: 'starter_flock' }])),
      decks: [{ id: 'focus-deck', name: 'Nested reader focus', leaderId: 'fledgling', runMode: 'quick',
        createdAt: 1, updatedAt: 1, cards: ids.map(id => ({ id, upgraded: false })) }] };
    for (const key of ['birdsquad.account', 'birdsquad.account.backup']) localStorage.setItem(key, JSON.stringify(account));
  });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async scene => {
    const w = window as any; await w.__birdSquadEnsureScene(scene);
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start(scene);
  }, scene);
  await page.waitForFunction(scene => (window as any).__birdSquadGame.scene.isActive(scene), scene);
  await settleCanvas(page);
  if (scene === 'ProfileScene') { await tap(page, 'profile-folios-tab-hit'); await tap(page, 'profile-folio-lab-hit'); }
}
async function tap(page: Page, name: string, scene = 'ProfileScene') {
  const p = await page.evaluate(({ name, scene }) => {
    const s = (window as any).__birdSquadGame.scene.getScene(scene);
    const hit = scene === 'CodexScene' ? s.root.getByName(name) : s.children.getByName(name);
    const b = hit.getBounds(), c = s.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, { name, scene });
  await page.touchscreen.tap(p.x, p.y); await settleCanvas(page);
}
async function focus(page: Page, name: string) {
  for (let i = 0; i < 20 && (await snapshot(page)).folioFocus.action !== name; i++) await page.keyboard.press('Tab');
  expect((await snapshot(page)).folioFocus.action).toBe(name);
}

test('Atlas close action supports keyboard, controller and redraw without changing shelf context', async ({ page }, info) => {
  await boot(page, 'CodexScene');
  await page.keyboard.press('g'); await page.keyboard.press('ArrowDown');
  const family = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').collectionAtlasFamilyIndex);
  await page.keyboard.press('Tab');
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').renderAll(true));
    await settleCanvas(page);
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').codexFocusState().label)).toBe('Close Collection Atlas');
    await page.screenshot({ path: info.outputPath(`atlas-close-${width}.png`) });
  }
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').focusZone)).toBe('progress');
  await page.keyboard.press('Enter'); await pressController(page, 15); await pressController(page, 0);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').collectionAtlasOpen)).toBe(false);
  expect(family).toBe(1);
  await page.keyboard.press('g'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').activeTab)).toBe(1);
});

test('Folio tools return to exact action and preserve sampled hand across every nested reader', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  const sample = (await snapshot(page)).savedFlightFolios.flightLab.sample;
  await focus(page, 'profile-flight-lab-tools-hit'); await page.keyboard.press('Enter');
  for (const [action, close] of [['collection-signals', 'profile-collection-signals-close-hit'],
    ['field-record', 'profile-folio-field-record-close-hit'], ['history', 'profile-folio-history-close-hit'],
    ['tune', 'profile-folio-workshop-close-hit']]) {
    const opener = `profile-flight-lab-${action}-hit`;
    await focus(page, opener); await page.keyboard.press('Enter');
    await focus(page, close);
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').renderPremiumProfileScene());
      await settleCanvas(page);
      expect((await snapshot(page)).folioFocus.action).toBe(close);
      const geometry = await page.evaluate(close => {
        const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene'), h = s.children.getByName(close);
        const scale = s.game.canvas.getBoundingClientRect().width / 1280;
        return { focused: h.getData('focused'), width: h.width * scale, height: h.height * scale };
      }, close);
      expect(geometry.focused).toBe(true); expect(geometry.width).toBeGreaterThanOrEqual(44); expect(geometry.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: info.outputPath(`${action}-${width}.png`) });
    }
    await page.keyboard.press('Enter');
    expect((await snapshot(page)).folioFocus.action).toBe(opener);
    expect((await snapshot(page)).savedFlightFolios.flightLab.sample).toEqual(sample);
  }
  expect(errors).toEqual([]);
});

test('Folio notes keep failed drafts through nested recovery and held controller Back closes only the editor', async ({ page }, info) => {
  await boot(page); await page.keyboard.press('n'); await page.keyboard.press('Enter');
  const input = page.getByRole('textbox', { name: 'Private Folio matchup notes' });
  await expect(input).toBeFocused(); await input.fill('Keep this private draft.');
  await page.mouse.click(40, 40); await expect(input).toBeFocused();
  await expect(input).toHaveValue('Keep this private draft.');
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
  await expect(input).toBeVisible();
  await page.evaluate(() => {
    const write = Storage.prototype.setItem; (window as any).__restoreWrite = () => Storage.prototype.setItem = write;
    Storage.prototype.setItem = function(k, v) { if (k.startsWith('birdsquad.account')) throw new Error('Full'); return write.call(this, k, v); };
  });
  await page.keyboard.press('Enter'); await expect(page.locator('#folio-notes-error')).toBeVisible();
  await expect(input).toHaveValue('Keep this private draft.');
  await page.evaluate(() => dispatchEvent(new Event('vite:preloadError')));
  await expect(page.locator('#update-recovery')).toBeVisible();
  await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
  await expect(input).toBeFocused(); await expect(input).toHaveValue('Keep this private draft.');
  await page.setViewportSize({ width: 1000, height: 560 }); await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('notes-retry-1000.png') });
  await page.evaluate(() => (window as any).__restoreWrite());
  await page.keyboard.press('Enter'); await expect(input).toHaveCount(0);
  expect((await snapshot(page)).folioFocus.action).toBe('profile-folio-field-record-edit-hit');
  await page.keyboard.press('Enter'); await expect(input).toBeFocused(); await input.fill('Cancel this second draft.');
  await controllerButton(page, 1, true); await settleCanvas(page); await settleCanvas(page);
  expect((await snapshot(page)).savedFlightFolios.fieldRecord.open).toBe(true);
  await expect(input).toHaveCount(0); await controllerButton(page, 1, false);
  expect((await snapshot(page)).savedFlightFolios.fieldRecord.notes).toBe('Keep this private draft.');
  await pressController(page, 1);
  expect((await snapshot(page)).folioFocus.action).toBe('profile-flight-lab-field-record-hit');
});

test('Collection Signals has unique focus per category and controller action activation', async ({ page }) => {
  await boot(page); await page.keyboard.press('g');
  for (const section of ['unused', 'frequent', 'recent', 'paired']) {
    await focus(page, `profile-collection-signals-section-hit:${section}`); await page.keyboard.press('Enter');
    expect((await snapshot(page)).savedFlightFolios.collectionSignals.section).toBe(section);
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').children.list.filter((o: any) => o.getData?.('focused') && o.name.startsWith('profile-collection-signals')).length)).toBe(1);
  }
  await pressController(page, 15); expect((await snapshot(page)).folioFocus.action).toBe('profile-collection-signals-close-hit');
  await pressController(page, 0); expect((await snapshot(page)).folioFocus.action).toBe('profile-flight-lab-collection-signals-hit');
});

test('disabled Folio launch remains readable and focused without activation', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const account = JSON.parse(localStorage.getItem('birdsquad.account')!); account.cardCollection = {};
    for (const key of ['birdsquad.account', 'birdsquad.account.backup']) localStorage.setItem(key, JSON.stringify(account));
    (window as any).__birdSquadGame.scene.getScene('ProfileScene').renderPremiumProfileScene();
  });
  await focus(page, 'profile-flight-lab-launch-hit');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').children.getByName('profile-flight-lab-launch-hit').getData('enabled'))).toBe(false);
  await page.keyboard.press('Enter'); await pressController(page, 0);
  expect((await snapshot(page)).savedFlightFolios.flightLab.open).toBe(true);
  expect((await snapshot(page)).folioFocus.action).toBe('profile-flight-lab-launch-hit');
});

test('remapped Confirm cannot also fire a Folio shortcut or repeat a child action', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1,
    bindings: { confirm: 'KeyN', back: 'KeyB' } })));
  await boot(page);
  await focus(page, 'profile-flight-lab-tools-hit'); await page.keyboard.press('n');
  expect((await snapshot(page)).savedFlightFolios.flightLab.section).toBe('tools');
  expect((await snapshot(page)).savedFlightFolios.fieldRecord.open).toBe(false);
  await focus(page, 'profile-flight-lab-field-record-hit');
  await page.keyboard.down('n'); await page.keyboard.down('n'); await page.keyboard.up('n');
  expect((await snapshot(page)).savedFlightFolios.fieldRecord.open).toBe(true);
  await expect(page.getByRole('textbox', { name: 'Private Folio matchup notes' })).toHaveCount(0);
  await focus(page, 'profile-folio-field-record-close-hit'); await page.keyboard.press('n');
  expect((await snapshot(page)).savedFlightFolios.flightLab.open).toBe(true);
  expect((await snapshot(page)).folioFocus.action).toBe('profile-flight-lab-field-record-hit');
  await page.keyboard.press('b');
  expect((await snapshot(page)).savedFlightFolios.flightLab.open).toBe(false);
});
