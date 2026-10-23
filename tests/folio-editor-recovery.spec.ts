import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import {targetGeometry,checkTargetGeometry} from './helpers/target-geometry';
import { installVirtualController, pressController, controllerButton } from './helpers/virtual-controller';
import { savedDeckShareCode } from '../src/game/saved-deck-library';

test.use({ hasTouch: true });
const state = (page: Page) => page.evaluate(() => JSON.parse((window as any).render_game_to_text()));
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account')!));
async function tap(page: Page, name: string) {
  await settleCanvas(page);
  const point = await page.evaluate(name => {
    const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene'), hit = s.children.getByName(name);
    const c = s.game.canvas.getBoundingClientRect();
    return { x: c.left + hit.x * c.width / 1280, y: c.top + hit.y * c.height / 720 };
  }, name);
  await page.touchscreen.tap(point.x, point.y); await settleCanvas(page);
}
async function boot(page: Page) {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await installVirtualController(page);
  await page.addInitScript(() => {
    const account = { decks: [{ id: 'edit-test', name: 'Original name', description: 'Original description',
      leaderId: 'fledgling', cards: [{ id: 'major_00', upgraded: false }], createdAt: 1, updatedAt: 1, runMode: 'quick' }] };
    for (const key of ['birdsquad.account', 'birdsquad.account.backup']) localStorage.setItem(key, JSON.stringify(account));
  });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('ProfileScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('ProfileScene');
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('ProfileScene'));
  await tap(page, 'profile-folios-tab-hit');
}
async function focus(page: Page, action: string) {
  for (let i = 0; i < 30 && (await state(page)).folioFocus.action !== action; i++) await page.keyboard.press('Tab');
  expect((await state(page)).folioFocus.action).toBe(action);
}
async function rejectWrites(page: Page) {
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    (window as any).__restoreWrite = () => Storage.prototype.setItem = write;
    Storage.prototype.setItem = function(k, v) {
      if (k.startsWith('birdsquad.account')) throw new DOMException('Full', 'QuotaExceededError');
      return write.call(this, k, v);
    };
  });
}

for (const kind of ['rename', 'description', 'import'] as const) test(`${kind} retains failed drafts, recovery ownership, cancellation and retry`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page);
  if (kind !== 'import') await tap(page, 'profile-folio-organize-hit');
  if (kind === 'description') await tap(page, 'profile-folio-organizer-identity-hit');
  const opener = kind === 'rename' ? 'profile-folio-organizer-rename-hit'
    : kind === 'description' ? 'profile-folio-identity-description-hit' : 'profile-folio-import-hit';
  const label = kind === 'rename' ? 'Saved flight name' : kind === 'description' ? 'Private Folio description' : 'Flight share code';
  await tap(page, opener);
  const input = page.getByRole('textbox', { name: label });
  await expect(input).toBeFocused();
  const actionBounds=()=>page.locator('#folio-editor-actions button').evaluateAll(buttons=>buttons.map(button=>{
    const b=button.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};
  }));
  const restingActions=await actionBounds();
  const before = await stored(page);
  await input.fill(kind === 'import' ? 'BSF-invalid' : `Keep this ${kind} draft`);
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', repeat: true });
  await page.keyboard.press('Tab'); await expect(page.locator('#folio-editor-cancel')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('#folio-editor-save')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(input).toBeFocused();
  await page.mouse.click(40, 40); // Outside focus never grants permission to save.
  await expect(input).toBeFocused();
  expect(await stored(page)).toEqual(before);
  await page.evaluate(() => dispatchEvent(new Event('vite:preloadError')));
  await expect(page.locator('#update-recovery')).toBeVisible();
  expect(await stored(page)).toEqual(before);
  await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
  await expect(input).toBeFocused();
  await rejectWrites(page); await page.keyboard.press('Enter');
  await expect(page.locator('#folio-editor-error')).toBeVisible();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(await actionBounds(),'Retry labels must not move or resize native commands').toEqual(restingActions);
  expect(await stored(page)).toEqual(before);
  for (const [width, height] of [[2560,1600], [1440,900], [1000,560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    checkTargetGeometry(await targetGeometry(page,'ProfileScene'),`${kind} editor`);
    const box = await input.boundingBox(), error = await page.locator('#folio-editor-error').boundingBox();
    expect(error!.y).toBeGreaterThan(box!.y + box!.height);
    expect(error!.y + error!.height).toBeLessThan(height);
    await page.screenshot({ path: info.outputPath(`${kind}-error-${width}.png`) });
  }
  await page.evaluate(() => (window as any).__restoreWrite());
  if (kind !== 'import') {
    await page.locator('#folio-editor-save').tap(); await expect(input).toHaveCount(0);
    expect((await stored(page)).decks[0][kind === 'rename' ? 'name' : 'description']).toBe(`Keep this ${kind} draft`);
  } else {
    await page.locator('#folio-editor-cancel').tap(); await expect(input).toHaveCount(0);
    expect(await stored(page)).toEqual(before);
  }
  expect((await state(page)).folioFocus.action).toBe(opener);
  await page.keyboard.press('Enter'); await expect(input).toBeFocused();
  const saved = await stored(page); await input.fill('Cancel this draft');
  await controllerButton(page, 1, true); await settleCanvas(page); await settleCanvas(page);
  await expect(input).toHaveCount(0); expect(await stored(page)).toEqual(saved);
  await controllerButton(page, 1, false);
  expect((await state(page)).folioFocus.action).toBe(opener);
  await expect(page.locator('#folio-editor-error')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Organizer, Identity and template choices share stable non-mutating focus and nested return', async ({ page }, info) => {
  await boot(page); await tap(page, 'profile-folio-organize-hit');
  const original = await stored(page);
  for (const action of ['profile-folio-organizer-tag-hit:pressure', 'profile-folio-organizer-rename-hit', 'profile-folio-organizer-identity-hit']) {
    await focus(page, action); expect(await stored(page)).toEqual(original);
  }
  await page.keyboard.press('Enter');
  await focus(page, 'profile-folio-identity-sleeve-hit:signal');
  expect(await stored(page)).toEqual(original); await pressController(page, 0);
  expect((await stored(page)).decks[0].sleeve).toBe('signal');
  for (const [width, height] of [[2560,1600], [1440,900], [1000,560]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').renderPremiumProfileScene());
    await settleCanvas(page);
    expect((await state(page)).folioFocus.action).toBe('profile-folio-identity-sleeve-hit:signal');
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').children.list
      .filter((o: any) => o.getData?.('controlKind') && o.getData('focused')).length)).toBe(1);
    await page.screenshot({ path: info.outputPath(`identity-focus-${width}.png`) });
  }
  await focus(page, 'profile-folio-identity-close-hit'); await page.keyboard.press('Enter');
  expect((await state(page)).folioFocus.action).toBe('profile-folio-organizer-identity-hit');
  await focus(page, 'profile-folio-organizer-close-hit'); await page.keyboard.press('Enter');
  expect((await state(page)).folioFocus.action).toBe('profile-folio-organize-hit');
  await tap(page, 'profile-folio-template-hit');
  await focus(page, 'profile-folio-template-build-hit');
  const before = await stored(page); await page.keyboard.press('Enter');
  expect(await stored(page)).toEqual(before); // unavailable starter remains inspectable, never creates
  await pressController(page, 15); await pressController(page, 0);
  expect((await state(page)).folioFocus.action).toBe('profile-folio-template-hit');
});

test('native editor shutdown never commits and removes error UI and deferred focus', async ({ page }) => {
  await boot(page); await tap(page, 'profile-folio-import-hit');
  const before = await stored(page);
  await page.getByRole('textbox', { name: 'Flight share code' }).fill('Invalid');
  await page.keyboard.press('Enter'); await expect(page.locator('#folio-editor-error')).toBeVisible();
  await page.evaluate(() => (window as any).__birdSquadGame.scene.stop('ProfileScene'));
  await expect(page.locator('#folio-editor-error')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Flight share code' })).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
});

test('valid import retries failed persistence exactly once and preserves source identity', async ({ page }) => {
  await boot(page); const before = await stored(page);
  const code = savedDeckShareCode(before.decks[0]);
  await tap(page, 'profile-folio-import-hit');
  const input = page.getByRole('textbox', { name: 'Flight share code' });
  await input.fill(code); await rejectWrites(page); await input.press('Enter');
  await expect(page.locator('#folio-editor-error')).toContainText('Could not save');
  await expect(input).toHaveValue(code); expect(await stored(page)).toEqual(before);
  await page.evaluate(() => (window as any).__restoreWrite());
  await page.locator('#folio-editor-save').tap(); await expect(input).toHaveCount(0);
  const after = await stored(page);
  expect(after.decks).toHaveLength(2);
  expect(after.decks[0].cards).toEqual(before.decks[0].cards);
  expect(after.decks[1].id).toBe(before.decks[0].id);
  expect(after.decks[1].name).toBe(before.decks[0].name);
  expect((await state(page)).folioFocus.action).toBe('profile-folio-import-hit');
});

test('Folio shelf action traversal can leave the shelf without trapping global navigation', async ({ page }) => {
  await boot(page);
  const before = await stored(page);
  await page.keyboard.press('Tab');
  expect((await state(page)).folioFocus.scope).toBe('profile-folio');
  for (let i = 0; i < 20 && (await state(page)).folioFocus.scope === 'profile-folio'; i++) await page.keyboard.press('Tab');
  expect((await state(page)).folioFocus.scope).not.toBe('profile-folio');
  expect(await stored(page)).toEqual(before);
});
