import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The living stage is additive presentation. These checks pin its contract:
// it owns separate display objects, follows Lean graphics and Reduced Motion,
// keeps full-screen shader passes off software renderers, and never changes
// what the player can do.
const encounter = JSON.parse(readFileSync('data/game/alpha-encounters.json', 'utf8')).encounters
  .find((entry: { id: string }) => entry.id === 'enc_roof_rat');

async function openBattle(page: Page, query: string, storage: Record<string, string> = {}) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(values => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value as string);
  }, storage);
  await page.goto(`./?flight=spectacle-stage${query}`);
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.evaluate(async entry => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.id === 'm1_entry');
    Object.assign(node, { payloadId: entry.id, type: entry.nodeType, label: entry.name });
    const runState = w.__birdSquadGame.scene.getScene('RouteScene').runState;
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: node.id, runState });
  }, encounter);
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleHandRendererModule && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued
      && b.children.list.some((child: any) => child.name === 'spectacle-target-arc');
  });
  // Two frames: the stage adopts the backdrop on the scene's next update.
  const frame = await page.evaluate(() => (window as any).__birdSquadGame.loop.frame);
  await page.waitForFunction(start => (window as any).__birdSquadGame.loop.frame >= start + 3, frame);
  return errors;
}

const stage = (page: Page) => page.evaluate(() => {
  const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
  const layer = b.children.list.find((child: any) => child.name === 'spectacle-ambient');
  const emitters = layer?.list.filter((child: any) => child.type === 'ParticleEmitter').length ?? 0;
  const lights = layer?.list.filter((child: any) => child.type === 'Image').length ?? 0;
  const animated = layer ? b.tweens.getTweens().filter((tween: any) => tween.targets.some((target: any) => layer.list.includes(target))).length : 0;
  return {
    present: Boolean(layer), depth: layer?.depth, emitters, lights, animated,
    belowCombatants: layer ? layer.depth < b.root.depth && layer.depth > b.backdropLayer.depth : false,
    backdropFiltered: Boolean(b.backdropLayer.filters?.internal.list.length),
    playable: b.mode === 'battle' && b.hand.length > 0,
  };
});

test('battle stage adds lighting and weather on its own layer without touching play', async ({ page }) => {
  const errors = await openBattle(page, '');
  const state = await stage(page);
  expect(state).toMatchObject({ present: true, belowCombatants: true, playable: true });
  expect(state.lights).toBeGreaterThanOrEqual(8);
  expect(state.emitters).toBeGreaterThanOrEqual(2);
  expect(state.animated).toBeGreaterThan(0);
  // Automated browsers render on the CPU: shader passes must stay off there.
  expect(state.backdropFiltered).toBe(false);
  expect(errors).toEqual([]);
});

test('Reduced Motion keeps the still lighting and removes every moving part', async ({ page }) => {
  const errors = await openBattle(page, '', { 'birdsquad.motionPreference': 'reduced' });
  const state = await stage(page);
  expect(state).toMatchObject({ present: true, emitters: 0, animated: 0, playable: true });
  expect(state.lights).toBeGreaterThanOrEqual(8);
  expect(errors).toEqual([]);
});

test('Lean graphics removes the stage dressing entirely', async ({ page }) => {
  const errors = await openBattle(page, '', { 'birdsquad.graphicsQuality': 'lean' });
  expect(await stage(page)).toMatchObject({ present: false, backdropFiltered: false, playable: true });
  expect(errors).toEqual([]);
});

test('requested filters grade the backdrop only, and the hand keeps full portraits', async ({ page }) => {
  const errors = await openBattle(page, '&fx=full');
  expect((await stage(page)).backdropFiltered).toBe(true);
  const cards = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return [...b.handCardRects.entries()].map(([id, rect]: any) => {
      const art = b.handCardArtLayers.get(id)?.getByName('combat-hand-illustration');
      return {
        rounded: rect.isRounded === true || rect.radius > 0,
        fills: Boolean(art) && art.displayHeight >= rect.height - 16 && art.displayWidth >= rect.width - 16,
        halo: Boolean(rect.getData('halo')?.active),
      };
    });
  });
  expect(cards.length).toBeGreaterThan(0);
  for (const card of cards) expect(card).toEqual({ rounded: true, fills: true, halo: true });
  expect(await page.evaluate(() => ['21px BirdSquadUI', 'bold 21px BirdSquadUI', 'bold 21px BirdSquadDisplay']
    .every(font => document.fonts.check(font)))).toBe(true);
  expect(errors).toEqual([]);
});

test('hovering a card brightens its halo without moving it or changing selection', async ({ page }) => {
  await openBattle(page, '');
  const read = (id?: string) => page.evaluate(id => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const [cardId, rect] = id ? [id, b.handCardRects.get(id)] : [...b.handCardRects.entries()][2];
    const box = b.game.canvas.getBoundingClientRect(), scale = box.width / 1280, bounds = rect.getBounds();
    return { id: cardId, halo: rect.getData('halo').alpha, selected: b.selectedInstanceId,
      bounds: [bounds.x, bounds.y, bounds.width, bounds.height],
      x: box.left + rect.x * scale, y: box.top + rect.y * scale };
  }, id);
  const before = await read();
  await page.mouse.move(before.x, before.y);
  await page.waitForFunction(({ id, halo }) =>
    (window as any).__birdSquadGame.scene.getScene('BattleScene').handCardRects.get(id).getData('halo').alpha > halo, before);
  expect((await read(before.id)).bounds).toEqual(before.bounds);
  await page.mouse.move(4, 4);
  await page.waitForFunction(({ id, halo }) =>
    (window as any).__birdSquadGame.scene.getScene('BattleScene').handCardRects.get(id).getData('halo').alpha === halo, before);
  const after = await read(before.id);
  expect(after.bounds).toEqual(before.bounds);
  expect(after.selected).toBe(before.selected);
});
