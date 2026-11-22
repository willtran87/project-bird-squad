import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { installVirtualController, pressController } from './helpers/virtual-controller';
import { flightSummary, frames, openTitle, overlapping, sceneTexts, tabTo, textState } from './helpers/engagement';

// Run recap: one finished flight from the flight log as a card, a photo view
// with every control hidden, and a PNG of that view.

const LOSS = flightSummary(1, { result: 'loss', leaderId: 'tidewarden', mapId: 'map_02_canal_markets', currentCohesion: 0, seed: 'recap-loss' });
const WIN = flightSummary(2, { seed: 'recap-win' });
const LOG = { 'birdsquad.runs': JSON.stringify([LOSS, WIN]) };

async function openRecap(page: Page) {
  await tabTo(page, 'recap');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).mode === 'runRecap');
  await frames(page);
}

const card = (page: Page) => page.evaluate(() => {
  const scene = (window as any).__birdSquadGame.scene.getScene('RecapScene');
  const container = scene.children.getByName('recap-card');
  const plate = container.getByName('recap-card-plate').getBounds();
  return {
    x: container.x, y: container.y, scale: container.scaleX,
    plate: { x: plate.x, y: plate.y, right: plate.right, bottom: plate.bottom },
    stats: Object.fromEntries(container.list.filter((child: any) => child.name === 'recap-stat-value').map((child: any) => [child.getData('stat'), child.text])),
    score: container.getByName('recap-score').text,
    portrait: Boolean(container.getByName('recap-portrait')),
    backdrop: scene.children.getByName('engagement-backdrop').texture.key,
  };
});

test('a finished flight reads as a recap card with an animated entrance', async ({ page }, info) => {
  const errors = await openTitle(page, LOG);
  const title = await page.evaluate(() => (window as any).__birdSquadEngagement());
  expect(title).toMatchObject({ recapAvailable: true, recapNew: true, focusOrder: ['daily', 'recap'] });
  await openRecap(page);

  // The newest flight opens first. The numbers count up on the scene clock.
  const opening = await textState(page);
  expect(opening).toMatchObject({ runId: WIN.id, index: 1, total: 2, view: 'recap', result: 'win', leader: 'The Talon', headline: 'Every district cleared' });
  expect(opening.focus).toMatchObject({ label: 'Photo view', count: 5 });
  await page.evaluate(() => (window as any).advanceTime(2400));
  await expect.poll(async () => (await textState(page)).settled).toBe(true);

  const recap = await textState(page);
  expect(recap.facts).toMatchObject({
    districtsCleared: 4, districtTotal: 4, fightsWon: 11, damageDealt: 935, damageTaken: 40, bestFightDamage: 130,
    deckSize: 14, waymarks: 3, cardsAdded: 4, durationMs: 1_543_000, topCard: { cardId: 'swords_03', damage: 286 },
  });
  expect(recap.score).toBe(8798);
  expect(recap.closing.length).toBeGreaterThan(20);
  expect(recap.closing).not.toContain('{');
  expect(recap.daily).toBe(false);
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('RecapScene').children.getByName('recap-card').getByName('recap-portrait')));
  const shown = await card(page);
  expect(shown.stats).toEqual({
    'Districts cleared': '4 / 4', 'Fights won': '11', Time: '25m 43s', 'Damage dealt': '935', 'Damage taken': '40',
    'Biggest fight': '130 dmg', Deck: '14 cards', 'Cards added': '4', Waymarks: '3',
  });
  expect(shown.score).toBe('8,798');

  // Readable at 1280x720: nothing overlaps, and the card's text stays on the card.
  const texts = await sceneTexts(page, 'RecapScene');
  expect(overlapping(texts)).toEqual([]);
  for (const text of texts) {
    expect(text.size, text.text).toBeGreaterThanOrEqual(19);
    expect(text.x, text.text).toBeGreaterThanOrEqual(16);
    expect(text.right, text.text).toBeLessThanOrEqual(1264);
    expect(text.bottom, text.text).toBeLessThanOrEqual(712);
  }
  for (const text of texts.filter((entry) => entry.name.startsWith('recap-stat-') || ['recap-headline', 'recap-closing', 'recap-score', 'recap-top-card', 'recap-leader'].includes(entry.name))) {
    expect(text.x, text.text).toBeGreaterThanOrEqual(shown.plate.x + 8);
    expect(text.right, text.text).toBeLessThanOrEqual(shown.plate.right - 8);
    expect(text.bottom, text.text).toBeLessThanOrEqual(shown.plate.bottom - 4);
  }
  await page.screenshot({ path: info.outputPath('recap-win.png') });

  // Older flights stay in reach; a loss names where it ended.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  expect((await textState(page)).focus).toMatchObject({ label: '‹ Older' });
  await page.keyboard.press('Enter');
  await page.waitForFunction((id) => JSON.parse((window as any).render_game_to_text()).runId === id, LOSS.id);
  await page.evaluate(() => (window as any).advanceTime(2400));
  await expect.poll(async () => (await textState(page)).settled).toBe(true);
  const loss = await textState(page);
  expect(loss).toMatchObject({ index: 0, result: 'loss', leader: 'The Tidewarden', headline: 'Scattered at Canal Markets', score: 2500 });
  expect(loss.closing).toContain('Canal Markets');
  expect(loss.facts).toMatchObject({ districtsCleared: 1, fightsWon: 10 });
  expect(overlapping(await sceneTexts(page, 'RecapScene'))).toEqual([]);
  await page.screenshot({ path: info.outputPath('recap-loss.png') });

  // Back returns to the title, and the "new" mark is spent.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleFocus);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').children.getByName('title-daily-caption'));
  expect((await page.evaluate(() => (window as any).__birdSquadEngagement())).recapNew).toBe(false);
  expect(errors).toEqual([]);
});

test('photo view hides the controls and Save PNG downloads the card', async ({ page }, info) => {
  await installVirtualController(page);
  const errors = await openTitle(page, { ...LOG, 'birdsquad.motionPreference': 'reduced' });
  await openRecap(page);
  // Reduced Motion: final numbers from the first frame.
  expect((await textState(page)).settled).toBe(true);
  expect((await card(page)).score).toBe('8,798');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RecapScene').children.getByName('engagement-backdrop').texture.key !== 'splash');
  const framed = await card(page);
  expect(framed.scale).toBe(1);

  await page.keyboard.press('Enter');
  await frames(page);
  let state = await textState(page);
  expect(state).toMatchObject({ view: 'photo', chromeVisible: false });
  const photo = await card(page);
  expect(photo.scale).toBeGreaterThan(1);
  expect(photo.plate.x).toBeGreaterThanOrEqual(16);
  expect(photo.plate.right).toBeLessThanOrEqual(1264);
  expect(photo.plate.y).toBeGreaterThanOrEqual(8);
  expect(photo.plate.bottom).toBeLessThanOrEqual(712);
  // Nothing but the card and the district painting is drawn.
  const visibleControls = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RecapScene').children.list
    .filter((child: any) => /^recap-(older|newer|photo|save|back|status|title|position)/.test(child.name) && child.visible).map((child: any) => child.name));
  expect(visibleControls).toEqual([]);
  await page.waitForTimeout(2300);
  await page.screenshot({ path: info.outputPath('recap-photo.png') });

  // Any key returns, and that key is not also read by the control it uncovers.
  await page.keyboard.press('Enter');
  await frames(page, 4);
  state = await textState(page);
  expect(state).toMatchObject({ view: 'recap', chromeVisible: true, photosSaved: 0 });
  expect(state.focus).toMatchObject({ label: 'Photo view' });
  // A controller button leaves photo view too.
  await pressController(page, 0);
  expect((await textState(page)).view).toBe('photo');
  await pressController(page, 2);
  expect((await textState(page)).view).toBe('recap');

  await page.keyboard.press('ArrowRight');
  expect((await textState(page)).focus).toMatchObject({ label: 'Save PNG' });
  const downloading = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('bird-squad-flight-recap-win.png');
  const file = info.outputPath('saved-photo.png');
  await download.saveAs(file);
  const bytes = readFileSync(file);
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // IHDR: the picture is the whole 1280x720 photo view.
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1280, 720]);
  expect(bytes.length).toBeGreaterThan(40_000);
  await expect.poll(async () => (await textState(page)).photosSaved).toBe(1);
  state = await textState(page);
  expect(state).toMatchObject({ view: 'recap', chromeVisible: true, saving: false, status: 'Saved bird-squad-flight-recap-win.png' });
  expect(state.lastPhoto).toMatchObject({ filename: 'bird-squad-flight-recap-win.png', width: 1280, height: 720 });
  expect(errors).toEqual([]);
});
