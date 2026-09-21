import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test.use({ hasTouch: true });
const inputId = '#codex-card-journal-input';
const dialogId = '#codex-card-journal-editor';
async function boot(page: Page) {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.addInitScript(() => {
    const raw = JSON.stringify({ discoveredCards: ['major_00', 'wands_ace'], cardJournal: { major_00: 'Previous note.' } });
    localStorage.setItem('birdsquad.account', raw); localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('CodexScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('CodexScene').codexData));
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').openCodexDetail('major_00'));
  await settleCanvas(page);
}
async function open(page: Page) { await page.keyboard.press('j'); await expect(page.locator(inputId)).toBeFocused(); }
async function note(page: Page) { return page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account')!).cardJournal.major_00); }

test('journal editor keeps readable native controls together across stage sizes and reduced viewport height', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page); await open(page);
  await page.locator(inputId).fill('W'.repeat(240));
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }, { width: 1000, height: 420 }]) {
    await page.setViewportSize(size);
    await expect.poll(() => page.locator(dialogId).evaluate(el => {
      const b = el.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight;
    })).toBe(true);
    const issues = await page.locator(dialogId).evaluate(dialog => {
      const d = dialog.getBoundingClientRect(), errors: string[] = [];
      for (const el of dialog.querySelectorAll('h2,label,textarea,button,p')) {
        if ((el as HTMLElement).hidden) continue;
        const b = el.getBoundingClientRect(), style = getComputedStyle(el);
        if (b.left < d.left || b.right > d.right || parseFloat(style.fontSize) < 16) errors.push(`${el.id}: bounds/type`);
      }
      for (const el of dialog.querySelectorAll('button')) {
        const b = el.getBoundingClientRect();
        if (b.height < 44 || b.top < d.top || b.bottom > d.bottom) errors.push('action offscreen');
      }
      if (dialog.scrollWidth > dialog.clientWidth) errors.push('horizontal overflow');
      return errors;
    });
    expect(issues).toEqual([]);
    await page.screenshot({ path: info.outputPath(`journal-editor-${size.width}-${size.height}.png`) });
    if (size.height === 420) {
      await page.locator('.card-journal-body').hover(); await page.mouse.wheel(0, 800);
      await expect(page.locator('#codex-card-journal-help')).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Save note' })).toBeInViewport();
      await page.screenshot({ path: info.outputPath('journal-editor-short-height-scrolled.png') });
    }
  }
  await expect(page.locator(inputId)).toHaveValue('W'.repeat(240));
  await page.getByRole('button', { name: 'Cancel', exact: true }).tap();
  expect(await note(page)).toBe('Previous note.'); expect(errors).toEqual([]);
});

test('journal editor touch save and cancel are explicit and do not change card ownership', async ({ page }) => {
  await boot(page); await page.setViewportSize({ width: 1000, height: 560 }); await settleCanvas(page);
  // Persist the migrated account shape once before comparing unrelated fields.
  await open(page); await page.getByRole('button', { name: 'Save note' }).tap();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account')!));
  await open(page); await page.locator(inputId).fill('Unsaved draft.');
  await page.locator(inputId).evaluate(el => (el as HTMLElement).blur());
  await expect(page.locator(dialogId)).toBeVisible(); expect(await note(page)).toBe('Previous note.');
  await page.mouse.click(8, 8); await expect(page.locator(dialogId)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).tap();
  expect(await note(page)).toBe('Previous note.');
  await open(page); await page.locator(inputId).fill('  Touch   memory.\nNext turn.  ');
  await page.getByRole('button', { name: 'Save note', exact: true }).tap();
  await expect(page.locator(dialogId)).toHaveCount(0); expect(await note(page)).toBe('Touch memory.\nNext turn.');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account')!));
  expect({ ...after, cardJournal: saved.cardJournal }).toEqual(saved);
  await open(page); await page.locator(inputId).fill(''); await page.getByRole('button', { name: 'Save note' }).tap();
  expect(await note(page)).toBeUndefined();
});

test('journal editor contains keyboard focus and composition and never lets held Confirm close its card', async ({ page }) => {
  await boot(page); await open(page);
  await expect(page.locator(inputId)).toHaveValue('Previous note.');
  for (const expected of ['codex-card-journal-cancel', 'codex-card-journal-save', 'codex-card-journal-input']) {
    await page.keyboard.press('Tab'); await expect(page.locator(`#${expected}`)).toBeFocused();
  }
  await page.keyboard.press('Shift+Tab'); await expect(page.locator('#codex-card-journal-save')).toBeFocused();
  await page.locator(inputId).focus(); await page.locator(inputId).fill('Composition draft');
  for (const key of ['Enter', 'Escape']) await page.locator(inputId).dispatchEvent('keydown', { key, code: key, isComposing: true });
  await expect(page.locator(inputId)).toHaveValue('Composition draft'); expect(await note(page)).toBe('Previous note.');
  await page.locator(inputId).press('End'); await page.locator(inputId).press('Shift+Enter');
  await page.keyboard.type('Next line.'); await expect(page.locator(inputId)).toHaveValue('Composition draft\nNext line.');
  await page.keyboard.down('Enter'); await expect(page.locator(dialogId)).toHaveCount(0);
  await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').detailId)).toBe('major_00');
  await open(page); await page.locator(inputId).fill('Cancel this.'); await page.keyboard.press('Escape');
  expect(await note(page)).toBe('Composition draft\nNext line.');
});

test('journal editor retains failed drafts supports retry and disposes on scene shutdown', async ({ page }, info) => {
  await boot(page); await open(page); await page.locator(inputId).fill('Recover this draft.');
  await page.evaluate(() => {
    const w = window as any; w.originalJournalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('birdsquad.account')) throw new DOMException('Full', 'QuotaExceededError');
      return w.originalJournalSetItem.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByRole('alert')).toContainText('Your draft is still here');
  await expect(page.locator(inputId)).toHaveValue('Recover this draft.'); expect(await note(page)).toBe('Previous note.');
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Could not save');
  await page.screenshot({ path: info.outputPath('journal-editor-save-failure.png') });
  await page.evaluate(() => { Storage.prototype.setItem = (window as any).originalJournalSetItem; });
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.locator(dialogId)).toHaveCount(0); expect(await note(page)).toBe('Recover this draft.');
  await open(page); await page.locator(inputId).fill('Discard this failed draft.');
  await page.evaluate(() => { Storage.prototype.setItem = function() { throw new DOMException('Full', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await note(page)).toBe('Recover this draft.');
  await page.evaluate(() => { Storage.prototype.setItem = (window as any).originalJournalSetItem; });
  await open(page); await page.locator(inputId).fill('Do not auto-save on exit.');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.stop('CodexScene'));
  await expect(page.locator(dialogId)).toHaveCount(0); expect(await note(page)).toBe('Recover this draft.');
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  expect(await page.locator(inputId).count()).toBe(0);
});

test('journal editor freezes the reader and keeps controller save cancel and return intact', async ({ page }) => {
  await boot(page); await page.setViewportSize({ width: 1000, height: 560 }); await settleCanvas(page);
  const scroll = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    c.detailScroll = 120; c.detailScrollTarget = 400; c.renderAll(); c.openCardJournal(); return c.detailScroll;
  });
  await expect(page.locator(inputId)).toBeFocused();
  await page.mouse.move(950, 500); await page.mouse.wheel(0, 700); await settleCanvas(page);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').detailScroll)).toBe(scroll);
  await page.locator(inputId).fill('Controller saved draft.');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').input.gamepad.emit('down', {}, { index: 0 }));
  await expect(page.locator(dialogId)).toHaveCount(0); expect(await note(page)).toBe('Controller saved draft.');
  await open(page); await page.locator(inputId).fill('Cancel controller draft.');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').input.gamepad.emit('down', {}, { index: 1 }));
  await expect(page.locator(dialogId)).toHaveCount(0); expect(await note(page)).toBe('Controller saved draft.');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').detailScroll)).toBe(scroll);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').detailId)).toBeUndefined();
});
