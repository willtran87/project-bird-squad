import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import {targetGeometry,checkTargetGeometry} from './helpers/target-geometry';

test.use({ hasTouch: true });
async function tap(page: Page, name: string, index = 0) {
  // Async art recovery redraws the scene; wait for Phaser's next input-list
  // update before interacting with the newly rendered control.
  await settleCanvas(page);
  const point = await page.evaluate(({ name, index }) => {
    const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
    const hit = s.children.list.filter((o: any) => o.name === name)[index];
    if (!hit) throw new Error(`Missing ${name}: ${JSON.stringify({ identity: s.profileViewState.savedDeckIdentityOpen, organizer: s.profileViewState.savedDeckOrganizerOpen, focus: s.profileViewState.focus, events: (window as any).__folioEvents })}`);
    const b = s.game.canvas.getBoundingClientRect();
    return { x: b.left + hit.x * b.width / 1280, y: b.top + hit.y * b.height / 720 };
  }, { name, index });
  await page.touchscreen.tap(point.x, point.y); await settleCanvas(page);
}
for (const remapped of [false, true]) test(`Folio readers retain readable geometry, identity and editing ownership, remapped=${remapped}`, async ({ page }, info) => {
  // This case includes an 18-state screenshot matrix and real network failures.
  test.setTimeout(120_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(remapped => {
    const cards = [{ id: 'major_00', upgraded: false }, { id: 'wands_ace', upgraded: true }, { id: 'cups_ace', upgraded: false }];
    const raw = JSON.stringify({ discoveredCards: cards.map(c => c.id), decks: [{ id: 'folio-reader',
      lineageId: 'folio-lineage', revision: 99, name: 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', leaderId: 'spark_caller',
      cards, createdAt: 100, updatedAt: 100, favorite: false, archived: false, sourceSeed: 'private-seed',
      runMode: 'quick', folder: 'workbench', tags: ['pressure', 'guard', 'flow'],
      description: 'Preserve this private description while testing long text, collection identity, saved cards, and reversible edits safely.',
      coverCardId: 'major_00', sleeve: 'field' }] });
    localStorage.setItem('birdsquad.account', raw); localStorage.setItem('birdsquad.account.backup', raw);
    if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { previous: 'KeyJ', next: 'KeyK', confirm: 'KeyQ', back: 'KeyB' } }));
  }, remapped);
  await page.setViewportSize({ width: 2560, height: 1600 }); await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('ProfileScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('ProfileScene');
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('ProfileScene') && !(window as any).__birdSquadGame.scene.getScene('ProfileScene').cameras.main.fadeEffect.isRunning);
  await page.evaluate(() => {
    const w = window as any; w.__folioEvents = [];
    for (const type of ['mousedown', 'mouseup', 'touchstart', 'touchend']) document.addEventListener(type, e => {
      const s = w.__birdSquadGame.scene.getScene('ProfileScene').profileViewState;
      w.__folioEvents.push({ type, time: e.timeStamp, identity: s.savedDeckIdentityOpen, organizer: s.savedDeckOrganizerOpen });
      w.__folioEvents = w.__folioEvents.slice(-12);
    }, true);
  });
  await tap(page, 'profile-folios-tab-hit'); await tap(page, 'profile-folio-organize-hit');
  const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account')!).decks[0]);
  const original = await snapshot();
  for (const kind of ['organizer', 'identity']) {
    if (kind === 'identity') {
      await tap(page, 'profile-folio-organizer-identity-hit');
      await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('ProfileScene').children.getByName('profile-folio-identity-cover-art')));
    }
    for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(viewport); await settleCanvas(page);
      for (const status of ['idle', 'failed', kind === 'organizer' ? 'tagLimit' : 'personalized']) {
        await page.evaluate(status => {
          const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
          s.profileViewState.savedDeckStatus = status; s.renderPremiumProfileScene();
        }, status);
        await settleCanvas(page);
        const geometry = await page.evaluate(kind => {
          const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
          const objects = s.children.list.slice(s.children.list.findIndex((o: any) => o.name === `profile-folio-${kind}-scrim`));
          const frame = s.children.getByName(`profile-folio-${kind}-frame`).getBounds();
          const scale = s.game.canvas.getBoundingClientRect().width / 1280;
          const inside = (b: any) => b.left >= frame.left && b.right <= frame.right && b.top >= frame.top && b.bottom <= frame.bottom;
          const clear = (a: any, b: any) => a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
          const labels = objects.filter((o: any) => o.type === 'Text' && o.visible);
          const controls = objects.filter((o: any) => o.input?.enabled && !o.name.endsWith('scrim'));
          const art = s.children.getByName('profile-folio-identity-cover-art');
          return {
            labels: labels.map((o: any) => ({ text: o.text, fits: inside(o.getBounds()), size: parseFloat(o.style.fontSize) * scale })),
            overlaps: labels.flatMap((a: any, i: number) => labels.slice(i + 1).filter((b: any) => !clear(a.getBounds(), b.getBounds())).map((b: any) => [a.text, b.text])),
            controls: controls.map((o: any) => ({ name: o.name, width: o.width * scale, height: o.height * scale, fits: inside(o.getBounds()) })),
            controlsOverlap: controls.some((a: any, i: number) => controls.slice(i + 1).some((b: any) => !clear(a.getBounds(), b.getBounds()))),
            art: art ? { x: art.scaleX, y: art.scaleY, fits: inside(art.getBounds()) } : null,
            sleeveLabelsFit: labels.filter((o: any) => o.getData('sleeveId')).every((o: any) => {
              const parent = controls.find((c: any) => c.name === 'profile-folio-identity-sleeve-hit' && c.getData('sleeveId') === o.getData('sleeveId'));
              const a = o.getBounds(), b = parent.getBounds();
              return a.left >= b.left + 10 && a.right <= b.right - 10 && a.top >= b.top + 10 && a.bottom <= b.bottom - 10;
            }),
          };
        }, kind);
        for (const label of geometry.labels) { expect(label.size, label.text).toBeGreaterThanOrEqual(14); expect(label.fits, label.text).toBe(true); }
        expect(geometry.overlaps).toEqual([]); expect(geometry.controlsOverlap).toBe(false); expect(geometry.sleeveLabelsFit).toBe(true);
        checkTargetGeometry(await targetGeometry(page,'ProfileScene'),'Folio readers');
        for (const c of geometry.controls) { expect(c.width, c.name).toBeGreaterThanOrEqual(44); expect(c.height, c.name).toBeGreaterThanOrEqual(44); expect(c.fits, c.name).toBe(true); }
        if (kind === 'identity') { expect(geometry.art!.x).toBe(geometry.art!.y); expect(geometry.art!.fits).toBe(true); }
        await page.screenshot({ path: info.outputPath(`${kind}-${status}-${viewport.width}.png`) });
        expect(await snapshot()).toEqual(original);
      }
    }
  }
  // Exercise the real image loader, retaining the exact portrait slot while
  // requests are delayed, fail, and recover on the advertised reopen action.
  const coverRoute = /\/major_00[^/]*\.webp(?:\?.*)?$/;
  const removeCover = () => page.evaluate(() => (window as any).__birdSquadGame.textures.remove('card-thumb-major_00'));
  const artState = () => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').children.getByName('profile-folio-identity-cover-hit').getData('artState'));
  const coverBounds = () => page.evaluate(() => {
    const hit = (window as any).__birdSquadGame.scene.getScene('ProfileScene').children.getByName('profile-folio-identity-cover-hit');
    return [hit.x, hit.y, hit.width, hit.height];
  });
  const originalBounds = await coverBounds();
  await tap(page, 'profile-folio-identity-close-hit'); await removeCover();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(coverRoute, async route => { await gate; await route.continue(); });
  try {
    await tap(page, 'profile-folio-organizer-identity-hit');
    await expect.poll(artState).toBe('loading');
    expect(await coverBounds()).toEqual(originalBounds);
    await page.screenshot({ path: info.outputPath('identity-loading-1000.png') });
  } finally { release(); }
  await expect.poll(artState).toBe('ready'); await page.unroute(coverRoute);
  await tap(page, 'profile-folio-identity-close-hit'); await removeCover();
  await page.route(coverRoute, route => route.abort('failed'));
  await tap(page, 'profile-folio-organizer-identity-hit');
  await expect.poll(artState).toBe('unavailable');
  expect(await coverBounds()).toEqual(originalBounds);
  await page.screenshot({ path: info.outputPath('identity-unavailable-1000.png') });
  await page.unroute(coverRoute);
  await tap(page, 'profile-folio-identity-close-hit'); await tap(page, 'profile-folio-organizer-identity-hit');
  await expect.poll(artState).toBe('ready');
  expect(await coverBounds()).toEqual(originalBounds); expect(await snapshot()).toEqual(original);
  const rejectWrites = () => page.evaluate(() => {
    const w = window as any; w.__folioStorageSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('birdsquad.account')) throw new DOMException('Storage full', 'QuotaExceededError');
      w.__folioStorageSet.call(this, key, value);
    };
  });
  const restoreWrites = () => page.evaluate(() => { Storage.prototype.setItem = (window as any).__folioStorageSet; });
  await tap(page, 'profile-folio-identity-cover-next-hit');
  await rejectWrites(); await tap(page, 'profile-folio-identity-apply-hit');
  expect(await snapshot()).toEqual(original);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').children.getByName('profile-folio-identity-status').text)).toContain('Could not save');
  await restoreWrites(); await tap(page, 'profile-folio-identity-cover-previous-hit');
  await tap(page, 'profile-folio-identity-description-hit');
  const input = page.getByRole('textbox', { name: 'Private Folio description' });
  await page.screenshot({ path: info.outputPath('description-editor-1000.png') });
  await tap(page, 'profile-folio-identity-sleeve-hit', 3);
  expect((await snapshot()).sleeve ?? 'field').toBe(original.sleeve ?? 'field');
  await input.fill('Cancel this private edit'); await input.press('Escape');
  expect((await snapshot()).description).toBe(original.description);
  await tap(page, 'profile-folio-identity-description-hit');
  await input.fill('A saved private description'); await input.press('Enter');
  expect((await snapshot()).description).toBe('A saved private description');
  // Tab now focuses explicit choices without applying or changing sections.
  for (let i = 0; i < 16; i++) {
    const focused = await page.evaluate(() => JSON.parse((window as any).render_game_to_text()).folioFocus.action);
    if (focused === 'profile-folio-identity-sleeve-hit:signal') break;
    await page.keyboard.press('Tab');
  }
  expect((await snapshot()).sleeve ?? 'field').toBe(original.sleeve ?? 'field');
  await page.keyboard.press(remapped ? 'q' : 'Enter');
  expect((await snapshot()).sleeve).toBe('signal');
  await tap(page, 'profile-folio-identity-cover-next-hit');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').children.getByName('profile-folio-identity-cover-hit').getData('cardId'))).toBe(original.cards[1].id);
  expect((await snapshot()).coverCardId).toBe(original.coverCardId);
  await tap(page, 'profile-folio-identity-cover-previous-hit');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').children.getByName('profile-folio-identity-cover-hit').getData('cardId'))).toBe(original.coverCardId);
  await page.keyboard.press(remapped ? 'b' : 'Escape');
  await tap(page, 'profile-folio-organizer-folder-hit', 2);
  expect((await snapshot()).folder).toBe('ready');
  await tap(page, 'profile-folio-organizer-rename-hit');
  const rename = page.getByRole('textbox', { name: 'Saved flight name' });
  await page.screenshot({ path: info.outputPath('rename-editor-1000.png') });
  await rename.fill('Reversible collection identity'); await rename.press('Enter');
  expect((await snapshot()).name).toBe('Reversible collection identity');
  const beforeFailure = await snapshot();
  await rejectWrites(); await tap(page, 'profile-folio-organizer-folder-hit', 3);
  expect(await snapshot()).toEqual(beforeFailure);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').children.getByName('profile-folio-organizer-status').text)).toContain('Could not save');
  await restoreWrites();
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').input.gamepad.emit('down', {}, { index: 1 }));
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').profileViewState.savedDeckOrganizerOpen)).toBe(false);
  expect((await snapshot()).cards).toEqual(original.cards);
  expect((await snapshot()).sourceSeed).toBe(original.sourceSeed);
  expect(errors).toEqual([]);
});
