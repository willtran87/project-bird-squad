import { test, expect, type Page } from '@playwright/test';
import { installVirtualController, pressController } from './helpers/virtual-controller';
import { frames, openTitle, overlapping, sceneTexts, tabTo, textState } from './helpers/engagement';

// Collection ceremony: each newly unlocked card, Leader or achievement gets
// one short reveal on the title or Collection. It is properly modal: the
// key that dismisses a reveal never also acts on the screen underneath.

const QUEUE = ['leader:talon', 'achievement:first_flight', 'card:wands_03', 'card:cups_05', 'card:swords_06', 'card:major_10', 'card:aviary_30'].join('\n');

const ceremony = (page: Page) => page.evaluate(() => (window as any).__birdSquadCeremony());
const menu = (page: Page) => page.evaluate(() => {
  const w = window as any, scene = w.__birdSquadGame.scene.getScene('MenuScene');
  return { active: scene.scene.isActive(), setupOpen: scene.setupOpen, focus: scene.menuFocus, settings: Boolean(scene.settingsOverlay), help: Boolean(scene.helpOverlay),
    launching: scene.titleRunLaunchPending, keyboard: scene.input.keyboard.enabled, pointer: scene.input.enabled,
    route: Boolean(w.__birdSquadGame.scene.isActive('RouteScene')), codex: Boolean(w.__birdSquadGame.scene.isActive('CodexScene')) };
});
const waitForReveal = (page: Page, index: number) => page.waitForFunction((index) => {
  const state = (window as any).__birdSquadCeremony?.();
  return state?.active && state.index === index;
}, index);
const UNTOUCHED = { active: true, setupOpen: false, focus: 'primaryRun', settings: false, help: false, launching: false, route: false, codex: false };

test('reveals queue on the title, each key moves on, and none reaches the title underneath', async ({ page }, info) => {
  const errors = await openTitle(page, { 'birdsquad.ceremony': QUEUE });
  await waitForReveal(page, 0);
  expect(await ceremony(page)).toMatchObject({ host: 'MenuScene', total: 5,
    reveal: { kind: 'leader', id: 'talon', kicker: 'LEADER UNLOCKED', title: 'The Talon', why: 'Unlocked: your first win.' } });
  expect(await menu(page)).toMatchObject({ ...UNTOUCHED, keyboard: false, pointer: false });
  // The DOM launcher above the canvas stands down with the title.
  await expect.poll(() => page.evaluate(() => (document.getElementById('flyway-launch') as HTMLElement | null)?.hidden ?? true)).toBe(true);
  await page.evaluate(() => (window as any).advanceTime(1200));
  await expect.poll(async () => (await ceremony(page)).flipped).toBe(true);
  expect(overlapping(await sceneTexts(page, 'CeremonyScene'))).toEqual([]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: info.outputPath('ceremony-leader.png') });

  // Enter would start a run, S opens Settings, Tab moves focus, H opens the guide.
  await page.keyboard.press('Enter');
  await waitForReveal(page, 1);
  expect((await ceremony(page)).reveal).toMatchObject({ kind: 'achievement', id: 'first_flight', title: 'First Flight', why: 'Win your first run.' });
  expect(await menu(page)).toMatchObject(UNTOUCHED);
  await page.keyboard.press('s');
  await waitForReveal(page, 2);
  expect((await ceremony(page)).reveal).toMatchObject({ kind: 'card', id: 'wands_03', kicker: 'NEW CARD' });
  expect(await menu(page)).toMatchObject(UNTOUCHED);
  await page.keyboard.press('Tab');
  await waitForReveal(page, 3);
  expect(await menu(page)).toMatchObject(UNTOUCHED);
  // A click anywhere moves on as well, including over a title control.
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * (260 / 1280), box.y + box.height * (426 / 720));
  await waitForReveal(page, 4);
  expect(await menu(page)).toMatchObject(UNTOUCHED);

  // Three cards get a reveal; the last one stands in for the other two.
  const last = await ceremony(page);
  expect(last.reveal).toMatchObject({ kind: 'card', id: 'swords_06' });
  expect(last.reveal.why).toContain('2 more new cards are waiting in your Collection.');
  expect(overlapping(await sceneTexts(page, 'CeremonyScene'))).toEqual([]);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CeremonyScene').children.getByName('ceremony-card-face').list.some((child: any) => child.type === 'Image'));
  await page.waitForTimeout(700);
  await page.screenshot({ path: info.outputPath('ceremony-card.png') });

  // Shown once: every entry is already retired, even before the last key.
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.ceremony'))).toBeNull();
  await page.keyboard.press('h');
  await page.waitForFunction(() => !(window as any).__birdSquadCeremony().active);
  await frames(page, 4);
  expect(await menu(page)).toMatchObject({ ...UNTOUCHED, keyboard: true, pointer: true });

  // The title has its input back.
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await menu(page)).focus).toBe('configure');
  await page.keyboard.press('h');
  await expect.poll(async () => (await menu(page)).help).toBe(true);

  // Once per unlock: a later visit has nothing to show.
  await page.reload();
  await page.waitForFunction(() => typeof (window as any).__birdSquadEngagement === 'function');
  await frames(page, 6);
  expect(await ceremony(page)).toMatchObject({ active: false, queue: [] });
  expect(errors).toEqual([]);
});

test('Escape and controller B skip the rest; a controller button moves on', async ({ page }) => {
  await installVirtualController(page);
  await openTitle(page, { 'birdsquad.ceremony': QUEUE, 'birdsquad.motionPreference': 'reduced' });
  await waitForReveal(page, 0);
  // Reduced Motion: the card is face up at once.
  expect((await ceremony(page)).flipped).toBe(true);
  await pressController(page, 0);
  await waitForReveal(page, 1);
  expect(await menu(page)).toMatchObject(UNTOUCHED);
  await pressController(page, 1);
  await page.waitForFunction(() => !(window as any).__birdSquadCeremony().active);
  await frames(page, 4);
  expect(await ceremony(page)).toMatchObject({ active: false, queue: [] });
  expect(await menu(page)).toMatchObject({ ...UNTOUCHED, keyboard: true, pointer: true });

  await page.evaluate((queue) => localStorage.setItem('birdsquad.ceremony', queue), QUEUE);
  await page.reload();
  await waitForReveal(page, 0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !(window as any).__birdSquadCeremony().active);
  expect(await ceremony(page)).toMatchObject({ active: false, queue: [] });
  expect(await menu(page)).toMatchObject(UNTOUCHED);
});

test('a card claimed on the route is revealed once, on the Collection if that comes first', async ({ page }) => {
  const errors = await openTitle(page, {}, './?flight=ceremony-route');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  // Starting decks are not unlocks.
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.ceremony'))).toBeNull();
  // The route's own claim path, twice: a second copy is not a new unlock.
  const granted = await page.evaluate(() => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const first = route.grantSpecificCard('wands_03', 'route_reward');
    route.runState.deck = route.runState.deck.filter((card: any) => card.id !== 'wands_03');
    return [first, route.grantSpecificCard('wands_03', 'market')];
  });
  expect(granted).toEqual([true, true]);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.ceremony')?.trim())).toBe('card:wands_03');

  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('CodexScene');
    w.__birdSquadGame.scene.getScene('RouteScene').scene.start('CodexScene', {});
  });
  await page.waitForFunction(() => (window as any).__birdSquadCeremony?.().active);
  expect(await ceremony(page)).toMatchObject({ host: 'CodexScene', total: 1,
    reveal: { kind: 'card', id: 'wands_03', why: 'First copy, picked up on the route.' } });
  const codex = () => page.evaluate(() => {
    const scene = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    return { active: scene.scene.isActive(), atlas: scene.collectionAtlasOpen, keyboard: scene.input.keyboard.enabled, pointer: scene.input.enabled };
  });
  const before = await codex();
  expect(before).toMatchObject({ active: true, keyboard: false, pointer: false });
  // G toggles the Collection atlas when the Collection has the keyboard.
  await page.keyboard.press('g');
  await page.waitForFunction(() => !(window as any).__birdSquadCeremony().active);
  await frames(page, 4);
  expect(await codex()).toEqual({ ...before, keyboard: true, pointer: true });
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.ceremony'))).toBeNull();
  await page.keyboard.press('g');
  await expect.poll(async () => (await codex()).atlas).toBe(!before.atlas);
  expect(errors).toEqual([]);
});
