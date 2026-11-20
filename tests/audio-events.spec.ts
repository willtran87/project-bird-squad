import { test, expect, type Page } from '@playwright/test';

// Real-browser check of the typed audio events: the hooks fire, the lazy chunks
// load, real WebAudio accepts every node and ramp, and the music, bed and duck
// state follow the fight. It cannot judge how anything sounds.

const audio = (page: Page) => page.evaluate(() => (window as any).__birdSquadAudio());

async function boot(page: Page) {
  await page.addInitScript(() => localStorage.removeItem('birdsquad.audioMuted'));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready === true);
}

async function startBattle(page: Page, routeNodeId = 'm1_entry') {
  await page.evaluate(async (routeNodeId) => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = (window as any).__birdSquadGame;
    await (window as any).__birdSquadEnsureScene?.('BattleScene');
    for (const key of ['MenuScene', 'RouteScene', 'BattleScene']) if (game.scene.isActive(key)) game.scene.stop(key);
    await wait(0);
    game.scene.start('BattleScene', { routeNodeId });
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const scene = game.scene.getScene('BattleScene');
      if (scene?.scene?.isActive?.() && scene.fxLayer?.active && scene.root?.active && scene.mode === 'battle' && !scene.combatAnimationPending) return;
      await wait(25);
    }
  }, routeNodeId);
}

test('typed audio events follow a fight through real WebAudio without errors', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await boot(page);
  test.skip(!await page.evaluate(() => !!(window.AudioContext || (window as any).webkitAudioContext)), 'This browser build does not provide Web Audio.');

  // The first interaction unlocks audio: rain bed and menu drone on the title screen.
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await audio(page)).ambienceBed).toMatchObject({ bed: 'rain', drone: 'menu', overlay: false });
  const title = await audio(page);
  expect(title.events).toEqual({ requests: {}, played: 0 });
  // Everything audio arrives as lazy chunks after that first interaction.
  await expect.poll(() => page.evaluate(() => {
    const files = performance.getEntriesByType('resource').map((entry) => entry.name.split('/').pop()!);
    return ['adaptive-music', 'audio-ambience', 'audio-events', 'audio-sfx', 'audio-voices']
      .filter((chunk) => !files.some((file) => file.startsWith(`${chunk}-`) && file.endsWith('.js')));
  })).toEqual([]);

  await startBattle(page);
  await expect.poll(async () => (await audio(page)).ambienceBed.drone).toBe('battle');
  await expect.poll(async () => (await audio(page)).music).toMatchObject({ pattern: 'street-beat', active: true, tier: 'street', formation: 'holding' });
  const entered = await audio(page);
  expect(entered.events.requests['battle.enter']).toBe(1);
  // A street fight has no entrance sound.
  expect(entered.events.played).toBe(0);

  // A light hit: the scaled impact plays and absorbs the fixed attack cue; the music does not duck.
  const light = await page.evaluate(async () => {
    const scene = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    enemy.maxHp = 200; enemy.hp = 200; enemy.block = 0;
    const before = (window as any).__birdSquadAudio();
    scene.damageEnemy(enemy.id, 4, 'Audio test');
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { before, after: (window as any).__birdSquadAudio() };
  });
  expect(light.after.events.requests['hit.impact']).toBe(1);
  expect(light.after.events.played - light.before.events.played).toBe(1);
  expect((light.after.cueRequests.attack ?? 0) - (light.before.cueRequests.attack ?? 0)).toBe(1);
  // attack was absorbed, hitConfirm still played.
  expect(light.after.sfx.played - light.before.sfx.played).toBe(1);
  expect(light.after.music.ducks).toBe(light.before.music.ducks);

  // A heavy hit by share of max HP ducks the music.
  const heavy = await page.evaluate(async () => {
    const scene = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    enemy.maxHp = 40; enemy.hp = 40; enemy.block = 0;
    const before = (window as any).__birdSquadAudio();
    scene.damageEnemy(enemy.id, 6, 'Audio test');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const small = (window as any).__birdSquadAudio();
    enemy.maxHp = 40; enemy.hp = 40; enemy.block = 0;
    scene.damageEnemy(enemy.id, 20, 'Audio test');
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { before, small, after: (window as any).__birdSquadAudio() };
  });
  expect(heavy.small.music.ducks).toBe(heavy.before.music.ducks);
  expect(heavy.after.music.ducks).toBe(heavy.before.music.ducks + 1);

  // Surge adds stems at the next phrase; Scatter strips them back.
  await page.evaluate(() => {
    const scene = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    scene.flock.flow = scene.flock.flowMax;
    scene.updateFormationFx();
  });
  await expect.poll(async () => (await audio(page)).music.layers).toEqual(expect.arrayContaining(['lead', 'hat', 'shimmer']));
  expect((await audio(page)).music.formation).toBe('surging');
  await page.evaluate(() => {
    const scene = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    scene.flock.flow = 0;
    scene.flock.hp = 1;
    scene.updateFormationFx();
  });
  await expect.poll(async () => (await audio(page)).music.layers).toEqual(['pulse']);
  expect((await audio(page)).events.requests['flock.formation']).toBe(2);

  // The pause overlay lowers the bed and closing it restores the level.
  const openLevel = (await audio(page)).ambienceBed.level;
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').setBattlePaused(true));
  await expect.poll(async () => (await audio(page)).ambienceBed.overlay).toBe(true);
  expect((await audio(page)).ambienceBed.level).toBeCloseTo(openLevel * 0.35, 6);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').setBattlePaused(false));
  await expect.poll(async () => (await audio(page)).ambienceBed.overlay).toBe(false);
  expect((await audio(page)).ambienceBed.level).toBeCloseTo(openLevel, 6);

  // Consecutive card plays are requested as card.play events (the pitch ladder itself is unit-tested).
  const cards = await page.evaluate(async () => {
    const scene = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    scene.flock.hp = scene.flock.maxHp;
    const before = (window as any).__birdSquadAudio();
    const base = scene.allDeckCards()[0];
    const enemyId = scene.enemies.find((enemy: any) => enemy.hp > 0)?.id ?? '';
    const played: number[] = [];
    for (const suit of ['plumes', 'basins', 'nests']) {
      const runtime = { ...base.runtime, id: `audio-${suit}`, suit, cost: 0, target: 'self', effects: ['gainCover(0)'], moltEffects: [], flockStats: {},
        upgrade: { ...base.runtime.upgrade, effects: ['gainCover(0)'], moltEffects: [], flockStats: {} } };
      const card = { ...base, id: `audio-${suit}`, instanceId: `audio-${suit}`, upgraded: false, runtime };
      scene.hand = [card];
      scene.energy = 9;
      scene.playCard(card, enemyId, { resolveDelayMs: 0 });
      await new Promise((resolve) => setTimeout(resolve, 160));
      played.push((window as any).__birdSquadAudio().events.played);
    }
    return { before, played, after: (window as any).__birdSquadAudio() };
  });
  expect(cards.after.cueRequests.card - (cards.before.cueRequests.card ?? 0)).toBe(3);
  expect(cards.played[2] - cards.before.events.played).toBeGreaterThanOrEqual(3);

  // Molt in another district: the stinger is requested and the bed crossfades to that district.
  const crossfades = (await audio(page)).ambienceBed.crossfades;
  await page.evaluate(() => {
    const scene = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    if (scene.runState) scene.runState.mapIndex = 2;
    scene.flywayMapIndex = 2;
    scene.flock.molt = true;
  });
  await expect.poll(async () => (await audio(page)).ambienceBed).toMatchObject({ bed: 'static', crossfades: crossfades + 1 });
  const molted = await audio(page);
  expect(molted.events.requests['stinger.play']).toBe(1);
  await expect.poll(async () => (await audio(page)).music.district).toBe(2);

  // Mute silences the bed and the drone and stops events from playing; unmute brings them back.
  const beforeMute = (await audio(page)).events.played;
  await page.keyboard.press('KeyM');
  await expect.poll(async () => (await audio(page)).ambienceBed).toMatchObject({ bed: null, drone: null, level: 0 });
  await page.evaluate(async () => {
    const scene = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    enemy.maxHp = 200; enemy.hp = 200; enemy.block = 0;
    scene.damageEnemy(enemy.id, 4, 'Audio test');
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
  const muted = await audio(page);
  expect(muted.events.requests['hit.impact']).toBe(4);
  expect(muted.events.played).toBe(beforeMute);
  expect(muted.music.active).toBe(false);
  await page.keyboard.press('KeyM');
  await expect.poll(async () => (await audio(page)).ambienceBed).toMatchObject({ bed: 'static', drone: 'battle' });

  expect(errors).toEqual([]);
});

test('a boss fight reports its tier, plays the entrance and ducks the music under it', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await boot(page);
  test.skip(!await page.evaluate(() => !!(window.AudioContext || (window as any).webkitAudioContext)), 'This browser build does not provide Web Audio.');
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await audio(page)).music.active).toBe(true);
  const before = await audio(page);
  await startBattle(page, 'm1_boss');
  await expect.poll(async () => (await audio(page)).music).toMatchObject({ pattern: 'high-pressure-flight', tier: 'boss' });
  await expect.poll(async () => (await audio(page)).music.layers).toEqual(expect.arrayContaining(['drive', 'sub', 'hat']));
  const after = await audio(page);
  expect(after.events.requests['battle.enter']).toBe(1);
  expect(after.events.played - before.events.played).toBe(1);
  expect(after.music.ducks).toBeGreaterThanOrEqual((before.music.ducks ?? 0) + 1);
  expect(after.ambienceBed).toMatchObject({ bed: 'rain', drone: 'boss' });
  expect(errors).toEqual([]);
});
