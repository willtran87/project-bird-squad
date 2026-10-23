import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import {targetGeometry,checkTargetGeometry} from './helpers/target-geometry';

test.use({ hasTouch: true });
const sizes = [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }];
async function tap(page: Page, name: string, index = 0) {
  await settleCanvas(page);
  const point = await page.evaluate(({ name, index }) => {
    const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
    const hit = s.children.list.filter((o: any) => o.name === name)[index];
    if (!hit) throw new Error(`Missing control ${name}`);
    const canvas = s.game.canvas.getBoundingClientRect();
    return { x: canvas.left + hit.x * canvas.width / 1280, y: canvas.top + hit.y * canvas.height / 720 };
  }, { name, index });
  await page.touchscreen.tap(point.x, point.y); await settleCanvas(page);
}
async function capture(page: Page, info: TestInfo, key: string, scrim: string, frame: string, textbox?: string) {
  await settleCanvas(page);
  const geometry = await page.evaluate(({ scrim, frame }) => {
    const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
    const objects = s.children.list.slice(s.children.list.findIndex((o: any) => o.name === scrim));
    const bounds = s.children.getByName(frame).getBounds(), canvas = s.game.canvas.getBoundingClientRect();
    const scale = canvas.width / 1280;
    const inside = (b: any) => b.left >= bounds.left && b.right <= bounds.right && b.top >= bounds.top && b.bottom <= bounds.bottom;
    const clear = (a: any, b: any) => a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
    const texts = objects.filter((o: any) => o.type === 'Text' && o.visible);
    const controls = objects.filter((o: any) => o.input?.enabled && o.name !== scrim);
    return {
      texts: texts.map((o: any) => ({ text: o.text, fits: inside(o.getBounds()), size: parseFloat(o.style.fontSize) * scale,
        css: { x: canvas.left + o.getBounds().left * scale, y: canvas.top + o.getBounds().top * scale, width: o.width * scale, height: o.height * scale } })),
      overlaps: texts.flatMap((a: any, i: number) => texts.slice(i + 1).filter((b: any) => !clear(a.getBounds(), b.getBounds())).map((b: any) => [a.text, b.text])),
      controls: controls.map((o: any) => ({ fits: inside(o.getBounds()), width: o.width * scale, height: o.height * scale })),
      controlsOverlap: controls.some((a: any, i: number) => controls.slice(i + 1).some((b: any) => !clear(a.getBounds(), b.getBounds()))),
      cssFrame: { x: canvas.left + bounds.left * scale, y: canvas.top + bounds.top * scale, width: bounds.width * scale, height: bounds.height * scale },
    };
  }, { scrim, frame });
  for (const text of geometry.texts) { expect(text.fits, text.text).toBe(true); expect(text.size, text.text).toBeGreaterThanOrEqual(14); }
  expect(geometry.overlaps).toEqual([]); expect(geometry.controlsOverlap).toBe(false);
  checkTargetGeometry(await targetGeometry(page,'ProfileScene'),'Folio starter/record');
  for (const hit of geometry.controls) { expect(hit.fits).toBe(true); expect(hit.width).toBeGreaterThanOrEqual(44); expect(hit.height).toBeGreaterThanOrEqual(44); }
  if (textbox) {
    const input = page.getByRole('textbox', { name: textbox });
    const box = (await input.boundingBox())!, parent = geometry.cssFrame;
    expect(box.x).toBeGreaterThanOrEqual(parent.x); expect(box.x + box.width).toBeLessThanOrEqual(parent.x + parent.width);
    expect(box.y).toBeGreaterThanOrEqual(parent.y); expect(box.y + box.height).toBeLessThanOrEqual(parent.y + parent.height);
    expect(await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    for (const { text, css } of geometry.texts) expect(box.x + box.width <= css.x || box.x >= css.x + css.width || box.y + box.height <= css.y || box.y >= css.y + css.height, text).toBe(true);
  }
  await page.screenshot({ path: info.outputPath(`${key}.png`) });
}
async function boot(page: Page, remapped: boolean) {
  await page.addInitScript(remapped => {
    const ids = ['major_00', 'wands_ace', 'wands_fledgling', 'swords_ace', 'swords_fledgling', 'cups_ace', 'cups_fledgling', 'pentacles_04', 'pentacles_fledgling', 'aviary_25'];
    const cards = [{ id: 'major_00', upgraded: false }, { id: 'wands_ace', upgraded: true }, { id: 'cups_ace', upgraded: false }];
    const deck = { id: 'reader-source', lineageId: 'reader-source', revision: 99, name: 'W'.repeat(32), leaderId: 'spark_caller',
      cards, createdAt: 100, updatedAt: 100, favorite: false, archived: false, sourceSeed: 'private-seed', runMode: 'quick', notes: 'W'.repeat(240) };
    const account = { discoveredCards: ids, unlockedLeaders: ['fledgling', 'spark_caller'], decks: [deck],
      cardCollection: Object.fromEntries(ids.map(id => [id, { timesClaimed: 1, firstAcquiredAt: 100, firstSource: 'starter_flock' }])) };
    for (const key of ['birdsquad.account', 'birdsquad.account.backup']) localStorage.setItem(key, JSON.stringify(account));
    const runs = Array.from({ length: 50 }, (_, i) => ({ id: `run-${1780100000000 + i}-reader-${i}`, seed: `long-private-flight-${i}-` + 'W'.repeat(80),
      result: i % 2 ? 'win' : 'loss', leaderId: 'spark_caller', difficulty: 2, runMode: 'quick', mapId: 'map_01_rooftop_blocks',
      finalNodeId: 'm1_entry', turnsTaken: 999, durationMs: 60000, currentCohesion: i % 2 ? 30 : 0, maxCohesion: 40,
      scrapEarned: 12, scrapSpent: 5, finalScrap: 7, path: ['m1_entry'], deck: cards, routeMarks: [], suppliesUsed: [], signals: [], cardRewards: [],
      routeDecisions: [], combatResults: [], districtContracts: [], seenEnemyMoves: [], combatPace: 'standard', animationPace: 'standard',
      firstFlightGuide: { enabled: false, completed: true }, decisionStats: {} }));
    for (const key of ['birdsquad.runs', 'birdsquad.runs.backup']) localStorage.setItem(key, JSON.stringify(runs));
    if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { previous: 'KeyJ', next: 'KeyK', confirm: 'KeyQ', back: 'KeyB' } }));
  }, remapped);
  await page.setViewportSize(sizes[0]); await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => { const w = window as any; await w.__birdSquadEnsureScene('ProfileScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('ProfileScene'); });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('ProfileScene') && !(window as any).__birdSquadGame.scene.getScene('ProfileScene').cameras.main.fadeEffect.isRunning);
  await tap(page, 'profile-folios-tab-hit');
}
const snapshot = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account')!));
const blockWrites = (page: Page) => page.evaluate(() => { const w = window as any; w.__readerSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) { if (key.startsWith('birdsquad.account')) throw new DOMException('Storage full', 'QuotaExceededError'); w.__readerSetItem.call(this, key, value); }; });
const restoreWrites = (page: Page) => page.evaluate(() => { Storage.prototype.setItem = (window as any).__readerSetItem; });

for (const remapped of [false, true]) test(`Starter and Field Record readers stay readable and preserve private data, remapped=${remapped}`, async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page, remapped); const original = await snapshot(page);
  await tap(page, 'profile-folio-template-hit');
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const [kind, index] of [['ready', 0], ['missing', 1], ['locked', 2], ['full', 0]] as const) {
      await page.evaluate(({ original, kind, index }) => {
        const account = structuredClone(original);
        if (kind === 'full') account.decks = Array.from({ length: 6 }, (_, i) => ({ ...account.decks[0], id: `full-${i}` }));
        localStorage.setItem('birdsquad.account', JSON.stringify(account));
        const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene'); s.profileViewState.savedDeckTemplateIndex = index;
        s.profileViewState.savedDeckStatus = 'idle'; s.renderPremiumProfileScene();
      }, { original, kind, index });
      await capture(page, info, `template-${kind}-${size.width}`, 'profile-folio-template-blocker', 'profile-folio-template-frame');
    }
  }
  await page.evaluate(original => { localStorage.setItem('birdsquad.account', JSON.stringify(original));
    (window as any).__birdSquadGame.scene.getScene('ProfileScene').renderPremiumProfileScene(); }, original);
  await blockWrites(page); await tap(page, 'profile-folio-template-build-hit');
  expect(await snapshot(page)).toEqual(original);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').children.getByName('profile-folio-template-detail').text)).toContain('Could not save');
  await capture(page, info, 'template-save-failure-1000', 'profile-folio-template-blocker', 'profile-folio-template-frame');
  await restoreWrites(page);
  await page.keyboard.press(remapped ? 'k' : 'ArrowRight'); await page.keyboard.press(remapped ? 'q' : 'Enter');
  expect(await snapshot(page)).toEqual(original);
  await page.keyboard.press(remapped ? 'b' : 'Escape');
  await page.keyboard.press('i');
  const code = page.getByRole('textbox', { name: 'Flight share code' });
  for (const size of sizes) { await page.setViewportSize(size); await capture(page, info, `import-${size.width}`, 'profile-folio-import-scrim', 'profile-folio-import-prompt-frame', 'Flight share code'); }
  await code.fill('not a valid flight code'); await code.press('Enter'); expect(await snapshot(page)).toEqual(original);
  await page.keyboard.press('i'); await code.fill('cancel this'); await code.press('Escape'); expect(await snapshot(page)).toEqual(original);
  await tap(page, 'profile-folio-lab-hit'); await page.keyboard.press('n');
  for (const size of sizes) { await page.setViewportSize(size); await capture(page, info, `field-record-${size.width}`, 'profile-folio-field-record-scrim', 'profile-folio-field-record-frame'); }
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').children.list.filter((o: any) => o.name === 'profile-folio-field-record-flight-row').length)).toBe(5);
  await tap(page, 'profile-folio-field-record-edit-hit');
  const notes = page.getByRole('textbox', { name: 'Private Folio matchup notes' });
  for (const size of sizes) { await page.setViewportSize(size); await capture(page, info, `notes-${size.width}`, 'profile-folio-notes-scrim', 'profile-folio-notes-prompt-frame', 'Private Folio matchup notes'); }
  await notes.fill('Do not save this'); await page.locator('#folio-editor-cancel').tap(); expect(await snapshot(page)).toEqual(original);
  await tap(page, 'profile-folio-field-record-edit-hit'); await notes.fill('Keep pressure'); await notes.press('Shift+Enter'); await notes.pressSequentially('Guard before Roost'); await page.locator('#folio-editor-save').tap();
  expect((await snapshot(page)).decks[0].notes).toBe('Keep pressure\nGuard before Roost');
  const saved = await snapshot(page);
  await tap(page, 'profile-folio-field-record-edit-hit'); await notes.fill('This write must fail'); await blockWrites(page); await notes.press('Enter');
  expect(await snapshot(page)).toEqual(saved);
  await expect(notes).toHaveValue('This write must fail');
  await expect(page.locator('#folio-notes-error')).toBeVisible();
  for(const size of sizes){
    await page.setViewportSize(size);await settleCanvas(page);
    checkTargetGeometry(await targetGeometry(page,'ProfileScene'),'failed notes editor');
    const frame=await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('ProfileScene');
      const b=s.children.getByName('profile-folio-notes-prompt-frame').getBounds(),c=s.game.canvas.getBoundingClientRect();
      return{left:c.left+b.left*c.width/1280,right:c.left+b.right*c.width/1280,bottom:c.top+b.bottom*c.height/720};});
    const error=(await page.locator('#folio-notes-error').boundingBox())!;
    expect(error.x).toBeGreaterThanOrEqual(frame.left+8);
    expect(error.x+error.width).toBeLessThanOrEqual(frame.right-8);
    expect(error.y+error.height).toBeLessThanOrEqual(frame.bottom-8);
    await page.screenshot({path:info.outputPath(`notes-retained-error-${size.width}.png`)});
  }
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').children.getByName('profile-folio-field-record-note-status').text)).toContain('Could not save');
  await restoreWrites(page);
  await notes.press('Escape');
  await capture(page, info, 'notes-save-failure-1000', 'profile-folio-field-record-scrim', 'profile-folio-field-record-frame');
  const history = await page.evaluate(() => localStorage.getItem('birdsquad.runs'));
  await page.evaluate(saved => {
    for (const key of ['birdsquad.runs', 'birdsquad.runs.backup']) localStorage.setItem(key, '[]');
    const account = structuredClone(saved); account.decks[0].notes = '';
    localStorage.setItem('birdsquad.account', JSON.stringify(account));
    const scene = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
    scene.profileViewState.savedDeckStatus = 'idle'; scene.renderPremiumProfileScene();
  }, saved);
  for (const size of sizes) { await page.setViewportSize(size); await capture(page, info, `field-record-empty-${size.width}`, 'profile-folio-field-record-scrim', 'profile-folio-field-record-frame'); }
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').children.getByName('profile-folio-field-record-empty').text)).toContain('No completed flight matches');
  await page.evaluate(({ saved, history }) => {
    localStorage.setItem('birdsquad.account', JSON.stringify(saved));
    for (const key of ['birdsquad.runs', 'birdsquad.runs.backup']) localStorage.setItem(key, history!);
    (window as any).__birdSquadGame.scene.getScene('ProfileScene').renderPremiumProfileScene();
  }, { saved, history });
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene').input.gamepad.emit('down', {}, { index: 1 }));
  expect(await page.evaluate(() => JSON.parse((window as any).render_game_to_text()).savedFlightFolios.flightLab.open)).toBe(true);
  expect((await snapshot(page)).decks[0].cards).toEqual(original.decks[0].cards); expect(errors).toEqual([]);
});
