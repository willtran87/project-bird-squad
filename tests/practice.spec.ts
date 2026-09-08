import { test, expect, type Page } from '@playwright/test';
import { flockLeaders } from '../src/game/leaders';
import { beginPracticeSession, endPracticeSession } from '../src/game/practice-session';
import { safeStorageGet, safeStorageSet, readJournaledJson, writeJournaledJson, removeJournaledJson, consumeStorageRecoveryEvents, memoryStorageSessionActive } from '../src/game/safe-storage';

const cards = flockLeaders[0].startingDeckIds.map((id, index) => ({ id, upgraded: index === 0 }));
const state = (page: Page) => page.evaluate(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}'));
const disk = (page: Page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])));

async function startScene(page: Page, key: string, data?: unknown) {
  await page.evaluate(async ({ key, data }) => {
    const w = window as any;
    await w.__birdSquadEnsureScene?.(key);
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start(key, data);
  }, { key, data });
  await page.waitForFunction(key => {
    const w = window as any;
    const s = w.__birdSquadGame.scene.getScene(key);
    return s.scene.isActive() && JSON.parse(w.render_game_to_text?.() ?? '{}').scene === key
      && (key !== 'RouteScene' || s.routeEssentialAssetsReady)
      && (key !== 'BattleScene' || s.hand?.length > 0 && !s.combatAnimationPending);
  }, key);
}

async function hit(page: Page, key: string, name: string) {
  const point = await page.evaluate(({ key, name }) => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    const all = (items: any[]): any[] => items.flatMap(c => [c, ...all(c.list ?? [])]);
    const target = all(s.children.list).find(c => c.name === name && c.input?.enabled);
    if (!target) throw Error(`Missing ${name}`);
    const bounds = target.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  }, { key, name });
  const canvas = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(canvas.x + point.x * canvas.width / 1280, canvas.y + point.y * canvas.height / 720, { delay: 50 });
}

async function openLab(page: Page) {
  await startScene(page, 'ProfileScene');
  await hit(page, 'ProfileScene', 'profile-folios-tab-hit');
  await hit(page, 'ProfileScene', 'profile-folio-lab-hit');
  await expect.poll(async () => (await state(page)).savedFlightFolios?.flightLab?.open).toBe(true);
}

async function setup(page: Page) {
  await page.addInitScript(cards => {
    if (localStorage.getItem('practice-test-initialized')) return;
    localStorage.setItem('practice-test-initialized', 'yes');
    const raw = JSON.stringify({
      runs: 1, wins: 0, losses: 1, unlockedLeaders: ['fledgling'],
      cardCollection: Object.fromEntries(cards.map(card => [card.id, { timesClaimed: 1, firstAcquiredAt: 1780000000000, firstSource: 'combat_reward' }])),
      discoveredCards: cards.map(card => card.id),
      decks: [{ id: 'safe-practice', lineageId: 'safe-practice', revision: 1,
        name: 'Rooftop Practice', leaderId: 'fledgling', cards, createdAt: 1780000000000,
        updatedAt: 1780000000000, favorite: false, archived: false, runMode: 'quick' }],
    });
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
    localStorage.setItem('birdsquad.motionPreference', 'reduced');
  }, cards);
  await page.goto('/');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').scene === 'MenuScene');
  // Create a genuine active flight first; practice must preserve it byte-for-byte.
  await startScene(page, 'RouteScene');
  await startScene(page, 'MenuScene');
  await openLab(page);
}

test('practice storage isolates journal repair, removal, blocked storage and recovery notices', () => {
  const priorWindow = globalThis.window;
  const data = new Map<string, string>([['saved', '{broken'], ['saved.backup', '{"value":1}']]);
  const backend = {
    get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
  (globalThis as any).window = { localStorage: backend, __birdSquadLastRun: { id: 'real' } };
  const valid = (value: any) => typeof value?.value === 'number' ? value : undefined;
  try {
    expect(readJournaledJson('saved', valid)).toEqual({ value: 1 });
    const before = [...data];
    expect(beginPracticeSession()).toBe(true);
    expect(beginPracticeSession()).toBe(false);
    expect(writeJournaledJson('saved', { value: 2 })).toBe(true);
    expect(readJournaledJson('saved', valid)).toEqual({ value: 2 });
    safeStorageSet('damaged', 'bad');
    expect(readJournaledJson('damaged', valid)).toBeUndefined();
    removeJournaledJson('saved');
    expect(safeStorageGet('saved')).toBeNull();
    expect(consumeStorageRecoveryEvents()).toEqual([]);
    expect([...data]).toEqual(before);
    (window as any).__birdSquadLastRun = { id: 'practice' };
    endPracticeSession();
    expect((window as any).__birdSquadLastRun.id).toBe('real');
    expect(consumeStorageRecoveryEvents()).toEqual([{ key: 'saved', outcome: 'recovered' }]);
    expect(readJournaledJson('saved', valid)).toEqual({ value: 1 });
    Object.defineProperty(window, 'localStorage', { get() { throw Error('blocked'); } });
    expect(beginPracticeSession()).toBe(true);
    expect(writeJournaledJson('memory', { value: 3 })).toBe(true);
    expect(readJournaledJson('memory', valid)).toEqual({ value: 3 });
    endPracticeSession();
    expect(memoryStorageSessionActive()).toBe(false);
    expect(safeStorageGet('memory')).toBeNull();
  } finally {
    endPracticeSession();
    (globalThis as any).window = priorWindow;
  }
});

for (const launch of ['pointer', 'keyboard', 'controller'] as const) {
  test(`playable practice ${launch} preserves real progress through combat, outcomes, exit and refresh`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width: 2560, height: 1600 });
    await setup(page);
    const before = await disk(page);
    expect((await state(page)).savedFlightFolios.flightLab.launch.block).toBe('activeFlight');
    expect((await state(page)).savedFlightFolios.flightLab.practice.available).toBe(true);
    for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(viewport);
      await page.screenshot({ path: testInfo.outputPath(`lab-${viewport.width}.png`) });
    }
    if (launch === 'pointer') await hit(page, 'ProfileScene', 'profile-flight-lab-practice-hit');
    else if (launch === 'keyboard') await page.keyboard.press('u');
    else await page.evaluate(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
      s.input.gamepad.emit('down', s.input.gamepad.pad1, { index: 8 }, 1);
    });
    await expect.poll(async () => (await state(page)).practice).toBe(true);
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
    expect(await disk(page)).toEqual(before);
    const runState = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState);
    expect(runState.deck).toEqual(cards);
    const routeNodeId = await page.evaluate(() => (window as any).__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'street').id);
    await startScene(page, 'BattleScene', { runState, routeNodeId });
    expect((await state(page)).practice).toBe(true);
    expect(await page.evaluate(() => {
      const badge = (window as any).__birdSquadGame.scene.getScene('BattleScene').children.getByName('practice-session-badge');
      return badge?.visible && badge?.active && badge?.text;
    })).toBe('PRACTICE · nothing saved');
    const played = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const card = b.hand.find((c: any) => c.cost <= b.energy && c.type !== 'molt');
      const before = b.statCardsPlayed;
      b.playCard(card, b.enemies[0].id);
      return { before, after: b.statCardsPlayed };
    });
    expect(played.after).toBe(played.before + 1);
    expect(await disk(page)).toEqual(before);
    await expect.poll(() => page.locator('#game-status').textContent()).toContain('Practice. Nothing saved.');
    for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(viewport);
      await page.screenshot({ path: testInfo.outputPath(`battle-${viewport.width}.png`) });
    }
    // Exercise both terminal record-writing paths, with deterministic fixtures.
    await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      b.emitRunSummary('win');
      b.flock.hp = 0;
      b.checkOutcome();
      b.renderAll();
    });
    await page.screenshot({ path: testInfo.outputPath('outcome.png') });
    expect(await disk(page)).toEqual(before);
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').returnToMainMenu());
    await expect.poll(async () => (await state(page)).scene).toBe('MenuScene');
    expect(await disk(page)).toEqual(before);
    // A fresh practice session can be discarded by browser refresh too.
    await openLab(page);
    await page.keyboard.press('u');
    await expect.poll(async () => (await state(page)).practice).toBe(true);
    await page.reload();
    await expect.poll(async () => (await state(page)).scene).toBe('MenuScene');
    expect(await disk(page)).toEqual(before);
    expect(errors).toEqual([]);
  });
}

test('practice rewards and seeded retry remain disposable and preserve the starting Folio', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await setup(page);
  const before = await disk(page);
  await page.keyboard.press('u');
  await expect.poll(async () => (await state(page)).practice).toBe(true);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  const runState = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState);
  const routeNodeId = await page.evaluate(() => (window as any).__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'street').id);
  await startScene(page, 'BattleScene', { runState, routeNodeId });
  const rewardId = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.enemies.forEach((enemy: any) => { enemy.hp = 0; });
    b.checkOutcome();
    if (b.mode === 'waymarkReward') b.chooseWaymarkReward(b.waymarkChoices[0].id);
    return b.rewardChoices[0].id;
  });
  await page.screenshot({ path: testInfo.outputPath('practice-reward.png') });
  expect(await disk(page)).toEqual(before);
  await page.evaluate(id => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.chooseRewardCard(id);
    if (b.mode === 'upgradeReward') b.chooseUpgradeCard(b.upgradeChoices[0].id);
  }, rewardId);
  await expect.poll(async () => (await state(page)).scene).toBe('RouteScene');
  expect((await state(page)).practice).toBe(true);
  expect(await page.evaluate(id => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState.deck.some((c: any) => c.id === id), rewardId)).toBe(true);
  expect(await disk(page)).toEqual(before);
  await startScene(page, 'BattleScene', { runState, routeNodeId });
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.flock.hp = 0;
    b.checkOutcome();
    b.replayLastFlight();
  });
  await expect.poll(async () => (await state(page)).scene).toBe('RouteScene');
  expect((await state(page)).practice).toBe(true);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState.deck)).toEqual(cards);
  expect(await disk(page)).toEqual(before);
  // Exercise the real pause menu's Main Menu callback, including its save path.
  await page.keyboard.press('p');
  await expect.poll(async () => (await state(page)).pauseOverlayOpen).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('practice-paused.png') });
  const canvas = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(canvas.x + 818 * canvas.width / 1280, canvas.y + 503 * canvas.height / 720, { delay: 50 });
  await expect.poll(async () => (await state(page)).scene).toBe('MenuScene');
  await page.waitForTimeout(1000); // Check that retired scene callbacks cannot save late.
  expect(await disk(page)).toEqual(before);
});

test('practice does not bypass collection ownership or Leader unlocks', async ({ page }) => {
  test.setTimeout(60_000);
  await setup(page);
  for (const block of ['unownedCards', 'lockedLeader']) {
    await startScene(page, 'MenuScene');
    await page.evaluate(block => {
      const account = JSON.parse(localStorage.getItem('birdsquad.account')!);
      if (block === 'unownedCards') delete account.cardCollection.aviary_25;
      else account.decks[0].leaderId = 'talon';
      const raw = JSON.stringify(account);
      localStorage.setItem('birdsquad.account', raw);
      localStorage.setItem('birdsquad.account.backup', raw);
    }, block);
    await openLab(page);
    expect((await state(page)).savedFlightFolios.flightLab.practice).toMatchObject({ available: false, block });
    const before = await disk(page);
    await page.keyboard.press('u');
    await page.evaluate(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
      s.input.gamepad.emit('down', s.input.gamepad.pad1, { index: 8 }, 1);
    });
    expect((await state(page)).scene).toBe('ProfileScene');
    expect(await disk(page)).toEqual(before);
  }
});
