import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { flockLeaders } from '../src/game/leaders';
import type { SavedDeckRecord } from '../src/game/saved-decks';
import { boot, clickNamedGameObject, clickFlightLabTool, focusFolioControl, openLabFixture } from './helpers/smoke';

// Split from the former tests/smoke.spec.ts (folio topics). Tests drive
// scenes through the deterministic text-state harness on window.

test('saved flight folios preserve exact decks, refuse replacement, and support favorite names and backup', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['major_00', 'wands_ace', 'swords_ace'],
      favoriteCards: [],
      cardCollection: {},
      decks: [
        {
          id: 'legacy-folio',
          name: 'Trusted Line',
          leaderId: 'fledgling',
          cards: [{ id: 'major_00', upgraded: true }],
          createdAt: 100,
          updatedAt: 100,
          favorite: true,
          sourceSeed: 'trusted-seed',
          runMode: 'full',
        },
        {
          id: 'legacy-folio',
          name: 'Duplicate Must Drop',
          leaderId: 'fledgling',
          cards: [{ id: 'wands_ace', upgraded: false }],
          createdAt: 101,
          updatedAt: 101,
          favorite: false,
          sourceSeed: 'duplicate-seed',
          runMode: 'full',
        },
        { id: 'empty-folio', name: 'Empty Must Drop', leaderId: 'fledgling', cards: [] },
      ],
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    route.runState.deck = [
      { id: 'major_00', upgraded: true },
      { id: 'major_00', upgraded: false },
      { id: 'wands_ace', upgraded: true },
    ];
    route.runState.leaderId = 'spark_caller';
    route.runState.seed = 'folio-flight-seed';
    route.runState.runMode = 'quick';
    route.openDeckOverlay();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.deckReview?.open === true && state.deckReview?.browserRenderer?.loaded === true;
  });

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.deckReview.savedFlights).toMatchObject({
    count: 1,
    capacity: 6,
    status: 'idle',
    canSave: true,
    currentDeckCards: 3,
    persisted: true,
    affectsPower: false,
    refusesReplacementAtCapacity: true,
    location: 'Flock Record / Folios',
    input: { pointer: true, keyboard: 'V', controller: 'Y' },
  });
  await clickNamedGameObject(page, 'RouteScene', 'deck-review-save-folio-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.savedFlights?.count === 2);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.deckReview.savedFlights.status).toBe('saved');
  let account = JSON.parse(await page.evaluate(() => localStorage.getItem('birdsquad.account') ?? '{}'));
  expect(account.decks).toHaveLength(2);
  expect(account.decks[0]).toMatchObject({
    name: 'The Spark-Caller Flight 2',
    leaderId: 'spark_caller',
    cards: [
      { id: 'major_00', upgraded: true },
      { id: 'major_00', upgraded: false },
      { id: 'wands_ace', upgraded: true },
    ],
    sourceSeed: 'folio-flight-seed',
    runMode: 'quick',
    favorite: false,
  });
  expect(account.decks[1].id).toBe('legacy-folio');

  await page.keyboard.press('v');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.savedFlights?.count === 3);
  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.input.gamepad.emit('down', route.input.gamepad.pad1, { index: 3 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.savedFlights?.count === 4);
  await page.keyboard.press('v');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.savedFlights?.count === 5);
  await page.keyboard.press('v');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.savedFlights?.count === 6);
  const idsAtCapacity = await page.evaluate(() => (
    JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').decks.map((deck: any) => deck.id)
  ));
  await page.keyboard.press('v');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.savedFlights?.status === 'full');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.deckReview.savedFlights).toMatchObject({ count: 6, capacity: 6, status: 'full', canSave: false });
  expect(await page.evaluate(() => (
    JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').decks.map((deck: any) => deck.id)
  ))).toEqual(idsAtCapacity);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Folios are full; no saved deck was replaced');

  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.viewActive === true);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios).toMatchObject({
    count: 6,
    capacity: 6,
    empty: false,
    full: true,
    selectedIndex: 0,
    viewActive: true,
    page: 1,
    pageCount: 6,
    persisted: true,
    affectsPower: false,
    refusesReplacementAtCapacity: true,
  });
  expect(state.savedFlightFolios.items[0]).toMatchObject({
    leader: 'The Spark-Caller',
    cardCount: 3,
    upgradedCount: 2,
    favorite: false,
    sourceSeed: 'folio-flight-seed',
    runMode: 'quick',
  });

  await page.keyboard.press('c');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'favorited');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.items[0].favorite).toBe(true);
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-rename-hit');
  const renameInput = page.locator('input[aria-label="Saved flight name"]');
  await expect(renameInput).toBeVisible();
  await renameInput.fill('Canal Spark Archive');
  await renameInput.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'renamed');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.items[0]).toMatchObject({ name: 'Canal Spark Archive', favorite: true });
  expect(state.savedFlightFolios.renaming).toBe(false);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Selected Canal Spark Archive, The Spark-Caller, 3 cards, revision 1, favorite');
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.screenshot({ path: '.artifacts/test-results/saved-flight-folios-profile.png', fullPage: true });

  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-data-hit');
  const downloadPromise = page.waitForEvent('download');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-download-hit');
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error('Flight Folios backup did not produce a local file');
  const payload = JSON.parse(await readFile(downloadedPath, 'utf8'));
  expect(payload.data.account.decks).toHaveLength(6);
  expect(payload.data.account.decks[0]).toMatchObject({
    name: 'Canal Spark Archive',
    favorite: true,
    cards: [
      { id: 'major_00', upgraded: true },
      { id: 'major_00', upgraded: false },
      { id: 'wands_ace', upgraded: true },
    ],
  });
});

test('flight folio forks preserve revisions and BSF1 codes import exact privacy-safe decks', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => localStorage.setItem('test.flightCode', value),
      },
    });
    const account = {
      discoveredCards: ['major_00', 'wands_ace'],
      favoriteCards: [],
      cardCollection: {},
      decks: [{
        id: 'trusted-line',
        name: 'Private Canary Notes',
        leaderId: 'spark_caller',
        cards: [
          { id: 'major_00', upgraded: true },
          { id: 'major_00', upgraded: false },
          { id: 'wands_ace', upgraded: true },
        ],
        createdAt: 100,
        updatedAt: 100,
        favorite: true,
        sourceSeed: 'private-flight-seed',
        runMode: 'quick',
      }],
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.viewActive === true);

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios).toMatchObject({
    count: 1,
    capacity: 6,
    page: 1,
    pageCount: 1,
    canDuplicate: true,
    canImport: true,
    shareCode: {
      version: 1,
      prefix: 'BSF1',
      checksumValidated: true,
      excludesAccountData: true,
      excludesCustomName: true,
      excludesFlightSeed: true,
      preservesCardOrder: true,
      preservesDuplicates: true,
      preservesPreenedState: true,
    },
    inputs: {
      duplicate: 'D / controller LT / pointer',
      copyCode: 'E / controller RT / pointer',
      importCode: 'I / controller L3 / pointer',
    },
  });
  expect(state.savedFlightFolios.items[0]).toMatchObject({
    id: 'trusted-line',
    lineageId: 'trusted-line',
    revision: 1,
    parentId: null,
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('fork without changing the original');

  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-duplicate-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'duplicated');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios).toMatchObject({ count: 2, selectedIndex: 0, page: 1, pageCount: 2 });
  expect(state.savedFlightFolios.items[0]).toMatchObject({
    name: 'Private Canary Notes Fork 2',
    lineageId: 'trusted-line',
    revision: 2,
    parentId: 'trusted-line',
    favorite: false,
    sourceSeed: 'private-flight-seed',
    cards: [
      { id: 'major_00', upgraded: true },
      { id: 'major_00', upgraded: false },
      { id: 'wands_ace', upgraded: true },
    ],
  });
  expect(state.savedFlightFolios.items[1]).toMatchObject({
    id: 'trusted-line',
    name: 'Private Canary Notes',
    lineageId: 'trusted-line',
    revision: 1,
    parentId: null,
    favorite: true,
  });

  await page.keyboard.press('e');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'codeCopied');
  const copied = await page.evaluate(() => localStorage.getItem('test.flightCode') ?? '');
  expect(copied).toMatch(/^BSF1\.[A-Za-z0-9_-]+\.[a-z0-9]+$/);
  const decoded = await page.evaluate((code) => {
    const payload = code.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(payload + '='.repeat((4 - payload.length % 4) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0))));
  }, copied);
  expect(decoded).toEqual([
    'spark_caller',
    1,
    [['major_00', 1], ['major_00', 0], ['wands_ace', 1]],
  ]);
  expect(JSON.stringify(decoded)).not.toContain('Private Canary Notes');
  expect(JSON.stringify(decoded)).not.toContain('private-flight-seed');

  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-import-hit');
  let codeInput = page.locator('input[aria-label="Flight share code"]');
  await expect(codeInput).toBeVisible();
  expect(await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return [
      'profile-folio-import-scrim',
      'profile-folio-import-prompt-frame',
      'profile-folio-import-prompt-title',
      'profile-folio-import-prompt-help',
    ].every((name) => profile.children.list.some((child: any) => child.name === name));
  })).toBe(true);
  await page.screenshot({ path: '.artifacts/test-results/flight-folio-import-prompt.png', fullPage: true });
  await codeInput.fill(`${copied.slice(0, -1)}x`);
  await codeInput.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'invalidCode');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.count).toBe(2);
  expect(state.savedFlightFolios.importing).toBe(true);
  await expect(codeInput).toHaveValue(`${copied.slice(0, -1)}x`);
  await expect(page.locator('#folio-editor-error')).toContainText('Invalid code');
  await codeInput.press('Escape');

  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 10 });
  });
  codeInput = page.locator('input[aria-label="Flight share code"]');
  await expect(codeInput).toBeVisible();
  await codeInput.fill(copied);
  await codeInput.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'imported');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios).toMatchObject({ count: 3, selectedIndex: 0, page: 1, pageCount: 3 });
  expect(state.savedFlightFolios.items[0]).toMatchObject({
    name: 'Shared Flight',
    leaderId: 'spark_caller',
    revision: 1,
    parentId: null,
    favorite: false,
    sourceSeed: '',
    runMode: 'quick',
    cards: [
      { id: 'major_00', upgraded: true },
      { id: 'major_00', upgraded: false },
      { id: 'wands_ace', upgraded: true },
    ],
  });
  expect(state.savedFlightFolios.items[0].lineageId).toBe(state.savedFlightFolios.items[0].id);

  await page.keyboard.press('d');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.count === 4);
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 6 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.count === 5);
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 7 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'codeCopied');
  await page.keyboard.press('d');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.count === 6);
  const idsAtCapacity = await page.evaluate(() => (
    JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').decks.map((deck: any) => deck.id)
  ));
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 6 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'full');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios).toMatchObject({
    count: 6,
    full: true,
    canDuplicate: false,
    canImport: false,
    refusesReplacementAtCapacity: true,
  });
  expect(await page.evaluate(() => (
    JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').decks.map((deck: any) => deck.id)
  ))).toEqual(idsAtCapacity);

  await page.setViewportSize({ width: 1000, height: 560 });
  await page.screenshot({ path: '.artifacts/test-results/flight-folio-library-profile.png', fullPage: true });
});

test('Flight Lab matches live combat openings for every Leader and Preened deck', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  for (const leader of flockLeaders) {
    for (const upgraded of [false, true]) {
      const deck: SavedDeckRecord = {
        id: 'parity', lineageId: 'parity', revision: 1, name: 'Opening parity', leaderId: leader.id,
        cards: leader.startingDeckIds.map((id) => ({ id, upgraded })),
        createdAt: 1, updatedAt: 1, favorite: false, archived: false, sourceSeed: 'parity', runMode: 'quick',
      };
      const analysis = await openLabFixture(page, deck);
      const actual = await page.evaluate(async (fixture) => {
        const battle: any = await window.__birdSquadStartScene!('BattleScene', {
          routeNodeId: 'm1_entry', runState: {
            deck: fixture.cards, leaderId: fixture.leaderId, difficulty: 0, seed: 'parity', runMode: 'quick',
            currentHp: 30, scrap: 40, routeMarks: [], supplies: [], supplySlots: 2, completedRouteNodeIds: [], mapIndex: 0,
            routeLog: [], signalChoices: [], rewardEvents: [], routeDecisions: [], suppliesUsed: [], combatResults: [],
          },
        });
        return { handTarget: battle.handTargetSize(), energy: battle.energy, ids: battle.hand.map((card: any) => card.id) };
      }, deck);
      expect(analysis.rules.handSize, `${leader.id} upgraded=${upgraded}`).toBe(actual.handTarget);
      expect(analysis.rules.wingbeats).toBe(actual.energy);
      expect(analysis.sample.cards.map((card) => card.id)).toEqual(actual.ids);
    }
  }
});

test('Flight Lab separates opening affordability from resource effects and hand permutations', async ({ page }) => {
  await boot(page);
  const library = JSON.parse(await readFile('data/game/alpha-cards.json', 'utf8')).cards;
  const cards = library.filter((card: any) => card.kind !== 'snag' && card.cost === 2).slice(0, 3);
  const deck: SavedDeckRecord = {
    id: 'budget', lineageId: 'budget', revision: 1, name: 'Budget', leaderId: 'fledgling',
    cards: cards.map((card) => ({ id: card.id, upgraded: false })), createdAt: 1, updatedAt: 1,
    favorite: false, archived: false, sourceSeed: '', runMode: 'quick',
  };
  const analysis = await openLabFixture(page, deck);
  expect(analysis.sample.playableCount).toBe(3);
  expect(analysis.sample.affordableTogether).toBe(1);
  expect(analysis.consistency.uniqueHands).toBe(1);
  expect((await openLabFixture(page, { ...deck, cards: deck.cards.slice(0, 1) })).consistency.atLeastTwoPlayablePercent).toBe(0);
});

test('Flight Lab pages large hands without changing samples or saved cards', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 2560, height: 1600 });
  const library = JSON.parse(await readFile('data/game/alpha-cards.json', 'utf8')).cards;
  const cards = library.filter((card: any) => card.kind !== 'snag').slice(0, 60).map((card: any) => ({ id: card.id, upgraded: true }));
  await page.addInitScript((savedCards) => {
    const raw = JSON.stringify({ decks: [{ id: 'large-lab', lineageId: 'large-lab', revision: 1, name: 'Large hand study', leaderId: 'fledgling', cards: savedCards, createdAt: 1, updatedAt: 1, runMode: 'quick' }] });
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  }, cards);
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-lab-hit');
  const snapshot = () => page.evaluate(() => JSON.parse(window.render_game_to_text!()).savedFlightFolios.flightLab);
  await expect.poll(async () => (await snapshot())?.open).toBe(true);
  const initial = await snapshot();
  const storage = await page.evaluate(() => localStorage.getItem('birdsquad.account'));
  expect(initial.sample.cards.length).toBeGreaterThan(5);
  await expect.poll(() => page.evaluate(() => window.__birdSquadGame.scene.getScene('ProfileScene').children.list.filter((child: any) => child.name === 'profile-flight-lab-card-art').length)).toBe(5);
  await page.screenshot({ path: '.artifacts/test-results/flight-lab-large-2560x1600.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: '.artifacts/test-results/flight-lab-large-1440x900.png' });
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.keyboard.press('PageDown');
  await expect.poll(async () => (await snapshot()).sample.page).toBe(2);
  const second = await snapshot();
  expect(second.sample.index).toBe(0);
  expect(second.sample.visibleCardIds).toEqual(initial.sample.cards.slice(5, 10).map((card: any) => card.id));
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? '')).toContain('card page 2');
  await page.screenshot({ path: '.artifacts/test-results/flight-lab-large-1000x560.png' });
  const bounds = await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return profile.children.list.filter((child: any) => child.name === 'profile-flight-lab-card-frame').map((child: any) => ({ left: child.getBounds().left, right: child.getBounds().right }));
  });
  expect(bounds).toHaveLength(5);
  // The sample hand now owns the full content width rather than a narrow side column.
  expect(bounds.every((bound: any) => bound.left >= 92 && bound.right <= 1188)).toBe(true);
  expect(bounds.every((bound: any, index: number) => index === 0 || bound.left > bounds[index - 1].right)).toBe(true);
  await page.evaluate(() => window.__birdSquadGame.scene.getScene('ProfileScene').input.gamepad.emit('down', {}, { index: 12 }));
  await expect.poll(async () => (await snapshot()).sample.page).toBe(1);
  await clickNamedGameObject(page, 'ProfileScene', 'profile-flight-lab-hand-next-hit');
  await expect.poll(async () => (await snapshot()).sample.page).toBe(2);
  await clickNamedGameObject(page, 'ProfileScene', 'profile-flight-lab-deal-hit');
  await expect.poll(async () => (await snapshot()).sample.index).toBe(1);
  expect((await snapshot()).sample.page).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(storage);
});

test('Flight Lab explains deck shape and replays deterministic protected sample hands without changing the folio', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const cards = [
      'major_00',
      'wands_ace',
      'wands_fledgling',
      'swords_ace',
      'swords_fledgling',
      'cups_ace',
      'cups_fledgling',
      'pentacles_04',
      'pentacles_fledgling',
      'aviary_25',
      'major_00',
      'retired_rooftop_card',
    ].map((id) => ({ id, upgraded: false }));
    const account = {
      discoveredCards: cards.map((card) => card.id),
      favoriteCards: [],
      cardCollection: {},
      decks: [{
        id: 'lab-flight',
        lineageId: 'lab-flight',
        revision: 1,
        name: 'Canal Pressure Study',
        leaderId: 'spark_caller',
        cards,
        createdAt: 100,
        updatedAt: 100,
        favorite: false,
        sourceSeed: 'private-seed-that-must-not-drive-practice',
        runMode: 'quick',
      }],
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  const folioBeforePractice = await page.evaluate(() => localStorage.getItem('birdsquad.account'));

  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-lab-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === true);
  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.flightLab).toMatchObject({
    open: true,
    deckId: 'lab-flight',
    deckName: 'Canal Pressure Study',
    savedCopies: 12,
    playableCards: 10,
    duplicateCopies: 1,
    unavailableCopies: 1,
    preenedCards: 0,
    legalForStandardFlight: false,
    averageCost: 0.6,
    costCurve: [
      { label: '0', count: 4 },
      { label: '1', count: 6 },
      { label: '2', count: 0 },
      { label: '3+', count: 0 },
    ],
    roles: [
      { label: 'Pressure', count: 4 },
      { label: 'Guard', count: 4 },
      { label: 'Engine', count: 1 },
      { label: 'Utility', count: 1 },
    ],
    families: [
      { label: 'Plumes', count: 2 },
      { label: 'Quills', count: 2 },
      { label: 'Basins', count: 2 },
      { label: 'Nests', count: 2 },
      { label: 'Legend', count: 1 },
      { label: 'Aviary', count: 1 },
    ],
    consistency: {
      sampleCount: 16,
      atLeastTwoPlayablePercent: 100,
      pressureAvailable: true,
      pressurePercent: 100,
    },
    sample: {
      index: 0,
      number: 1,
      playableCount: 5,
      pressureCount: 4,
    },
    rules: {
      handSize: 5,
      wingbeats: 3,
      deterministic: true,
      usesCombatOpeningProtection: true,
      exactSavedOrderUnaffected: true,
      affectsPower: false,
      spendsResources: false,
    },
  });
  expect(state.savedFlightFolios.flightLab.issues).toHaveLength(2);
  expect(state.savedFlightFolios.flightLab.resourceHooks.length).toBeGreaterThan(0);
  const firstSample = state.savedFlightFolios.flightLab.sample;
  expect(firstSample.cards).toHaveLength(5);
  expect(new Set(firstSample.cards.map((card: any) => card.id)).size).toBe(5);

  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Flight Lab for Canal Pressure Study');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('spends no Scrap');
  expect(await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    const names = new Set(profile.children.list.map((child: any) => child.name));
    return [
      'profile-flight-lab-frame',
      'profile-flight-lab-legality',
      'profile-flight-lab-sample-title',
      'profile-flight-lab-deal-hit',
      'profile-flight-lab-close-hit',
    ].every((name) => names.has(name));
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return profile.children.list.filter((child: any) => child.name === 'profile-flight-lab-card-art').length;
  }), { timeout: 15_000 }).toBe(5);

  await clickNamedGameObject(page, 'ProfileScene', 'profile-flight-lab-deal-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.sample?.index === 1);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.flightLab.sample.number).toBe(2);
  await clickNamedGameObject(page, 'ProfileScene', 'profile-flight-lab-previous-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.sample?.index === 0);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.flightLab.sample).toEqual(firstSample);

  await page.keyboard.press('Space');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.sample?.index === 1);
  // A activates the focused action. Previous Hand remains focused after Space;
  // move to Deal Again before confirming rather than expecting A to ignore it.
  await page.keyboard.press('Tab');
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 0 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.sample?.index === 2);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(folioBeforePractice);

  await page.setViewportSize({ width: 1000, height: 560 });
  await page.screenshot({ path: '.artifacts/test-results/flight-lab-profile.png', fullPage: true });
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 1 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === false);
  await page.keyboard.press('l');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === true);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.flightLab.sample.index).toBe(0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === false);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(folioBeforePractice);
});

test('Collection Signals explains unused, frequent, recent, and paired owned cards without editing the Folio', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const claimed = (firstAcquiredAt: number) => ({
      timesClaimed: 1,
      firstAcquiredAt,
      firstSource: 'combat_reward',
    });
    const discoveredCards = [
      'major_00',
      'wands_ace',
      'swords_ace',
      'cups_ace',
      'pentacles_04',
      'wands_02',
      'cups_02',
      'retired_collection_signal',
    ];
    const deck = (
      id: string,
      cards: string[],
      archived = false,
    ) => ({
      id,
      lineageId: id,
      revision: 1,
      name: id === 'signal-source' ? 'Signal Shelf Study' : id,
      leaderId: 'fledgling',
      cards: cards.map((cardId) => ({ id: cardId, upgraded: false })),
      createdAt: 100,
      updatedAt: 100,
      favorite: false,
      archived,
      sourceSeed: `private-${id}`,
      runMode: 'full',
    });
    const account = {
      discoveredCards,
      favoriteCards: [],
      cardCollection: {
        major_00: claimed(1_700_000_001_000),
        wands_ace: claimed(1_700_000_002_000),
        swords_ace: claimed(1_700_000_003_000),
        cups_ace: claimed(1_700_000_004_000),
        pentacles_04: claimed(1_700_000_005_000),
        wands_02: claimed(1_700_000_006_000),
        cups_02: claimed(1_700_000_007_000),
        retired_collection_signal: claimed(1_700_000_008_000),
      },
      decks: [
        deck('signal-source', ['major_00', 'wands_ace', 'wands_ace', 'swords_ace']),
        deck('canal-ready', ['major_00', 'wands_ace', 'cups_ace']),
        deck('roof-archive', ['major_00', 'wands_ace', 'pentacles_04'], true),
        deck('crosswind', ['swords_ace', 'cups_ace']),
      ],
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-lab-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === true);
  const before = await page.evaluate(() => localStorage.getItem('birdsquad.account'));

  await clickNamedGameObject(page, 'ProfileScene', 'profile-flight-lab-tools-hit');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-flight-lab-collection-signals-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.collectionSignals?.open === true);
  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  const signals = state.savedFlightFolios.collectionSignals;
  expect(signals).toMatchObject({
    open: true,
    deckId: 'signal-source',
    deckName: 'Signal Shelf Study',
    ownedCount: 7,
    folioCount: 4,
    activeFolioCount: 3,
    archivedFolioCount: 1,
    unusedCount: 2,
    rules: {
      listLimit: 5,
      usageUnit: 'distinct saved Folios',
      includesArchive: true,
      duplicateCopiesCountOncePerFolio: true,
      recentUsesFirstAcquiredAt: true,
      pairingsRequireSameFolio: true,
      pairingsTouchSelectedFolio: true,
      descriptiveOnly: true,
      editsFolio: false,
      affectsPower: false,
    },
    inputs: {
      close: 'Esc / G / controller B or R3 / pointer',
    },
  });
  expect(signals.unused.map((card: any) => card.id)).toEqual(['cups_02', 'wands_02']);
  expect(signals.recentlyAcquired.map((card: any) => card.id)).toEqual([
    'cups_02',
    'wands_02',
    'pentacles_04',
    'cups_ace',
    'swords_ace',
  ]);
  expect(signals.frequentlyFiled.find((card: any) => card.id === 'wands_ace')).toMatchObject({
    folioCount: 3,
    activeFolioCount: 2,
    inSelectedFolio: true,
  });
  expect(signals.frequentlyFiled.find((card: any) => card.id === 'major_00')).toMatchObject({
    folioCount: 3,
    activeFolioCount: 2,
    inSelectedFolio: true,
  });
  const strongestPair = signals.commonlyPaired.find((pair: any) => (
    new Set([pair.first.id, pair.second.id]).has('major_00')
    && new Set([pair.first.id, pair.second.id]).has('wands_ace')
  ));
  expect(strongestPair).toMatchObject({
    folioCount: 3,
    activeFolioCount: 2,
    bothInSelectedFolio: true,
  });
  expect(signals.commonlyPaired.every((pair: any) => (
    ['major_00', 'wands_ace', 'swords_ace'].includes(pair.first.id)
    || ['major_00', 'wands_ace', 'swords_ace'].includes(pair.second.id)
  ))).toBe(true);
  expect(JSON.stringify(signals)).not.toContain('retired_collection_signal');
  expect(state.savedFlightFolios.flightLab.open).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(before);

  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Collection Signals for Signal Shelf Study');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('not recommendations');
  const visualState = await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    const byName = (name: string) => profile.children.list.filter((child: any) => child.name === name);
    return {
      frame: byName('profile-collection-signals-frame').length,
      panels: [
        'unused',
        'frequent',
        'recent',
        'paired',
      ].map((id) => byName(`profile-collection-signals-${id}-panel`).length),
      unusedRows: byName('profile-collection-signals-unused-row').length,
      frequentRows: byName('profile-collection-signals-frequent-row').length,
      recentRows: byName('profile-collection-signals-recent-row').length,
      pairedRows: byName('profile-collection-signals-paired-row').length,
      closeTargets: byName('profile-collection-signals-close-hit').map((child: any) => ({
        width: child.displayWidth,
        height: child.displayHeight,
      })),
      method: byName('profile-collection-signals-method').map((child: any) => child.text),
      safety: byName('profile-collection-signals-safety').map((child: any) => child.text),
    };
  });
  expect(visualState).toEqual(expect.objectContaining({
    frame: 1,
    panels: [1, 0, 0, 0],
    unusedRows: 2,
    frequentRows: 0,
    recentRows: 0,
    pairedRows: 0,
    closeTargets: [{ width: 260, height: 58 }],
  }));
  expect(visualState.method[0]).toContain('including Archive');
  expect(visualState.safety[0]).toContain('No recommendations');
  // Each category now has its own readable view; verify all rows remain
  // reachable through actual navigation instead of four cramped columns.
  for (const section of ['frequent', 'recent', 'paired']) {
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios.collectionSignals.section)).toBe(section);
    expect(await page.evaluate(section => window.__birdSquadGame.scene.getScene('ProfileScene').children.list
      .filter((child: any) => child.name === `profile-collection-signals-${section}-row`).length, section)).toBe(5);
  }

  await page.setViewportSize({ width: 1000, height: 560 });
  await page.screenshot({ path: '.artifacts/test-results/flight-collection-signals.png', fullPage: true });
  await clickNamedGameObject(page, 'ProfileScene', 'profile-collection-signals-close-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === true);

  await page.keyboard.press('g');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.collectionSignals?.open === true);
  await page.keyboard.press('g');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === true);
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 11 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.collectionSignals?.open === true);
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 11 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === true);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.collectionSignals.open).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(before);
});

test('Flight Folio archive preserves identities, frees active capacity, and refuses unsafe restore', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => localStorage.setItem('test.archiveCode', value),
      },
    });
    const decks = Array.from({ length: 6 }, (_, index) => ({
      id: `trusted-${index + 1}`,
      name: index === 0 ? 'Trusted Canal Line' : `Active Flight ${index + 1}`,
      leaderId: index === 0 ? 'spark_caller' : 'fledgling',
      cards: index === 0
        ? [
          { id: 'major_00', upgraded: true },
          { id: 'wands_ace', upgraded: false },
          { id: 'cups_ace', upgraded: false },
        ]
        : [{ id: 'major_00', upgraded: false }],
      lineageId: index === 0 ? 'canal-lineage' : `trusted-${index + 1}`,
      revision: index === 0 ? 4 : 1,
      parentId: index === 0 ? 'trusted-parent' : undefined,
      createdAt: 100 + index,
      updatedAt: 100 + index,
      favorite: index === 0,
      sourceSeed: `private-${index + 1}`,
      runMode: index === 0 ? 'quick' : 'full',
    }));
    const account = {
      discoveredCards: ['major_00', 'wands_ace', 'cups_ace'],
      favoriteCards: [],
      cardCollection: {},
      decks,
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios).toMatchObject({
    count: 6,
    capacity: 6,
    archivedCount: 0,
    archiveCapacity: 24,
    view: 'active',
    viewCount: 6,
    full: true,
    canArchive: true,
    canRestore: false,
    archiveRefusesDeletion: true,
    inputs: {
      archiveOrRestore: 'A / controller Start / pointer',
      switchLibrary: 'V / controller Select / pointer',
    },
  });
  expect(state.savedFlightFolios.items[0]).toMatchObject({
    id: 'trusted-1',
    lineageId: 'canal-lineage',
    revision: 4,
    parentId: 'trusted-parent',
    archived: false,
  });

  await page.keyboard.press('e');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'codeCopied');
  const activeCode = await page.evaluate(() => localStorage.getItem('test.archiveCode'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-archive-hit');
  await page.waitForFunction(() => {
    const folios = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios;
    return folios?.status === 'archived' && folios?.view === 'archive';
  });
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios).toMatchObject({
    count: 5,
    archivedCount: 1,
    view: 'archive',
    viewCount: 1,
    canArchive: false,
    canRestore: true,
  });
  expect(state.savedFlightFolios.items[0]).toMatchObject({
    id: 'trusted-1',
    name: 'Trusted Canal Line',
    lineageId: 'canal-lineage',
    revision: 4,
    parentId: 'trusted-parent',
    favorite: true,
    archived: true,
    sourceSeed: 'private-1',
    runMode: 'quick',
    cards: [
      { id: 'major_00', upgraded: true },
      { id: 'wands_ace', upgraded: false },
      { id: 'cups_ace', upgraded: false },
    ],
  });
  await page.keyboard.press('e');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'codeCopied');
  expect(await page.evaluate(() => localStorage.getItem('test.archiveCode'))).toBe(activeCode);

  await page.evaluate(async () => {
    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    route.runState.deck = [
      { id: 'major_00', upgraded: false },
      { id: 'wands_ace', upgraded: true },
    ];
    route.runState.leaderId = 'spark_caller';
    route.runState.seed = 'fresh-active-slot';
    route.runState.runMode = 'quick';
    route.openDeckOverlay();
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.open === true);
  let routeState = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(routeState.deckReview.savedFlights).toMatchObject({
    count: 5,
    capacity: 6,
    archived: 1,
    canSave: true,
  });
  await page.keyboard.press('v');
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.savedFlights?.count === 6,
    undefined,
    { timeout: 10_000 },
  );

  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-library-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.view === 'archive');
  const beforeRefusedRestore = await page.evaluate(() => localStorage.getItem('birdsquad.account'));
  await page.keyboard.press('a');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'activeFull');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios).toMatchObject({
    count: 6,
    archivedCount: 1,
    view: 'archive',
    canRestore: false,
  });
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(beforeRefusedRestore);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Viewing Archive');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('controller Start to restore');

  await page.setViewportSize({ width: 1000, height: 560 });
  await page.screenshot({ path: '.artifacts/test-results/flight-folio-archive-profile.png', fullPage: true });

  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 8 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.view === 'active');
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 9 });
  });
  await page.waitForFunction(() => {
    const folios = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios;
    return folios?.status === 'archived' && folios?.archivedCount === 2;
  });
  await page.keyboard.press('a');
  await page.waitForFunction(() => {
    const folios = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios;
    return folios?.status === 'restored' && folios?.view === 'active';
  });
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios).toMatchObject({
    count: 6,
    archivedCount: 1,
    view: 'active',
    full: true,
  });
  const account = JSON.parse(await page.evaluate(() => localStorage.getItem('birdsquad.account') ?? '{}'));
  const trusted = account.decks.find((deck: any) => deck.id === 'trusted-1');
  expect(trusted).toMatchObject({
    lineageId: 'canal-lineage',
    revision: 4,
    parentId: 'trusted-parent',
    archived: true,
    cards: [
      { id: 'major_00', upgraded: true },
      { id: 'wands_ace', upgraded: false },
      { id: 'cups_ace', upgraded: false },
    ],
  });
  expect(account.decks.filter((deck: any) => deck.archived === true)).toHaveLength(1);
  expect(account.decks.filter((deck: any) => deck.archived !== true)).toHaveLength(6);

  await page.evaluate(() => {
    const active = Array.from({ length: 7 }, (_, index) => ({
      id: `cap-active-${index}`,
      name: `Cap Active ${index}`,
      leaderId: 'fledgling',
      cards: [{ id: 'major_00', upgraded: false }],
      createdAt: 1000 + index,
      updatedAt: 1000 + index,
      favorite: false,
      sourceSeed: '',
      runMode: 'full',
      archived: false,
    }));
    const archived = Array.from({ length: 25 }, (_, index) => ({
      id: `cap-archive-${index}`,
      name: `Cap Archive ${index}`,
      leaderId: 'fledgling',
      cards: [{ id: 'major_00', upgraded: false }],
      createdAt: 2000 + index,
      updatedAt: 2000 + index,
      favorite: false,
      sourceSeed: '',
      runMode: 'full',
      archived: true,
    }));
    const current = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
    const raw = JSON.stringify({ ...current, decks: [...active, ...archived] });
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
  });
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios).toMatchObject({
    count: 6,
    archivedCount: 24,
    capacity: 6,
    archiveCapacity: 24,
    canArchive: false,
  });
  const beforeArchiveCapRefusal = await page.evaluate(() => localStorage.getItem('birdsquad.account'));
  await page.keyboard.press('a');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'archiveFull');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(beforeArchiveCapRefusal);
});

test('Tuning Bench ranks owned replacements and saves one immutable role-aware revision', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const claimed = (time: number) => ({
      timesClaimed: 1,
      firstAcquiredAt: time,
      firstSource: 'combat_reward',
    });
    const account = {
      discoveredCards: [
        'major_00',
        'wands_ace',
        'wands_02',
        'wands_03',
        'wands_fledgling',
        'swords_02',
        'cups_02',
        'pentacles_04',
      ],
      favoriteCards: [],
      cardCollection: {
        wands_02: claimed(10),
        wands_03: claimed(11),
        wands_fledgling: claimed(12),
        swords_02: claimed(13),
        cups_02: claimed(14),
      },
      decks: [{
        id: 'tuning-source',
        lineageId: 'tuning-lineage',
        revision: 1,
        name: 'Plume Pressure Study',
        leaderId: 'spark_caller',
        cards: [
          { id: 'wands_ace', upgraded: true },
          { id: 'retired_plume_card', upgraded: false },
          { id: 'major_00', upgraded: true },
          { id: 'pentacles_04', upgraded: false },
        ],
        createdAt: 100,
        updatedAt: 100,
        favorite: true,
        sourceSeed: 'source-seed',
        runMode: 'quick',
        description: 'Keep the Preened core while testing pressure.',
        coverCardId: 'major_00',
        sleeve: 'signal',
        folder: 'workbench',
        tags: ['pressure', 'combo'],
      }],
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-lab-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === true);
  await clickFlightLabTool(page, 'profile-flight-lab-tune-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.workshop?.open === true);

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.workshop).toMatchObject({
    open: true,
    deckId: 'tuning-source',
    deckName: 'Plume Pressure Study',
    sourceArchived: false,
    sourceCardIndex: 0,
    sourceCardNumber: 1,
    sourceCardCount: 4,
    sourceCard: {
      id: 'wands_ace',
      name: 'Plume Flash',
      upgraded: true,
      available: true,
    },
    suggestionIndex: 0,
    selectedSuggestion: {
      id: 'wands_03',
      name: 'Plume Horizon',
      cost: 1,
      family: 'Plumes',
      role: 'Pressure',
      reasons: ['same pressure role', 'keeps Plumes', 'same cost'],
    },
    ownedCandidatesOnly: true,
    createsNewRevision: true,
    preservesSource: true,
    replacementIsBase: true,
    canSave: true,
    activeCount: 1,
    capacity: 6,
  });
  expect(state.savedFlightFolios.workshop.suggestions.map((candidate: any) => candidate.id))
    .not.toContain('major_00');
  expect(state.savedFlightFolios.workshop.suggestions.map((candidate: any) => candidate.id))
    .not.toContain('pentacles_04');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('permanently owned role-similar replacements');
  await expect.poll(() => page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return profile.children.list.filter((child: any) => child.name === 'profile-folio-workshop-suggestion-art').length;
  }), { timeout: 15_000 }).toBeGreaterThan(0);

  await page.setViewportSize({ width: 1000, height: 560 });
  await page.screenshot({ path: '.artifacts/test-results/flight-folio-tuning-bench.png', fullPage: true });

  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 1 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === true);
  await page.keyboard.press('t');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.workshop?.open === true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === true);
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 2 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.workshop?.open === true);

  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.workshop?.sourceCardIndex === 1);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.workshop.sourceCard).toMatchObject({
    id: 'retired_plume_card',
    available: false,
  });
  expect(state.savedFlightFolios.workshop.suggestions.length).toBeGreaterThan(0);
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.workshop?.sourceCardIndex === 0);
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.workshop?.suggestionIndex === 1);
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 12 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.workshop?.suggestionIndex === 0);
  const beforeTune = JSON.parse(await page.evaluate(() => localStorage.getItem('birdsquad.account') ?? '{}'));
  const sourceBefore = beforeTune.decks.find((deck: any) => deck.id === 'tuning-source');
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 0 });
  });
  await page.waitForFunction(() => {
    const folios = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios;
    return folios?.status === 'tuned' && folios?.count === 2;
  });
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.items[0]).toMatchObject({
    name: 'Plume Pressure Study Tune 2',
    lineageId: 'tuning-lineage',
    revision: 2,
    parentId: 'tuning-source',
    favorite: false,
    archived: false,
    sourceSeed: 'source-seed',
    runMode: 'quick',
    description: 'Keep the Preened core while testing pressure.',
    coverCardId: 'major_00',
    sleeve: 'signal',
    sleeveLabel: 'Signal Violet',
    folder: 'workbench',
    tags: [
      { id: 'pressure', label: 'Pressure' },
      { id: 'combo', label: 'Combo' },
    ],
    cards: [
      { id: 'wands_03', upgraded: false },
      { id: 'retired_plume_card', upgraded: false },
      { id: 'major_00', upgraded: true },
      { id: 'pentacles_04', upgraded: false },
    ],
  });
  expect(state.savedFlightFolios.items[1]).toMatchObject({
    id: 'tuning-source',
    lineageId: 'tuning-lineage',
    revision: 1,
    favorite: true,
    cards: sourceBefore.cards,
  });
  const afterTune = JSON.parse(await page.evaluate(() => localStorage.getItem('birdsquad.account') ?? '{}'));
  expect(afterTune.decks.find((deck: any) => deck.id === 'tuning-source')).toEqual({
    ...sourceBefore,
    archived: false,
  });

  await page.evaluate(() => {
    const account = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
    const extras = Array.from({ length: 4 }, (_, index) => ({
      id: `tune-cap-${index}`,
      name: `Tune Capacity ${index}`,
      leaderId: 'fledgling',
      cards: [{ id: 'major_00', upgraded: false }],
      createdAt: 500 + index,
      updatedAt: 500 + index,
      favorite: false,
      archived: false,
      sourceSeed: '',
      runMode: 'full',
    }));
    const raw = JSON.stringify({ ...account, decks: [...account.decks, ...extras] });
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
  });
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-lab-hit');
  await clickFlightLabTool(page, 'profile-flight-lab-tune-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.workshop?.open === true);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.workshop).toMatchObject({
    canSave: false,
    activeCount: 6,
    capacity: 6,
  });
  const beforeFullTune = await page.evaluate(() => localStorage.getItem('birdsquad.account'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.workshop?.status === 'activeFull');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(beforeFullTune);
});

test('Revision Trail restores an exact earlier deck as a new immutable revision', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['major_00', 'wands_ace', 'wands_03', 'cups_ace'],
      favoriteCards: [],
      cardCollection: {},
      decks: [
        {
          id: 'trail-current',
          lineageId: 'trail-lineage',
          revision: 3,
          parentId: 'trail-parent',
          name: 'Canal Study Tune 3',
          leaderId: 'spark_caller',
          cards: [
            { id: 'major_00', upgraded: true },
            { id: 'wands_03', upgraded: false },
            { id: 'cups_ace', upgraded: true },
          ],
          createdAt: 300,
          updatedAt: 300,
          favorite: true,
          sourceSeed: 'current-private-seed',
          runMode: 'quick',
        },
        {
          id: 'trail-sibling',
          lineageId: 'trail-lineage',
          revision: 4,
          parentId: 'trail-root',
          name: 'Canal Study Fork 4',
          leaderId: 'spark_caller',
          cards: [
            { id: 'major_00', upgraded: true },
            { id: 'wands_03', upgraded: false },
            { id: 'cups_ace', upgraded: true },
          ],
          createdAt: 400,
          updatedAt: 400,
          favorite: false,
          sourceSeed: 'sibling-private-seed',
          runMode: 'quick',
        },
        {
          id: 'trail-parent',
          lineageId: 'trail-lineage',
          revision: 2,
          parentId: 'trail-root',
          name: 'Canal Study Tune 2',
          leaderId: 'spark_caller',
          cards: [
            { id: 'major_00', upgraded: true },
            { id: 'wands_ace', upgraded: true },
            { id: 'cups_ace', upgraded: false },
          ],
          createdAt: 200,
          updatedAt: 200,
          favorite: false,
          archived: true,
          sourceSeed: 'parent-private-seed',
          runMode: 'quick',
          description: 'Archived guard line with a Molt finish.',
          coverCardId: 'wands_ace',
          sleeve: 'canal',
          folder: 'signature',
          tags: ['guard', 'molt'],
        },
        {
          id: 'trail-root',
          lineageId: 'trail-lineage',
          revision: 1,
          name: 'Canal Study',
          leaderId: 'fledgling',
          cards: [
            { id: 'major_00', upgraded: false },
            { id: 'wands_ace', upgraded: false },
            { id: 'cups_ace', upgraded: false },
          ],
          createdAt: 100,
          updatedAt: 100,
          favorite: false,
          archived: true,
          sourceSeed: 'root-private-seed',
          runMode: 'full',
        },
      ],
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-lab-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === true);
  await clickFlightLabTool(page, 'profile-flight-lab-history-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.revisionTrail?.open === true);

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.revisionTrail).toMatchObject({
    open: true,
    source: {
      id: 'trail-current',
      name: 'Canal Study Tune 3',
      revision: 3,
      parentId: 'trail-parent',
      archived: false,
      leaderId: 'spark_caller',
      runMode: 'quick',
      cardCount: 3,
    },
    targetCount: 3,
    targetIndex: 0,
    selectedTarget: {
      id: 'trail-parent',
      name: 'Canal Study Tune 2',
      revision: 2,
      archived: true,
      isDirectParent: true,
    },
    comparison: {
      cardChanges: [
        {
          position: 2,
          kind: 'replaced',
          current: { id: 'wands_03', name: 'Plume Horizon', upgraded: false, available: true },
          target: { id: 'wands_ace', name: 'Plume Flash', upgraded: true, available: true },
        },
        {
          position: 3,
          kind: 'state',
          current: { id: 'cups_ace', name: 'Open Basin', upgraded: true, available: true },
          target: { id: 'cups_ace', name: 'Open Basin', upgraded: false, available: true },
        },
      ],
      unchangedCards: 1,
      leaderChanged: false,
      runModeChanged: false,
      exactMatch: false,
    },
    createsNewRevision: true,
    preservesSourceAndTarget: true,
    restoresExactTargetOrderAndStates: true,
    canRestore: true,
    activeCount: 2,
    capacity: 6,
  });
  expect(state.savedFlightFolios.revisionTrail.targets.map((target: any) => target.id))
    .toEqual(['trail-parent', 'trail-sibling', 'trail-root']);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Selected direct parent, Canal Study Tune 2, revision 2, archived');
  await expect.poll(() => page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return profile.children.list.filter((child: any) => (
      child.name === 'profile-folio-history-current-art'
      || child.name === 'profile-folio-history-target-art'
    )).length;
  }), { timeout: 15_000 }).toBe(2);
  await page.keyboard.press('PageDown');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios.revisionTrail.changePage)).toBe(2);
  expect(await page.evaluate(() => window.__birdSquadGame.scene.getScene('ProfileScene').children.list
    .filter((child: any) => child.name === 'profile-folio-history-current-art' || child.name === 'profile-folio-history-target-art').length)).toBe(2);
  await page.keyboard.press('PageUp');

  await page.setViewportSize({ width: 1000, height: 560 });
  await page.screenshot({ path: '.artifacts/test-results/flight-folio-revision-trail.png', fullPage: true });

  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 1 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === true);
  await page.keyboard.press('r');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.revisionTrail?.open === true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === true);
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 3 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.revisionTrail?.open === true);

  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.revisionTrail?.targetIndex === 1);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.revisionTrail).toMatchObject({
    selectedTarget: { id: 'trail-sibling', revision: 4 },
    comparison: { exactMatch: true, cardChanges: [], unchangedCards: 3 },
    canRestore: false,
  });
  const beforeExactMatch = await page.evaluate(() => localStorage.getItem('birdsquad.account'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.revisionTrail?.status === 'failed');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(beforeExactMatch);

  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => {
    const trail = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.revisionTrail;
    return trail?.targetIndex === 0 && trail?.status === 'idle';
  });
  const beforeRestore = JSON.parse(await page.evaluate(() => localStorage.getItem('birdsquad.account') ?? '{}'));
  const sourceBefore = beforeRestore.decks.find((deck: any) => deck.id === 'trail-current');
  const targetBefore = beforeRestore.decks.find((deck: any) => deck.id === 'trail-parent');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-history-restore-hit');
  await page.waitForFunction(() => {
    const folios = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios;
    return folios?.status === 'revisionRestored' && folios?.count === 3;
  });
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.items[0]).toMatchObject({
    name: 'Canal Study Restore 5',
    lineageId: 'trail-lineage',
    revision: 5,
    parentId: 'trail-current',
    favorite: false,
    archived: false,
    leaderId: 'spark_caller',
    sourceSeed: 'parent-private-seed',
    runMode: 'quick',
    description: 'Archived guard line with a Molt finish.',
    coverCardId: 'wands_ace',
    sleeve: 'canal',
    sleeveLabel: 'Canal Teal',
    folder: 'signature',
    tags: [
      { id: 'guard', label: 'Guard' },
      { id: 'molt', label: 'Molt' },
    ],
    cards: [
      { id: 'major_00', upgraded: true },
      { id: 'wands_ace', upgraded: true },
      { id: 'cups_ace', upgraded: false },
    ],
  });
  const afterRestore = JSON.parse(await page.evaluate(() => localStorage.getItem('birdsquad.account') ?? '{}'));
  expect(afterRestore.decks.find((deck: any) => deck.id === 'trail-current')).toMatchObject(sourceBefore);
  expect(afterRestore.decks.find((deck: any) => deck.id === 'trail-parent')).toMatchObject(targetBefore);

  await page.evaluate(() => {
    const account = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
    const extras = Array.from({ length: 3 }, (_, index) => ({
      id: `history-cap-${index}`,
      name: `History Capacity ${index}`,
      leaderId: 'fledgling',
      cards: [{ id: 'major_00', upgraded: false }],
      createdAt: 900 + index,
      updatedAt: 900 + index,
      favorite: false,
      archived: false,
      sourceSeed: '',
      runMode: 'full',
    }));
    const raw = JSON.stringify({ ...account, decks: [...account.decks, ...extras] });
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
  });
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-lab-hit');
  await clickFlightLabTool(page, 'profile-flight-lab-history-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.revisionTrail?.open === true);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.revisionTrail).toMatchObject({
    source: { revision: 5, parentId: 'trail-current' },
    selectedTarget: { id: 'trail-current', revision: 3, isDirectParent: true },
    canRestore: false,
    activeCount: 6,
    capacity: 6,
  });
  const beforeFullRestore = await page.evaluate(() => localStorage.getItem('birdsquad.account'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.revisionTrail?.status === 'activeFull');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(beforeFullRestore);
});

test('Folio Field Record links exact flights and keeps private matchup notes safe', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  const now = Date.now();
  const deck = [
    { id: 'major_00', upgraded: true },
    { id: 'wands_ace', upgraded: false },
    { id: 'cups_ace', upgraded: true },
  ];
  const run = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    seed: id.replace(/^run-\d+-/, ''),
    result: 'loss',
    leaderId: 'spark_caller',
    difficulty: 2,
    runMode: 'quick',
    mapId: 'map_01_rooftop_blocks',
    finalNodeId: 'm1_entry',
    turnsTaken: 10,
    durationMs: 60_000,
    currentCohesion: 0,
    maxCohesion: 40,
    scrapEarned: 12,
    scrapSpent: 5,
    finalScrap: 7,
    path: ['m1_entry'],
    deck,
    routeMarks: [],
    suppliesUsed: [],
    signals: [],
    cardRewards: [],
    routeDecisions: [],
    combatResults: [],
    districtContracts: [],
    seenEnemyMoves: [],
    combatPace: 'standard',
    animationPace: 'standard',
    firstFlightGuide: { enabled: false, completed: true },
    decisionStats: {},
    ...overrides,
  });
  const exactNewest = run(`run-${now}-exact-newest`, {
    seed: 'exact-newest',
    result: 'win',
    turnsTaken: 8,
    currentCohesion: 30,
  });
  const exactMiddle = run(`run-${now - 1_000}-exact-middle`, {
    seed: 'exact-middle',
    result: 'loss',
    turnsTaken: 12,
  });
  const exactOldest = run(`run-${now - 2_000}-exact-oldest`, {
    seed: 'exact-oldest',
    result: 'win',
    turnsTaken: 6,
    currentCohesion: 22,
  });
  const nearMisses = [
    run(`run-${now - 3_000}-wrong-leader`, { leaderId: 'fledgling', result: 'win' }),
    run(`run-${now - 4_000}-wrong-mode`, { runMode: 'full', result: 'win' }),
    run(`run-${now - 5_000}-wrong-order`, {
      result: 'win',
      deck: [deck[1], deck[0], deck[2]],
    }),
    run(`run-${now - 6_000}-wrong-state`, {
      result: 'win',
      deck: [deck[0], { ...deck[1], upgraded: true }, deck[2]],
    }),
  ];
  await page.addInitScript(({ runs, savedDeck }) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => localStorage.setItem('test.fieldCode', value),
      },
    });
    const account = {
      discoveredCards: ['major_00', 'wands_ace', 'cups_ace'],
      favoriteCards: [],
      cardCollection: {},
      decks: [savedDeck],
    };
    const accountRaw = JSON.stringify(account);
    const historyRaw = JSON.stringify(runs);
    localStorage.setItem('birdsquad.account', accountRaw);
    localStorage.setItem('birdsquad.account.backup', accountRaw);
    localStorage.setItem('birdsquad.runs', historyRaw);
    localStorage.setItem('birdsquad.runs.backup', historyRaw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  }, {
    runs: [...nearMisses, exactOldest, exactMiddle, exactNewest],
    savedDeck: {
      id: 'field-source',
      lineageId: 'field-lineage',
      revision: 1,
      name: 'Exact Canal Study',
      leaderId: 'spark_caller',
      cards: deck,
      createdAt: 100,
      updatedAt: 100,
      favorite: true,
      sourceSeed: 'private-field-seed',
      runMode: 'quick',
    },
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  await page.keyboard.press('e');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'codeCopied');
  const shareCodeBeforeNotes = await page.evaluate(() => localStorage.getItem('test.fieldCode'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-lab-hit');
  await clickFlightLabTool(page, 'profile-flight-lab-field-record-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.fieldRecord?.open === true);

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.fieldRecord).toMatchObject({
    open: true,
    deckId: 'field-source',
    deckName: 'Exact Canal Study',
    revision: 1,
    archived: false,
    notes: '',
    notesLength: 0,
    notesEditing: false,
    notesPrivate: true,
    notesExcludedFromShareCodes: true,
    flights: 3,
    wins: 2,
    losses: 1,
    winRate: 67,
    averageTurns: 8.7,
    fastestWinTurns: 6,
    bestCohesionPercent: 75,
    exactMatchRules: {
      leader: true,
      runMode: true,
      cardOrder: true,
      preenedState: true,
    },
    affectsPower: false,
  });
  expect(state.savedFlightFolios.fieldRecord.recent.map((flight: any) => flight.seed))
    .toEqual(['exact-newest', 'exact-middle', 'exact-oldest']);
  expect(state.savedFlightFolios.fieldRecord.recent.map((flight: any) => flight.result))
    .toEqual(['win', 'loss', 'win']);
  expect(state.savedFlightFolios.shareCode.excludesPrivateNotes).toBe(true);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Matching requires the same leader, mode, card order, and Base or Preened states');
  const renderedRows = await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return profile.children.list
      .filter((child: any) => child.name === 'profile-folio-field-record-flight-row')
      .map((child: any) => child.getData('runId'));
  });
  expect(renderedRows).toEqual([exactNewest.id, exactMiddle.id, exactOldest.id]);
  await page.screenshot({ path: '.artifacts/test-results/flight-folio-field-record.png', fullPage: true });

  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 1 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === true);
  await page.keyboard.press('n');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.fieldRecord?.open === true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === true);
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 10 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.fieldRecord?.open === true);

  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-field-record-edit-hit');
  const notesInput = page.locator('textarea[aria-label="Private Folio matchup notes"]');
  await expect(notesInput).toBeVisible();
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.fieldRecord.notesEditing).toBe(true);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Editing private matchup notes');
  const savedNotes = 'Guard early against Quills.\nMulligan for Plume Flash.';
  await notesInput.fill(savedNotes);
  await notesInput.press('Enter');
  await page.waitForFunction(() => {
    const field = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.fieldRecord;
    return field?.status === 'notesSaved' && field?.notesEditing === false;
  });
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.fieldRecord).toMatchObject({
    notes: savedNotes,
    notesLength: savedNotes.length,
    notesPrivate: true,
    status: 'notesSaved',
  });
  let account = JSON.parse(await page.evaluate(() => localStorage.getItem('birdsquad.account') ?? '{}'));
  expect(account.decks.find((entry: any) => entry.id === 'field-source').notes).toBe(savedNotes);

  await page.keyboard.press('e');
  await expect(notesInput).toBeVisible();
  await notesInput.fill('This cancelled note must never persist.');
  await notesInput.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.fieldRecord?.notesEditing === false);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.fieldRecord.notes).toBe(savedNotes);

  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-field-record-close-hit');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-flight-lab-close-hit');
  await page.keyboard.press('e');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'codeCopied');
  expect(await page.evaluate(() => localStorage.getItem('test.fieldCode'))).toBe(shareCodeBeforeNotes);

  await page.keyboard.press('d');
  await page.waitForFunction(() => {
    const folios = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios;
    return folios?.status === 'duplicated' && folios?.count === 2;
  });
  account = JSON.parse(await page.evaluate(() => localStorage.getItem('birdsquad.account') ?? '{}'));
  expect(account.decks[0]).toMatchObject({
    lineageId: 'field-lineage',
    revision: 2,
    parentId: 'field-source',
    notes: savedNotes,
  });
  expect(account.decks.find((entry: any) => entry.id === 'field-source').notes).toBe(savedNotes);

  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-data-hit');
  const downloadPromise = page.waitForEvent('download');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-download-hit');
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error('Field Record save backup did not produce a local file');
  const backup = JSON.parse(await readFile(downloadedPath, 'utf8'));
  expect(backup.data.account.decks.map((entry: any) => entry.notes)).toEqual([savedNotes, savedNotes]);
});

test('Folio Organizer preserves private folders and strategy labels across every immutable copy path', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => localStorage.setItem('test.organizerCode', value),
      },
    });
    const account = {
      discoveredCards: ['major_00', 'wands_ace', 'cups_ace'],
      favoriteCards: [],
      cardCollection: {},
      decks: [{
        id: 'organized-source',
        lineageId: 'organized-lineage',
        revision: 1,
        name: 'Rooftop Engine Study',
        leaderId: 'spark_caller',
        cards: [
          { id: 'major_00', upgraded: true },
          { id: 'wands_ace', upgraded: false },
          { id: 'cups_ace', upgraded: true },
        ],
        createdAt: 100,
        updatedAt: 100,
        favorite: false,
        archived: false,
        sourceSeed: 'private-organizer-seed',
        runMode: 'quick',
        folder: 'workbench',
        tags: ['pressure', 'pressure', 'invalid-label', 'guard'],
      }],
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.viewActive === true);

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.items[0]).toMatchObject({
    id: 'organized-source',
    folder: 'workbench',
    folderLabel: 'Workbench',
    tags: [
      { id: 'pressure', label: 'Pressure' },
      { id: 'guard', label: 'Guard' },
    ],
  });
  expect(state.savedFlightFolios.shareCode).toMatchObject({
    excludesOrganization: true,
    excludesPrivateNotes: true,
  });
  expect(state.savedFlightFolios.inputs.organize).toBe('O / controller A / pointer');

  await page.keyboard.press('e');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'codeCopied');
  const shareCodeBeforeOrganization = await page.evaluate(() => localStorage.getItem('test.organizerCode'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-organize-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.organizer?.open === true);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.organizer).toMatchObject({
    open: true,
    deckId: 'organized-source',
    deckName: 'Rooftop Engine Study',
    folder: 'workbench',
    folderLabel: 'Workbench',
    tags: ['pressure', 'guard'],
    tagLabels: ['Pressure', 'Guard'],
    tagLimit: 3,
    section: 'folder',
    selectedFolder: {
      id: 'workbench',
      label: 'Workbench',
    },
    private: true,
    includedInBackups: true,
    excludedFromShareCodes: true,
    affectsPower: false,
  });
  expect(state.savedFlightFolios.organizer.folders).toHaveLength(4);
  expect(state.savedFlightFolios.organizer.availableTags).toHaveLength(8);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Organization is private, included in save backups, excluded from BSF share codes');

  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    const ready = profile.children.list.find(
      (child: any) => child.name === 'profile-folio-organizer-folder-hit' && child.getData('folderId') === 'ready',
    );
    ready.emit('pointerdown');
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.organizer?.folder === 'ready');
  await page.screenshot({ path: '.artifacts/test-results/flight-folio-organizer.png', fullPage: true });

  await focusFolioControl(page, 'profile-folio-organizer-tag-hit:flow');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).savedFlightFolios.organizer.tags).toEqual(['pressure', 'guard']);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const organizer = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.organizer;
    return organizer?.status === 'organized' && organizer?.tags?.includes('flow');
  });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.organizer?.status === 'tagLimit');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.organizer.tags).toEqual(['pressure', 'guard', 'flow']);
  expect(state.savedFlightFolios.organizer.selectedTag.id).toBe('molt');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('three-label limit is reached');

  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const tags = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.organizer?.tags ?? [];
    return !tags.includes('pressure');
  });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const tags = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.organizer?.tags ?? [];
    return tags.includes('molt');
  });
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.organizer.tags).toEqual(['guard', 'flow', 'molt']);

  await page.keyboard.press('r');
  const renameInput = page.locator('input[aria-label="Saved flight name"]');
  await expect(renameInput).toBeVisible();
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.organizer.open).toBe(true);
  expect(state.savedFlightFolios.renaming).toBe(true);
  await renameInput.fill('Rooftop Signature Engine');
  await renameInput.press('Enter');
  await page.waitForFunction(() => {
    const organizer = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.organizer;
    return organizer?.open === true && organizer?.deckName === 'Rooftop Signature Engine';
  });

  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 4 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.organizer?.section === 'folder');
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 1 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.organizer?.open === false);
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 0 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.organizer?.open === true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.organizer?.open === false);
  await page.screenshot({ path: '.artifacts/test-results/flight-folio-organizer-library.png', fullPage: true });

  await page.keyboard.press('e');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'codeCopied');
  expect(await page.evaluate(() => localStorage.getItem('test.organizerCode'))).toBe(shareCodeBeforeOrganization);
  await page.keyboard.press('d');
  await page.waitForFunction(() => {
    const folios = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios;
    return folios?.status === 'duplicated' && folios?.count === 2;
  });
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.items[0]).toMatchObject({
    lineageId: 'organized-lineage',
    revision: 2,
    parentId: 'organized-source',
    folder: 'ready',
    tags: [
      { id: 'guard', label: 'Guard' },
      { id: 'flow', label: 'Flow' },
      { id: 'molt', label: 'Molt' },
    ],
  });
  const account = JSON.parse(await page.evaluate(() => localStorage.getItem('birdsquad.account') ?? '{}'));
  expect(account.decks[0]).toMatchObject({
    folder: 'ready',
    tags: ['guard', 'flow', 'molt'],
  });
  expect(account.decks.find((entry: any) => entry.id === 'organized-source')).toMatchObject({
    name: 'Rooftop Signature Engine',
    folder: 'ready',
    tags: ['guard', 'flow', 'molt'],
  });

  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-data-hit');
  const downloadPromise = page.waitForEvent('download');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-download-hit');
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error('Folio Organizer backup did not produce a local file');
  const backup = JSON.parse(await readFile(downloadedPath, 'utf8'));
  expect(backup.data.account.decks.map((entry: any) => ({
    folder: entry.folder,
    tags: entry.tags,
  }))).toEqual([
    { folder: 'ready', tags: ['guard', 'flow', 'molt'] },
    { folder: 'ready', tags: ['guard', 'flow', 'molt'] },
  ]);
});

test('Folio Identity preserves private descriptions, cover cards, and card-back sleeves', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => localStorage.setItem('test.identityCode', value),
      },
    });
    const account = {
      discoveredCards: ['major_00', 'wands_ace', 'cups_ace'],
      favoriteCards: [],
      cardCollection: {},
      decks: [{
        id: 'identity-source',
        lineageId: 'identity-lineage',
        revision: 1,
        name: 'Canal Signal Study',
        leaderId: 'spark_caller',
        cards: [
          { id: 'major_00', upgraded: true },
          { id: 'wands_ace', upgraded: false },
          { id: 'cups_ace', upgraded: true },
        ],
        createdAt: 100,
        updatedAt: 100,
        favorite: false,
        archived: false,
        sourceSeed: 'private-identity-seed',
        runMode: 'quick',
        description: '  Test   pressure   lines  ',
        coverCardId: 'missing-card',
        sleeve: 'invalid-sleeve',
      }],
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.viewActive === true);

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.items[0]).toMatchObject({
    id: 'identity-source',
    description: 'Test pressure lines',
    coverCardId: 'major_00',
    coverCardName: 'First Flight',
    sleeve: 'field',
    sleeveLabel: 'Field Canvas',
  });
  expect(state.savedFlightFolios.shareCode).toMatchObject({
    excludesIdentity: true,
    excludesOrganization: true,
    excludesPrivateNotes: true,
  });

  await page.keyboard.press('e');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'codeCopied');
  const shareCodeBeforeIdentity = await page.evaluate(() => localStorage.getItem('test.identityCode'));

  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-organize-hit');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-organizer-identity-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.identity?.open === true);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.identity).toMatchObject({
    open: true,
    deckId: 'identity-source',
    deckName: 'Canal Signal Study',
    description: 'Test pressure lines',
    descriptionLimit: 120,
    descriptionEditing: false,
    section: 'cover',
    coverCardId: 'major_00',
    sleeve: 'field',
    sleeveLabel: 'Field Canvas',
    private: true,
    includedInBackups: true,
    excludedFromShareCodes: true,
    affectsPower: false,
  });
  expect(state.savedFlightFolios.identity.coverCards).toHaveLength(3);
  expect(state.savedFlightFolios.identity.sleeves).toHaveLength(4);
  expect(state.savedFlightFolios.identity.coverCard).toMatchObject({
    id: 'major_00',
    name: 'First Flight',
    selected: true,
    available: true,
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Cover, sleeve, and description are cosmetic collection metadata');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const identity = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.identity;
    return identity?.status === 'personalized' && identity?.coverCardId === 'wands_ace';
  });
  await focusFolioControl(page, 'profile-folio-identity-sleeve-hit:canal');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).savedFlightFolios.identity.sleeve).toBe('field');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const identity = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.identity;
    return identity?.status === 'personalized' && identity?.sleeve === 'canal';
  });

  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    const rooftop = profile.children.list.find(
      (child: any) => child.name === 'profile-folio-identity-sleeve-hit' && child.getData('sleeveId') === 'rooftop',
    );
    rooftop.emit('pointerdown');
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.identity?.sleeve === 'rooftop');

  await page.keyboard.press('e');
  const descriptionInput = page.locator('input[aria-label="Private Folio description"]');
  await expect(descriptionInput).toBeVisible();
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.identity.descriptionEditing).toBe(true);
  await descriptionInput.fill('Pressure pivots into a safe Molt finish.');
  await descriptionInput.press('Enter');
  await page.waitForFunction(() => {
    const identity = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.identity;
    return identity?.status === 'descriptionSaved'
      && identity?.description === 'Pressure pivots into a safe Molt finish.';
  });
  await page.screenshot({ path: '.artifacts/test-results/flight-folio-identity.png', fullPage: true });

  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 4 });
    profile.input.gamepad.emit('down', {}, { index: 13 });
    profile.input.gamepad.emit('down', {}, { index: 0 });
  });
  await page.waitForFunction(() => {
    const identity = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.identity;
    return identity?.section === 'cover' && identity?.coverCardId === 'cups_ace';
  });
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 2 });
  });
  await expect(descriptionInput).toBeVisible();
  await descriptionInput.fill('Cancelled controller edit.');
  await descriptionInput.press('Escape');
  await page.waitForFunction(() => {
    const identity = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.identity;
    return identity?.descriptionEditing === false
      && identity?.description === 'Pressure pivots into a safe Molt finish.';
  });
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 1 });
  });
  await page.waitForFunction(() => {
    const folios = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios;
    return folios?.identity?.open === false && folios?.organizer?.open === true;
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.organizer?.open === false);
  await page.screenshot({ path: '.artifacts/test-results/flight-folio-identity-library.png', fullPage: true });

  await page.keyboard.press('e');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.status === 'codeCopied');
  expect(await page.evaluate(() => localStorage.getItem('test.identityCode'))).toBe(shareCodeBeforeIdentity);
  await page.keyboard.press('d');
  await page.waitForFunction(() => {
    const folios = JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios;
    return folios?.status === 'duplicated' && folios?.count === 2;
  });
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.items[0]).toMatchObject({
    lineageId: 'identity-lineage',
    revision: 2,
    parentId: 'identity-source',
    description: 'Pressure pivots into a safe Molt finish.',
    coverCardId: 'cups_ace',
    sleeve: 'rooftop',
    sleeveLabel: 'Rooftop Ember',
  });

  const account = JSON.parse(await page.evaluate(() => localStorage.getItem('birdsquad.account') ?? '{}'));
  expect(account.decks.map((entry: any) => ({
    description: entry.description,
    coverCardId: entry.coverCardId,
    sleeve: entry.sleeve,
  }))).toEqual([
    {
      description: 'Pressure pivots into a safe Molt finish.',
      coverCardId: 'cups_ace',
      sleeve: 'rooftop',
    },
    {
      description: 'Pressure pivots into a safe Molt finish.',
      coverCardId: 'cups_ace',
      sleeve: 'rooftop',
    },
  ]);

  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-data-hit');
  const downloadPromise = page.waitForEvent('download');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-download-hit');
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error('Folio Identity backup did not produce a local file');
  const backup = JSON.parse(await readFile(downloadedPath, 'utf8'));
  expect(backup.data.account.decks.map((entry: any) => ({
    description: entry.description,
    coverCardId: entry.coverCardId,
    sleeve: entry.sleeve,
  }))).toEqual([
    {
      description: 'Pressure pivots into a safe Molt finish.',
      coverCardId: 'cups_ace',
      sleeve: 'rooftop',
    },
    {
      description: 'Pressure pivots into a safe Molt finish.',
      coverCardId: 'cups_ace',
      sleeve: 'rooftop',
    },
  ]);
});

test('owned Folio launches the exact saved deck across pointer keyboard and controller without overwriting active flights', async ({ page }) => {
  test.setTimeout(180_000);
  const cards = [
    { id: 'major_00', upgraded: true },
    { id: 'wands_ace', upgraded: false },
    { id: 'wands_fledgling', upgraded: false },
    { id: 'swords_ace', upgraded: false },
    { id: 'swords_fledgling', upgraded: true },
    { id: 'cups_ace', upgraded: false },
    { id: 'cups_fledgling', upgraded: false },
    { id: 'pentacles_04', upgraded: false },
    { id: 'pentacles_fledgling', upgraded: false },
    { id: 'aviary_25', upgraded: false },
  ];
  await page.addInitScript(({ savedCards }) => {
    const claimed = (index: number) => ({
      timesClaimed: 1,
      firstAcquiredAt: 1_780_000_000_000 + index,
      firstSource: 'combat_reward',
    });
    const account = {
      runs: 1,
      wins: 0,
      losses: 1,
      winsByLeader: {},
      runsByLeader: { fledgling: 1 },
      bestWinTier: -1,
      fastestWinTurns: null,
      unlockedLeaders: ['fledgling', 'spark_caller'],
      achievements: [],
      discoveredCards: savedCards.map((card: any) => card.id),
      favoriteCards: [],
      cardCollection: Object.fromEntries(
        savedCards.slice(0, -1).map((card: any, index: number) => [card.id, claimed(index)]),
      ),
      observedEnemyMoves: [],
      contractBadges: [],
      leaderProgress: {},
      leaderRecords: {},
      decks: [{
        id: 'owned-launch-folio',
        lineageId: 'owned-launch-folio',
        revision: 3,
        name: 'Exact Rooftop Replay',
        leaderId: 'fledgling',
        cards: savedCards,
        createdAt: 1_780_000_100_000,
        updatedAt: 1_780_000_200_000,
        favorite: true,
        archived: false,
        sourceSeed: 'private-source-seed',
        runMode: 'quick',
      }],
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  }, { savedCards: cards });
  await boot(page);

  const openLab = async () => {
    await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
    await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
    await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-lab-hit');
    await page.waitForFunction(() => (
      JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.flightLab?.open === true
    ));
  };
  const clearActiveFlight = async () => {
    await page.evaluate(() => {
      localStorage.removeItem('birdsquad.run.active');
      localStorage.removeItem('birdsquad.run.active.backup');
      localStorage.removeItem('birdsquad.run.active.corrupt');
    });
  };
  const assertExactRoute = async () => {
    await page.waitForFunction(() => {
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      const persisted = JSON.parse(localStorage.getItem('birdsquad.run.active') ?? '{}');
      return state.scene === 'RouteScene' && state.run?.deckSize > 0 && persisted.deck?.length > 0;
    });
    const launched = await page.evaluate(() => {
      const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
      return {
        state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
        deck: route.runState.deck,
        leaderId: route.runState.leaderId,
        runMode: route.runState.runMode,
        difficulty: route.runState.difficulty,
        seed: route.runState.seed,
        routeLog: route.runState.routeLog,
        persisted: JSON.parse(localStorage.getItem('birdsquad.run.active') ?? '{}'),
      };
    });
    expect(launched.state.run.deckSize).toBe(cards.length);
    expect(launched.deck).toEqual(cards);
    expect(launched.persisted.deck).toEqual(cards);
    expect(launched).toMatchObject({
      leaderId: 'fledgling',
      runMode: 'quick',
      difficulty: 0,
      routeLog: ['The flock gathers at Rooftop Blocks.'],
    });
    expect(launched.seed).not.toBe('private-source-seed');
  };

  await openLab();
  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.flightLab.launch).toMatchObject({
    available: false,
    block: 'unownedCards',
    missingOwnedIds: ['aviary_25'],
    label: 'Claim 1 Card',
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Shared codes never grant ownership');
  const accountBeforeBlockedLaunch = await page.evaluate(() => localStorage.getItem('birdsquad.account'));
  await page.keyboard.press('s');
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', profile.input.gamepad.pad1, { index: 9 }, 1);
  });
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).scene).toBe('ProfileScene');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(accountBeforeBlockedLaunch);

  await page.evaluate(() => {
    const account = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
    account.cardCollection.aviary_25 = {
      timesClaimed: 1,
      firstAcquiredAt: 1_780_000_000_099,
      firstSource: 'route_reward',
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
  });
  await openLab();
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.flightLab.launch).toMatchObject({
    available: true,
    missingOwnedIds: [],
    label: 'Fly This Folio',
  });
  expect(state.savedFlightFolios.flightLab.inputs.launch).toBe('S / controller Start / pointer');
  const launchTarget = await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    const hit = profile.children.getByName('profile-flight-lab-launch-hit');
    return {
      width: hit.displayWidth,
      height: hit.displayHeight,
      available: hit.getData('available'),
      block: hit.getData('block'),
    };
  });
  expect(launchTarget).toMatchObject({ width: 204, available: true, block: null });
  expect(launchTarget.height).toBeGreaterThanOrEqual(58);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/folio-launch-flight-lab.png' });
  const folioBeforeLaunch = await page.evaluate(() => localStorage.getItem('birdsquad.account'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-flight-lab-launch-hit');
  await assertExactRoute();
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(folioBeforeLaunch);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/folio-launch-route.png' });

  await openLab();
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.flightLab.launch).toMatchObject({
    available: false,
    block: 'activeFlight',
    label: 'Flight Active',
  });
  const activeBeforeBlockedLaunch = await page.evaluate(() => localStorage.getItem('birdsquad.run.active'));
  await page.keyboard.press('s');
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', profile.input.gamepad.pad1, { index: 9 }, 1);
  });
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).scene).toBe('ProfileScene');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.run.active'))).toBe(activeBeforeBlockedLaunch);

  await clearActiveFlight();
  await openLab();
  await page.keyboard.press('s');
  await assertExactRoute();

  await clearActiveFlight();
  await openLab();
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', profile.input.gamepad.pad1, { index: 9 }, 1);
  });
  await assertExactRoute();
});

test('owned starter templates create reversible Folios across pointer keyboard and controller without granting cards', async ({ page }) => {
  test.setTimeout(180_000);
  const starters = {
    fledgling: ['major_00', 'wands_ace', 'wands_fledgling', 'swords_ace', 'swords_fledgling', 'cups_ace', 'cups_fledgling', 'pentacles_04', 'pentacles_fledgling', 'aviary_25'],
    spark_caller: ['wands_ace', 'wands_02', 'wands_03', 'wands_05', 'wands_fledgling', 'wands_outrider', 'major_19', 'aviary_28', 'swords_ace', 'pentacles_fledgling'],
    talon: ['swords_ace', 'swords_02', 'swords_03', 'swords_04', 'swords_fledgling', 'swords_08', 'major_18', 'aviary_29', 'pentacles_04', 'cups_03'],
  };
  const discovered = [...new Set(Object.values(starters).flat())];
  await page.addInitScript(({ ids, fledglingCards }) => {
    const cardCollection = Object.fromEntries(fledglingCards.map((id: string, index: number) => [id, {
      timesClaimed: 1,
      firstAcquiredAt: 1_780_100_000_000 + index,
      firstSource: 'starter_flock',
    }]));
    const account = {
      runs: 0,
      wins: 0,
      losses: 0,
      unlockedLeaders: ['fledgling', 'spark_caller'],
      discoveredCards: ids,
      favoriteCards: [],
      cardCollection,
      decks: [],
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  }, { ids: discovered, fledglingCards: starters.fledgling });
  await boot(page);

  const openFolios = async () => {
    await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
    await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
    await page.waitForFunction(() => (
      JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.viewActive === true
    ));
  };
  const clickTemplateLeader = async (leaderId: string) => {
    const center = await page.evaluate((id) => {
      const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
      const hit = profile.children.list.find((child: any) => (
        child.name === 'profile-folio-template-row'
        && child.getData('leaderId') === id
        && child.input?.enabled
      ));
      if (!hit) throw new Error(`Missing starter template row for ${id}`);
      return { x: hit.x, y: hit.y };
    }, leaderId);
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Missing game canvas');
    await page.mouse.click(
      canvas.x + canvas.width * (center.x / 1280),
      canvas.y + canvas.height * (center.y / 720),
    );
  };
  const accountCollection = () => page.evaluate(() => (
    structuredClone(JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').cardCollection)
  ));
  const claimCards = async (cardIds: string[], leaderId: string) => {
    await page.evaluate(({ ids, leader }) => {
      const account = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
      account.unlockedLeaders = [...new Set([...(account.unlockedLeaders ?? []), leader])];
      account.discoveredCards = [...new Set([...(account.discoveredCards ?? []), ...ids])];
      ids.forEach((id: string, index: number) => {
        account.cardCollection[id] ??= {
          timesClaimed: 1,
          firstAcquiredAt: 1_780_200_000_000 + index,
          firstSource: 'combat_reward',
        };
      });
      const raw = JSON.stringify(account);
      localStorage.setItem('birdsquad.account', raw);
      localStorage.setItem('birdsquad.account.backup', raw);
    }, { ids: cardIds, leader: leaderId });
  };

  await openFolios();
  const emptySummary = await expect.poll(
    () => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''),
    { timeout: 5_000 },
  ).toContain('Build from an owned leader starter');
  void emptySummary;
  const newTarget = await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    const hit = profile.children.getByName('profile-folio-template-hit');
    return { width: hit.displayWidth, height: hit.displayHeight, enabled: hit.input?.enabled };
  });
  expect(newTarget.enabled).toBe(true);
  expect(newTarget.width).toBeGreaterThanOrEqual(58);
  expect(newTarget.height).toBeGreaterThanOrEqual(44);
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-template-hit');

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  const fledglingOption = state.savedFlightFolios.template.items.find((item: any) => item.leaderId === 'fledgling');
  const sparkOption = state.savedFlightFolios.template.items.find((item: any) => item.leaderId === 'spark_caller');
  const talonOption = state.savedFlightFolios.template.items.find((item: any) => item.leaderId === 'talon');
  expect(state.savedFlightFolios.template).toMatchObject({
    open: true,
    selectedLeaderId: 'fledgling',
    activeCount: 0,
    capacity: 6,
    createsNewRecord: true,
    grantsOwnership: false,
    changesCollectionHistory: false,
    usesBaseCards: true,
    runMode: 'full',
  });
  expect(fledglingOption).toMatchObject({ ownedCount: 10, missingCount: 0, unlocked: true, available: true });
  expect(sparkOption).toMatchObject({ unlocked: true, available: false, reason: 'Claim 6 starter cards' });
  expect(sparkOption.missingIds).toHaveLength(6);
  expect(sparkOption.missingNames).toHaveLength(6);
  expect(talonOption).toMatchObject({ unlocked: false, available: false, reason: 'Leader locked' });
  const modalTargets = await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    const rows = profile.children.list.filter((child: any) => child.name === 'profile-folio-template-row');
    const build = profile.children.getByName('profile-folio-template-build-hit');
    return {
      rows: rows.map((row: any) => ({ width: row.displayWidth, height: row.displayHeight })),
      build: { width: build.displayWidth, height: build.displayHeight, available: build.getData('available') },
    };
  });
  expect(modalTargets.rows).toHaveLength(5);
  expect(modalTargets.rows.every((row: any) => row.height >= 44)).toBe(true);
  expect(modalTargets.build).toMatchObject({ width: 390, available: true });
  expect(modalTargets.build.height).toBeGreaterThanOrEqual(44);
  await expect.poll(
    () => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''),
    { timeout: 5_000 },
  ).toContain('It never grants cards');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/folio-starter-template-picker.png' });

  const beforeBlockedAccount = await page.evaluate(() => localStorage.getItem('birdsquad.account'));
  await clickTemplateLeader('spark_caller');
  await focusFolioControl(page, 'profile-folio-template-build-hit');
  await page.keyboard.press('Enter');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.template).toMatchObject({
    open: true,
    selectedLeaderId: 'spark_caller',
    status: 'idle',
  });
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(beforeBlockedAccount);
  await expect.poll(
    () => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''),
    { timeout: 5_000 },
  ).toContain('Missing cards');

  const collectionBeforePointerBuild = await accountCollection();
  await clickTemplateLeader('fledgling');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-template-build-hit');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios).toMatchObject({ count: 1, status: 'templateCreated' });
  expect(state.savedFlightFolios.template.open).toBe(false);
  expect(state.savedFlightFolios.items[0]).toMatchObject({
    name: 'The Fledgling Flock Starter',
    leaderId: 'fledgling',
    revision: 1,
    archived: false,
    sourceSeed: 'starter-template:fledgling',
    runMode: 'full',
  });
  expect(state.savedFlightFolios.items[0].cards).toEqual(
    starters.fledgling.map((id) => ({ id, upgraded: false })),
  );
  expect(await accountCollection()).toEqual(collectionBeforePointerBuild);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.run.active'))).toBeNull();
  const successStatus = await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return profile.children.getByName('profile-folio-status')?.text;
  });
  expect(successStatus).toContain('STARTER FOLIO BUILT');
  await expect.poll(
    () => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''),
    { timeout: 5_000 },
  ).toContain('ownership and collection history were unchanged');

  await claimCards(starters.spark_caller, 'spark_caller');
  await openFolios();
  await page.keyboard.press('k');
  await page.waitForFunction(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.template?.open === true
  ));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.count === 2
  ));
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.items[0]).toMatchObject({
    name: 'The Spark-Caller Starter',
    leaderId: 'spark_caller',
    sourceSeed: 'starter-template:spark_caller',
    revision: 1,
    runMode: 'full',
  });
  expect(state.savedFlightFolios.items[0].cards).toEqual(
    starters.spark_caller.map((id) => ({ id, upgraded: false })),
  );

  await claimCards(starters.talon, 'talon');
  await openFolios();
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', profile.input.gamepad.pad1, { index: 5 }, 1);
    profile.input.gamepad.emit('down', profile.input.gamepad.pad1, { index: 13 }, 1);
    profile.input.gamepad.emit('down', profile.input.gamepad.pad1, { index: 13 }, 1);
    profile.input.gamepad.emit('down', profile.input.gamepad.pad1, { index: 0 }, 1);
  });
  await page.waitForFunction(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.count === 3
  ));
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.items[0]).toMatchObject({
    name: 'The Talon Starter',
    leaderId: 'talon',
    sourceSeed: 'starter-template:talon',
    revision: 1,
    runMode: 'full',
  });
  expect(state.savedFlightFolios.items[0].cards).toEqual(
    starters.talon.map((id) => ({ id, upgraded: false })),
  );

  await page.evaluate(() => {
    const account = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
    const source = account.decks[0];
    while (account.decks.filter((deck: any) => !deck.archived).length < 6) {
      const suffix = account.decks.length + 1;
      account.decks.push({
        ...structuredClone(source),
        id: `capacity-folio-${suffix}`,
        lineageId: `capacity-folio-${suffix}`,
        name: `Capacity Folio ${suffix}`,
        createdAt: source.createdAt + suffix,
        updatedAt: source.updatedAt + suffix,
      });
    }
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
  });
  await openFolios();
  await page.keyboard.press('k');
  await page.waitForFunction(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.template?.open === true
  ));
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.template.items.every((item: any) => (
    item.available === false && item.reason === 'Active Folios full'
  ))).toBe(true);
  const fullAccount = await page.evaluate(() => localStorage.getItem('birdsquad.account'));
  await focusFolioControl(page, 'profile-folio-template-build-hit');
  await page.keyboard.press('Enter');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedFlightFolios.template).toMatchObject({
    open: true,
    status: 'idle',
    activeCount: 6,
  });
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(fullAccount);
  await expect.poll(
    () => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''),
    { timeout: 5_000 },
  ).toContain('Active Folios full');
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', profile.input.gamepad.pad1, { index: 1 }, 1);
  });
  await page.waitForFunction(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').savedFlightFolios?.template?.open === false
  ));
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.run.active'))).toBeNull();
});
