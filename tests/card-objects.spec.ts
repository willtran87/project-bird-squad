import { test, expect, type Page } from '@playwright/test';

// Cards as physical objects: a played card is thrown at its target, drawn cards
// fly in from the draw pile, discards travel to the discard pile, cleared cards
// burn, a card can be dragged onto a target, rarity reads from the frame and
// changed numbers are tinted. None of it may move a logical slot, change when
// an effect resolves, or play a card the player did not mean to play.

test.afterEach(async ({ page }) => {
  await page.goto('about:blank');
});

async function openBattle(page: Page, storage: Record<string, string> = {}, arrange = true, freezeWhenReady = false) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(values => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value as string);
  }, storage);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  if (freezeWhenReady) {
    // Stop wall-clock frames while the intro is still playing, then step the
    // scene clock alone until it clears: one slow real frame on a loaded
    // machine can no longer run past the start of the deal.
    await page.waitForFunction(() => {
      const w = window as any, s = JSON.parse(w.render_game_to_text?.() ?? '{}');
      const b = w.__birdSquadGame.scene.getScene('BattleScene');
      if (s.scene !== 'BattleScene' || !s.assetReadiness?.fullArt || !b.battleActors || !b.cardObjects || !b.battleHandRendererModule) return false;
      w.__birdSquadGame.loop.sleep();
      return true;
    });
    await page.evaluate(() => {
      const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
      const ready = () => {
        const s = JSON.parse(w.render_game_to_text?.() ?? '{}');
        return !s.combatIntro?.active && !s.combatAnimationPending && b.handCardRects.size === b.hand.length && !b.battleRenderQueued;
      };
      for (let i = 0; i < 2000 && !ready(); i += 1) w.advanceTime(5);
      if (!ready()) throw new Error('intro did not clear on the scene clock');
    });
  }
  await page.waitForFunction(() => {
    const w = window as any, s = JSON.parse(w.render_game_to_text?.() ?? '{}');
    const b = w.__birdSquadGame.scene.getScene('BattleScene');
    return s.scene === 'BattleScene' && s.assetReadiness?.fullArt && !s.combatIntro?.active && !s.combatAnimationPending
      && b.battleActors && b.cardObjects && b.battleHandRendererModule && b.handCardRects.size === b.hand.length && !b.battleRenderQueued;
  });
  if (!arrange) return errors;
  // A known hand: an enemy-target attack first, then a Cover card, on a sturdy enemy.
  await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const pick = (id: string) => b.allDeckCards().find((card: any) => card.id === id);
    const wanted = ['swords_ace', 'pentacles_fledgling', 'wands_fledgling', 'major_00', 'cups_ace'].map(pick).filter(Boolean);
    for (const zone of ['hand', 'drawPile', 'discardPile', 'clearedPile']) b[zone] = b[zone].filter((card: any) => !wanted.includes(card));
    b.drawPile.push(...b.hand); b.hand = wanted;
    b.energy = 3; b.enemies[0].hp = b.enemies[0].maxHp = 400;
    b.renderAll(); w.advanceTime(900); // past the opening deal
  });
  return errors;
}

const REDUCED = { 'birdsquad.motionPreference': 'reduced' };

test('a played card is thrown from its slot to its target, lands with the effect and goes to the discard pile', async ({ page }, info) => {
  const errors = await openBattle(page);
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene'), stage = b.cardObjects;
    const card = b.hand[0], enemy = b.enemies[0], rect = b.handCardRects.get(card.instanceId);
    const slot = { x: rect.x, y: rect.y }, view = b.enemyView(enemy), hpBefore = enemy.hp, discardBefore = b.discardPile.length;
    b.playCard(card, enemy.id, { resolveDelayMs: 600 });
    const ghost = b.fxLayer.getByName('combat-card-cast-ghost');
    const sample = () => ({ x: ghost.x, y: ghost.y, scale: ghost.scaleX, angle: ghost.angle, top: ghost.getBounds().top, hp: enemy.hp, active: ghost.active });
    const start = sample(), to = ghost.getData('to'), count = b.fxLayer.list.filter((o: any) => o.name === 'combat-card-cast-ghost').length;
    const path = [start];
    for (let i = 0; i < 59; i += 1) { w.advanceTime(10); path.push(sample()); }
    const last = path[path.length - 1];
    w.advanceTime(20);
    const impact = { ghost: Boolean(b.fxLayer.getByName('combat-card-cast-ghost')), hp: enemy.hp, discard: b.discardPile.length };
    const flying = stage.debugState();
    const shown = stage.shownPileCount('DISCARD');
    const legacy = b.fxLayer.list.filter((o: any) => o.name === 'combat-pile-transfer').length;
    w.advanceTime(160);
    const midway = stage.debugState().departing[0];
    w.advanceTime(400);
    return { slot, view, to, start, count, path, last, impact, hpBefore, discardBefore, flying: flying.departing, shown, legacy, midway,
      after: stage.debugState(), shownAfter: stage.shownPileCount('DISCARD'), pending: b.combatAnimationPending, discardPos: b.discardPilePos() };
  });
  // Leaves the hand slot at hand size.
  expect(result.count).toBe(1);
  expect(Math.hypot(result.start.x - result.slot.x, result.start.y - result.slot.y)).toBeLessThan(24);
  expect(result.start.scale).toBeGreaterThan(2);
  // Travels on an arc: it rises above the straight line, never into the HUD.
  const mid = result.path[38];
  const chord = result.start.y + (result.to.y - result.start.y) * ((mid.x - result.start.x) / (result.to.x - result.start.x));
  expect(mid.y).toBeLessThan(chord - 8);
  expect(Math.min(...result.path.map((point: any) => point.top))).toBeGreaterThan(96);
  expect(Math.abs(result.last.angle)).toBeGreaterThan(4);
  // Lands on the enemy as the unchanged resolve delay ends, smaller than it left.
  expect(Math.hypot(result.to.x - result.view.x, result.to.y - result.view.y)).toBeLessThan(60);
  expect(Math.hypot(result.last.x - result.to.x, result.last.y - result.to.y)).toBeLessThan(45); // one frame from landing
  expect(result.last.scale).toBeLessThan(1.1);
  expect(result.path.every((point: any) => point.hp === result.hpBefore && point.active)).toBe(true);
  expect(result.impact.ghost).toBe(false);
  expect(result.impact.hp).toBeLessThan(result.hpBefore);
  expect(result.impact.discard).toBe(result.discardBefore + 1);
  // Then the same small card flies from the landing to the discard pile; the counter waits for it.
  expect(result.legacy).toBe(0);
  expect(result.flying).toHaveLength(1);
  expect(result.flying[0]).toMatchObject({ fate: 'discard', played: true });
  expect(Math.hypot(result.flying[0].x - result.to.x, result.flying[0].y - result.to.y)).toBeLessThan(30);
  expect(result.shown).toBe(result.discardBefore);
  expect(result.midway.x).toBeGreaterThan(result.flying[0].x + 20);
  expect(result.after.departing).toEqual([]);
  expect(result.shownAfter).toBe(result.discardBefore + 1);
  expect(result.pending).toBe(false);
  await page.screenshot({ path: info.outputPath('after-flight.png') });
  expect(errors).toEqual([]);
});

test('Cover and skill cards fly to the flock, untargeted cards to the centre', async ({ page }) => {
  const errors = await openBattle(page);
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const landings: Record<string, any> = {};
    for (const id of ['pentacles_fledgling', 'wands_fledgling']) {
      const card = b.hand.find((entry: any) => entry.id === id);
      b.energy = 3;
      const target = b.activeCardContract(card).target;
      b.playCard(card, b.enemies[0].id, { resolveDelayMs: 300 });
      landings[id] = { target, to: b.fxLayer.getByName('combat-card-cast-ghost').getData('to') };
      w.advanceTime(1200);
    }
    return { landings, flock: b.battleActors.actors.get('flock').slot, pending: b.combatAnimationPending };
  });
  const cover = result.landings.pentacles_fledgling, untargeted = result.landings.wands_fledgling;
  expect(cover.target).toBe('self');
  expect(Math.hypot(cover.to.x - result.flock.x, cover.to.y - result.flock.y)).toBeLessThan(120);
  expect(untargeted.target).toBe('none');
  expect(Math.abs(untargeted.to.x - 640)).toBeLessThan(2);
  expect(result.pending).toBe(false);
  expect(errors).toEqual([]);
});

test('drawn cards fly in from the draw pile in a stagger and the counter ticks down as they leave', async ({ page }) => {
  const errors = await openBattle(page);
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene'), stage = b.cardObjects, actors = b.battleActors;
    b.discardPile.push(...b.hand.splice(3)); b.renderAll(); w.advanceTime(800);
    const real = b.drawPile.length, pile = b.drawPilePos();
    const text = () => b.root.list.find((o: any) => o.name === 'combat-pile-count' && o.getData('pile') === 'DRAW').text;
    b.fxLayer.removeAll(true);
    b.drawCards(2);
    const backs = b.fxLayer.list.filter((o: any) => o.name === 'combat-pile-transfer').length;
    b.renderAll();
    const drawn = b.hand.slice(-2).map((card: any) => card.instanceId);
    const pose = (id: string) => { const a = actors.debugState().actors.find((actor: any) => actor.id === `card:${id}`); return { ...a.pose, slot: a.slot, motions: a.motions }; };
    const bounds = (id: string) => { const r = b.handCardRects.get(id).getBounds(); return [r.x, r.y, r.width, r.height]; };
    const start = drawn.map(pose), boundsStart = drawn.map(bounds), shownStart = stage.shownPileCount('DRAW'), textStart = (w.advanceTime(1), text());
    w.advanceTime(40);
    const first = drawn.map(pose), shownFirst = stage.shownPileCount('DRAW');
    w.advanceTime(80);
    const second = drawn.map(pose), shownSecond = stage.shownPileCount('DRAW');
    w.advanceTime(700);
    return { real, pile, backs, start, first, second, settled: drawn.map(pose), boundsStart, boundsEnd: drawn.map(bounds),
      shownStart, textStart, shownFirst, shownSecond, shownEnd: stage.shownPileCount('DRAW'), textEnd: text(), drawPile: b.drawPile.length, deals: stage.counts.deals };
  });
  expect(result.backs).toBe(0); // the cards themselves travel; no stand-in card backs
  expect(result.deals).toBeGreaterThanOrEqual(2);
  for (const card of result.start) {
    expect(card.motions).toContain('deal');
    // Drawn at the draw pile, small; the logical slot is already the hand slot.
    expect(card.slot.x + card.x).toBeCloseTo(result.pile.x, 0);
    expect(card.slot.y + card.y).toBeCloseTo(result.pile.y, 0);
    expect(card.scaleX).toBeLessThan(0.3);
  }
  // Staggered: the first card is under way while the second still waits in the pile.
  expect(Math.abs(result.first[0].x)).toBeLessThan(Math.abs(result.start[0].x) - 10);
  expect(result.first[1].x).toBeCloseTo(result.start[1].x, 3);
  expect(Math.abs(result.second[1].x)).toBeLessThan(Math.abs(result.start[1].x) - 10);
  for (const card of result.settled) {
    expect(Math.abs(card.x)).toBeLessThan(1);
    expect(Math.abs(card.y)).toBeLessThan(8); // only the hand fan remains
    expect(card.scaleX).toBeCloseTo(1, 2);
    expect(card.motions).toEqual([]);
  }
  expect(result.boundsEnd).toEqual(result.boundsStart);
  // The counter keeps each card until it leaves the pile.
  expect(result.drawPile).toBe(result.real - 2);
  expect(result.shownStart).toBe(result.real);
  expect(result.textStart).toBe(`${result.real}`);
  expect(result.shownFirst).toBe(result.real - 1);
  expect(result.shownSecond).toBe(result.real - 2);
  expect(result.shownEnd).toBe(result.real - 2);
  expect(result.textEnd).toBe(`${result.real - 2}`);
  expect(errors).toEqual([]);
});

test('the opening hand is dealt from the draw pile once the encounter intro has cleared, and only once', async ({ page }) => {
  // On a slow machine the battle art can finish loading after the deal has
  // already played, so the deal is checked through the record it leaves rather
  // than caught mid-flight.
  const errors = await openBattle(page, {}, false, true);
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene'), stage = b.cardObjects;
    const cards = () => b.battleActors.debugState().actors.filter((actor: any) => actor.kind === 'card');
    const bounds = () => b.hand.map((card: any) => { const r = b.handCardRects.get(card.instanceId).getBounds(); return [r.x, r.y, r.width, r.height]; });
    const start = { intro: b.combatIntroActive, deals: stage.counts.deals, hand: b.hand.length, bounds: bounds(),
      opening: stage.opening, shown: stage.shownPileCount('DRAW'), real: b.drawPile.length };
    w.advanceTime(900);
    const settled = cards().every((actor: any) => actor.motions.length === 0 && Math.abs(actor.pose.x) < 1 && Math.abs(actor.pose.scaleX - 1) < 0.01);
    b.handRenderKey = ''; b.renderAll(); w.advanceTime(200);
    const out = { start, settled, boundsAfter: bounds(), dealsAfter: stage.counts.deals, again: cards().some((actor: any) => actor.motions.includes('deal')) };
    w.__birdSquadGame.loop.wake();
    return out;
  });
  expect(result.start.intro).toBe(false);
  expect(result.start.hand).toBeGreaterThan(1);
  expect(result.start.deals).toBe(result.start.hand);
  // Every card was dealt, after the intro, each starting later than the last.
  expect(result.start.opening).toMatchObject({ cards: result.start.hand, afterIntro: true });
  expect(result.start.opening.delays).toHaveLength(result.start.hand);
  expect(result.start.opening.delays.every((delay: number, i: number, all: number[]) => i === 0 || delay > all[i - 1])).toBe(true);
  expect(result.start.shown).toBe(result.start.real); // the pile already shows the settled count
  expect(result.settled).toBe(true);
  expect(result.boundsAfter).toEqual(result.start.bounds); // layout never moved
  expect(result.dealsAfter).toBe(result.start.deals);
  expect(result.again).toBe(false);
  expect(errors).toEqual([]);
});

test('discarded cards travel to the discard pile as themselves and a cleared card burns', async ({ page }, info) => {
  const errors = await openBattle(page);
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene'), stage = b.cardObjects;
    const real = b.discardPile.length, pile = b.discardPilePos();
    const text = () => b.root.list.find((o: any) => o.name === 'combat-pile-count' && o.getData('pile') === 'DISCARD').text;
    const leaving = b.hand.slice(-2).map((card: any) => card.instanceId);
    const slots = leaving.map((id: string) => b.handCardRects.get(id).x);
    b.fxLayer.removeAll(true);
    b.discardCards(2);
    const backs = b.fxLayer.list.filter((o: any) => o.name === 'combat-pile-transfer').length;
    b.renderAll();
    const bodies = stage.layer.list.filter((o: any) => o.name === 'combat-card-departing');
    const start = stage.debugState().departing, inHand = b.handLayer.list.filter((o: any) => o.name === 'combat-card-title').length;
    const titles = bodies.map((body: any) => body.list.some((o: any) => o.name === 'combat-card-title'));
    const shownStart = stage.shownPileCount('DISCARD'), actors = b.battleActors.debugState().actors.filter((a: any) => a.kind === 'card').length;
    w.advanceTime(200);
    const mid = stage.debugState().departing, textMid = text();
    w.advanceTime(500);
    const done = { departing: stage.debugState().departing, shown: stage.shownPileCount('DISCARD'), text: text(), alive: bodies.some((body: any) => body.active) };
    // A card cleared for this combat burns where it is instead of travelling.
    const burned = b.hand.pop(); b.clearedPile.push(burned); b.renderAll();
    const burn = stage.layer.list.find((o: any) => o.name === 'combat-card-departing');
    const burning = { fate: burn?.getData('fate'), glow: Boolean(burn?.list.some((o: any) => o.name === 'combat-card-burn-glow')), x: burn?.x, y: burn?.y };
    w.advanceTime(120);
    const sparks = stage.layer.list.filter((o: any) => o.name === 'combat-card-burn-spark').length;
    return { real, pile, leaving, slots, backs, start, inHand, titles, shownStart, actors, mid, textMid, done, burning, sparks, hand: b.hand.length,
      discardShownDuringBurn: stage.shownPileCount('DISCARD'), burns: stage.counts.burns };
  });
  expect(result.backs).toBe(0);
  expect(result.start.map((body: any) => body.fate)).toEqual(['discard', 'discard']);
  expect(result.start.map((body: any) => body.cardId).sort()).toEqual([...result.leaving].sort());
  // They leave from their own slots, as the full card face, and are no longer hand objects.
  expect(result.start.map((body: any) => Math.round(body.x)).sort()).toEqual(result.slots.map((x: number) => Math.round(x)).sort());
  expect(result.titles).toEqual([true, true]);
  expect(result.inHand).toBe(3);
  expect(result.actors).toBe(3);
  expect(result.shownStart).toBe(result.real);
  // Midway they have moved toward the pile and shrunk.
  for (const body of result.mid) {
    expect(body.x).toBeGreaterThan(Math.min(...result.slots));
    expect(body.scale).toBeLessThan(0.95);
  }
  expect(result.done.departing).toEqual([]);
  expect(result.done.alive).toBe(false);
  expect(result.done.shown).toBe(result.real + 2);
  expect(result.done.text).toBe(`${result.real + 2}`);
  expect(result.burning).toMatchObject({ fate: 'exhaust', glow: true });
  expect(result.sparks).toBeGreaterThan(3);
  expect(result.burns).toBe(1);
  expect(result.discardShownDuringBurn).toBe(result.real + 2);
  await page.screenshot({ path: info.outputPath('burning.png') });
  const gone = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    w.advanceTime(900);
    return b.cardObjects.layer.list.filter((o: any) => o.name.startsWith('combat-card-')).length;
  });
  expect(gone).toBe(0);
  expect(errors).toEqual([]);
});

async function canvasPoint(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  return { x: box.x + x * box.width / 1280, y: box.y + y * box.height / 720 };
}

async function handPoints(page: Page) {
  return page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const hit = b.root.list.find((o: any) => o.name === 'combat-enemy-hit');
    return {
      cards: b.hand.map((card: any) => ({ id: card.instanceId, target: b.activeCardContract(card).target, x: b.handCardRects.get(card.instanceId).x, y: b.handCardRects.get(card.instanceId).y + 60 })),
      enemy: { x: hit.x, y: hit.y }, enemyId: hit.getData('enemyId'),
    };
  });
}

const battleState = (page: Page) => page.evaluate(() => {
  const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), stage = b.cardObjects;
  return { hand: b.hand.length, selected: b.selectedInstanceId, pending: b.combatAnimationPending, hp: b.enemies[0].hp, energy: b.energy,
    counts: { ...stage.counts }, dragging: stage.dragging, target: stage.dragTarget, zones: stage.layer.getByName('combat-drag-target').getData('zones'),
    lit: stage.layer.getByName('combat-drag-target').getData('target'),
    dragged: b.battleActors.debugState().hand.dragged };
});

const settled = (page: Page) => page.waitForFunction(() => {
  const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
  return !b.combatAnimationPending && !b.battleRenderQueued;
});

test('dragging a card onto a valid target plays it; releasing elsewhere returns it; a click still only selects', async ({ page }, info) => {
  const errors = await openBattle(page);
  const points = await handPoints(page);
  const attack = points.cards.find((card: any) => card.target === 'enemy')!, cover = points.cards.find((card: any) => card.target === 'self')!;
  const before = await battleState(page);

  // A stray click selects and plays nothing, exactly as before.
  const press = await canvasPoint(page, attack.x, attack.y);
  await page.mouse.move(press.x, press.y);
  await page.mouse.down(); await page.mouse.up();
  let state = await battleState(page);
  expect(state).toMatchObject({ hand: before.hand, selected: attack.id, pending: false, hp: before.hp, dragging: undefined });
  expect(state.counts.drags).toBe(0);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.selectedInstanceId = undefined; b.renderAll(); });

  // Drag out of the hand: the card follows the pointer, its slot and hit area do not move.
  await page.mouse.move(press.x, press.y);
  await page.mouse.down();
  const open = await canvasPoint(page, 560, 330);
  await page.mouse.move(open.x, open.y, { steps: 8 });
  await page.waitForTimeout(200);
  state = await battleState(page);
  expect(state.dragging).toBe(attack.id);
  expect(state.selected).toBe(attack.id);
  expect(state.target).toBeUndefined(); // a targeted card over open ground has no target
  expect(state.zones).toEqual([points.enemyId]);
  expect(state.lit).toBeUndefined();
  expect(state.dragged.id).toBe(attack.id);
  expect(state.dragged.y).toBeLessThan(-150);
  // Released over nothing: it returns, nothing is played and the press's selection is undone.
  await page.mouse.up();
  await page.waitForTimeout(250);
  state = await battleState(page);
  expect(state).toMatchObject({ hand: before.hand, selected: undefined, pending: false, hp: before.hp, energy: before.energy, dragging: undefined });
  expect(state.counts).toMatchObject({ drags: 1, drops: 0, returns: 1 });
  expect(state.dragged).toBeUndefined();

  // Dragged onto the enemy: the target lights and release plays the card on it.
  await page.mouse.move(press.x, press.y);
  await page.mouse.down();
  const enemy = await canvasPoint(page, points.enemy.x, points.enemy.y);
  await page.mouse.move(enemy.x, enemy.y, { steps: 10 });
  await page.waitForTimeout(200);
  state = await battleState(page);
  expect(state.target).toEqual({ kind: 'enemy', id: points.enemyId });
  expect(state.lit).toBe(points.enemyId);
  await page.screenshot({ path: info.outputPath('drag-over-enemy.png') });
  await page.mouse.up();
  await settled(page);
  state = await battleState(page);
  expect(state.hand).toBe(before.hand - 1);
  expect(state.hp).toBeLessThan(before.hp);
  expect(state.counts).toMatchObject({ drags: 2, drops: 1, returns: 1 });

  // An untargeted card plays when released anywhere on the field above the hand.
  const next = (await handPoints(page)).cards.find((card: any) => card.id === cover.id)!;
  const from = await canvasPoint(page, next.x, next.y);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(open.x, open.y, { steps: 8 });
  await page.waitForTimeout(200);
  state = await battleState(page);
  expect(state.target).toEqual({ kind: 'field' });
  expect(state.zones).toEqual(['flock']);
  expect(state.lit).toBe('field');
  await page.mouse.up();
  await settled(page);
  state = await battleState(page);
  expect(state.hand).toBe(before.hand - 2);
  expect(state.counts).toMatchObject({ drags: 3, drops: 2, returns: 1 });
  expect(errors).toEqual([]);
});

test('an unaffordable card cannot be dragged: it shakes, says why and stays dimmed but readable', async ({ page }, info) => {
  const errors = await openBattle(page);
  await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.energy = 0; b.renderAll(); });
  const points = await handPoints(page);
  const attack = points.cards.find((card: any) => card.target === 'enemy')!;
  const press = await canvasPoint(page, attack.x, attack.y), enemy = await canvasPoint(page, points.enemy.x, points.enemy.y);
  // The refusal is the soft `locked` cue. Counting only it keeps unrelated timed cues out of the check.
  const cues = () => page.evaluate(() => ((window as any).__birdSquadAudio().cueRequests as Record<string, number>).locked ?? 0);
  const cuesBefore = await cues();
  await page.mouse.move(press.x, press.y);
  await page.mouse.down();
  const denied = await page.evaluate((id) => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const actor = b.battleActors.debugState().actors.find((entry: any) => entry.id === `card:${id}`);
    const notice = b.fxLayer.getByName('combat-action-rejection');
    const rect = b.handCardRects.get(id), parts = rect.getData('presentation');
    const title = parts.find((o: any) => o.name === 'combat-card-title'), rules = parts.find((o: any) => o.name === 'combat-card-readable-summary');
    const art = b.handCardArtLayers.get(id).getByName('combat-hand-illustration');
    return { motions: actor.motions, denials: b.cardObjects.counts.denials, source: notice?.getData('source'), summary: notice?.getData('summary'),
      title: title.style.color, rules: rules.style.color, rulesSize: parseFloat(rules.style.fontSize), artAlpha: art?.alpha, artTinted: art?.tintTopLeft !== 0xffffff,
      rulesText: rules.text, selected: b.selectedInstanceId };
  }, attack.id);
  await page.mouse.move(enemy.x, enemy.y, { steps: 8 });
  await page.screenshot({ path: info.outputPath('denied.png') });
  await page.mouse.up();
  const state = await battleState(page);
  expect(denied.motions).toContain('deny');
  expect(denied.denials).toBe(1);
  expect(denied.summary).toBe('Needs 1 more Wingbeat.');
  expect(await cues()).toBe(cuesBefore + 1); // one soft refusal cue
  // Dimmed, not hidden: muted ink and art, same rules text at a readable size.
  expect(denied.title).toBe('#aab5c1');
  expect(denied.rules).toBe('#a8b6bf');
  expect(denied.rulesSize).toBeGreaterThanOrEqual(15);
  expect(denied.rulesText.length).toBeGreaterThan(8);
  expect(denied.artAlpha).toBeLessThan(1);
  expect(denied.selected).toBeUndefined();
  expect(state.counts).toMatchObject({ drags: 0, drops: 0 });
  expect(state.hand).toBe(points.cards.length);
  expect(state.pending).toBe(false);
  expect(errors).toEqual([]);
});

test('rarity reads from the frame on hand, reward and pile faces; rare and above carry a sheen', async ({ page }, info) => {
  const errors = await openBattle(page);
  const hand = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const rarities = ['common', 'uncommon', 'rare', 'legendary', 'rare'];
    b.hand.forEach((card: any, index: number) => { card.runtime = { ...card.runtime, rarity: rarities[index] }; });
    b.handRenderKey = ''; b.renderAll();
    const faces = b.hand.map((card: any) => {
      const rect = b.handCardRects.get(card.instanceId), parts = rect.getData('presentation'), bounds = rect.getBounds();
      const frame = parts.find((o: any) => o.name === 'combat-card-rarity-frame'), sheen = parts.find((o: any) => o.name === 'combat-card-rarity-sheen');
      const inside = (o: any) => { const r = o.getBounds(); return r.left >= bounds.left - 0.5 && r.right <= bounds.right + 0.5 && r.top >= bounds.top - 0.5 && r.bottom <= bounds.bottom + 0.5; };
      return { rarity: frame?.getData('rarity'), texture: frame?.texture.key, frameInside: frame && inside(frame), sheen: Boolean(sheen), sheenInside: sheen ? inside(sheen) : true, sheenObject: sheen };
    });
    // Sample the sheen across more than one full cycle.
    const peaks = faces.map(() => 0), moved = faces.map(() => new Set<number>());
    for (let i = 0; i < 120; i += 1) {
      w.advanceTime(50);
      faces.forEach((face: any, index: number) => { if (!face.sheenObject) return; peaks[index] = Math.max(peaks[index], face.sheenObject.alpha); if (face.sheenObject.alpha > 0) moved[index].add(Math.round(face.sheenObject.tilePositionX)); });
    }
    return { faces: faces.map(({ sheenObject, ...face }: any) => face), peaks, moved: moved.map(set => set.size), tracked: b.cardObjects.debugState().sheens };
  });
  expect(hand.faces.map((face: any) => face.rarity)).toEqual(['common', 'uncommon', 'rare', 'legendary', 'rare']);
  expect(new Set(hand.faces.map((face: any) => face.texture)).size).toBe(4); // one drawn frame per rarity
  expect(hand.faces.map((face: any) => face.sheen)).toEqual([false, false, true, true, true]);
  expect(hand.faces.every((face: any) => face.frameInside && face.sheenInside)).toBe(true);
  expect(hand.tracked).toBe(3);
  for (const index of [2, 3, 4]) {
    expect(hand.peaks[index]).toBeGreaterThan(0.1);
    expect(hand.peaks[index]).toBeLessThan(0.5); // subtle
    expect(hand.moved[index]).toBeGreaterThan(3); // it sweeps
  }
  expect(hand.peaks[3]).toBeGreaterThan(hand.peaks[2]);
  await page.screenshot({ path: info.outputPath('hand-rarity.png') });

  // Pile inspection wears the same frame.
  const pile = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.drawPile[0].runtime = { ...b.drawPile[0].runtime, rarity: 'rare' };
    b.openOverlay('draw');
    return new Promise(resolve => {
      const poll = () => {
        const frame = b.root.list.find((o: any) => o.name === 'combat-pile-card-rarity-frame');
        if (!frame) { setTimeout(poll, 50); return; }
        resolve({ rarity: frame.getData('rarity'), expected: b.cardObjects && b.battleInspectCards('draw').find((entry: any) => entry.card.instanceId === (b.inspectedCardId ?? b.battleInspectCards('draw')[0].card.instanceId))?.card.runtime.rarity });
      };
      poll();
    });
  }) as { rarity: string; expected: string };
  expect(pile.rarity).toBe(pile.expected);
  await page.screenshot({ path: info.outputPath('pile-rarity.png') });
  await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.inspectOverlay = undefined; b.renderAll(); });

  // Reward choices wear it too.
  const reward = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    b.beginCardReward();
    return new Promise(resolve => {
      const started = Date.now();
      const poll = () => {
        const frames = b.root.list.filter((o: any) => o.name === 'reward-card-rarity-frame');
        if (!frames.length && Date.now() - started < 8000) { w.advanceTime(200); setTimeout(poll, 100); return; }
        resolve({ frames: frames.map((o: any) => o.getData('rarity')), expected: b.rewardChoices.map((card: any) => card.runtime.rarity), mode: b.mode });
      };
      poll();
    });
  }) as { frames: string[]; expected: string[]; mode: string };
  expect(reward.mode).toBe('cardReward');
  expect(reward.frames.length).toBeGreaterThan(0);
  expect(reward.frames).toEqual(reward.expected);
  await page.screenshot({ path: info.outputPath('reward-rarity.png') });
  expect(errors).toEqual([]);
});

test('Reduced Motion: no flight, no deal, no travel, no sheen, no drag pose; drag to play still works', async ({ page }) => {
  const errors = await openBattle(page, REDUCED);
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene'), stage = b.cardObjects;
    b.hand.forEach((card: any) => { card.runtime = { ...card.runtime, rarity: 'legendary' }; });
    b.handRenderKey = ''; b.renderAll();
    const sheens = b.handLayer.list.filter((o: any) => o.name === 'combat-card-rarity-sheen');
    let peak = 0;
    for (let i = 0; i < 100; i += 1) { w.advanceTime(50); peak = Math.max(peak, ...sheens.map((o: any) => o.alpha)); }
    b.discardCards(1); b.renderAll();
    const departing = stage.debugState().departing.length;
    b.drawCards(1); b.renderAll();
    const moving = b.battleActors.debugState().actors.some((actor: any) => actor.motions.length || Math.abs(actor.pose.x) + Math.abs(actor.pose.y) > 0.01);
    const card = b.hand[0];
    b.playCard(card, b.enemies[0].id, { resolveDelayMs: 300 });
    const ghost = b.fxLayer.getByName('combat-card-cast-ghost'), at = { x: ghost.x, y: ghost.y };
    w.advanceTime(150);
    const still = ghost.x === at.x && ghost.y === at.y && b.tweens.getTweensOf(ghost).length === 0;
    w.advanceTime(600);
    return { frames: sheens.length, peak, departing, moving, still, after: stage.debugState().departing.length, pending: b.combatAnimationPending,
      shown: [stage.shownPileCount('DRAW'), stage.shownPileCount('DISCARD')], real: [b.drawPile.length, b.discardPile.length] };
  });
  expect(result.frames).toBe(5);
  expect(result.peak).toBe(0);
  expect(result).toMatchObject({ departing: 0, moving: false, still: true, after: 0, pending: false });
  expect(result.shown).toEqual(result.real);
  // Drag to play needs no motion: the release still plays the card.
  const points = await handPoints(page);
  const attack = points.cards.find((card: any) => card.target === 'enemy')!;
  await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.energy = 3; b.renderAll(); });
  const from = await canvasPoint(page, attack.x, attack.y), enemy = await canvasPoint(page, points.enemy.x, points.enemy.y);
  const before = await battleState(page);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(enemy.x, enemy.y, { steps: 8 });
  const during = await battleState(page);
  expect(during.dragging).toBe(attack.id);
  expect(during.dragged).toBeUndefined(); // the card is not drawn away from its slot
  expect(during.lit).toBe(points.enemyId);
  await page.mouse.up();
  await settled(page);
  const after = await battleState(page);
  expect(after.counts, JSON.stringify(after)).toMatchObject({ drops: 1 });
  expect(after.hp).toBeLessThan(before.hp);
  expect(errors).toEqual([]);
});

test('changed numbers are tinted on the face without rewriting the rules', async ({ page }, info) => {
  const errors = await openBattle(page);
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const face = (card: any) => {
      const rect = b.handCardRects.get(card.instanceId), parts = rect.getData('presentation');
      const rules = parts.find((o: any) => o.name === 'combat-card-readable-summary'), bounds = rules.getBounds();
      const overlays = parts.filter((o: any) => o.name === 'combat-card-number-tint');
      return { text: rules.text, tints: rules.getData('numberTints'), rect: rect === b.handCardRects.get(card.instanceId) && rect,
        overlays: overlays.map((o: any) => ({ text: o.text, tone: o.getData('tone'), color: o.style.color, size: o.style.fontSize,
          inside: o.getBounds().left >= bounds.left - 1 && o.getBounds().right <= bounds.right + 1 && o.getBounds().top >= bounds.top - 1 && o.getBounds().bottom <= bounds.bottom + 1 })),
        size: rules.style.fontSize };
    };
    const attack = b.hand.find((card: any) => card.id === 'swords_ace'), cover = b.hand.find((card: any) => card.id === 'pentacles_fledgling');
    const plain = { attack: face(attack), cover: face(cover) };
    const rectBefore = plain.attack.rect;
    // Status: Winded lowers what the flock deals; Ruffled lowers Cover gained. No face is rebuilt.
    const builds = b.battleHandBuilds;
    b.flock.weak = 2; b.flock.frail = 2; b.renderAll();
    const reduced = { attack: face(attack), cover: face(cover), sameRect: face(attack).rect === rectBefore, rebuilt: b.battleHandBuilds - builds };
    // Surge raises both.
    b.flock.weak = 0; b.flock.frail = 0; b.flock.flow = b.flock.flowMax; b.renderAll();
    const buffed = { attack: face(attack), cover: face(cover) };
    b.flock.flow = 0; b.renderAll();
    const cleared = { attack: face(attack), cover: face(cover) };
    // Preen: the numbers the upgrade changed are gilt.
    const baseText = plain.attack.text;
    attack.upgraded = true; b.handRenderKey = ''; b.renderAll();
    const preened = face(attack);
    const strip = (entry: any) => { const { rect, ...rest } = entry; return rest; };
    return { plain: { attack: strip(plain.attack), cover: strip(plain.cover) }, reduced: { attack: strip(reduced.attack), cover: strip(reduced.cover), sameRect: reduced.sameRect, rebuilt: reduced.rebuilt },
      buffed: { attack: strip(buffed.attack), cover: strip(buffed.cover) }, cleared: { attack: strip(cleared.attack), cover: strip(cleared.cover) }, preened: strip(preened), baseText };
  });
  expect(result.plain.attack.tints).toEqual([]);
  expect(result.plain.attack.overlays).toEqual([]);
  expect(result.plain.cover.tints).toEqual([]);
  // Reduced red, on the damage and Cover numbers only; same text, same face object.
  expect(result.reduced.attack.text).toBe(result.plain.attack.text);
  expect(result.reduced.cover.text).toBe(result.plain.cover.text);
  expect(result.reduced.sameRect).toBe(true);
  expect(result.reduced.rebuilt).toBe(0);
  expect(result.reduced.attack.tints.filter((tint: any) => tint.tone === 'reduced').length).toBeGreaterThan(0);
  expect(result.reduced.attack.tints.every((tint: any) => tint.tone === 'reduced')).toBe(true);
  expect(result.reduced.cover.tints.some((tint: any) => tint.tone === 'reduced')).toBe(true);
  for (const overlay of [...result.reduced.attack.overlays, ...result.reduced.cover.overlays]) {
    expect(overlay).toMatchObject({ tone: 'reduced', color: '#ff9a86', inside: true });
    expect(overlay.text).toMatch(/^\d+$/);
  }
  expect(result.reduced.attack.overlays).toHaveLength(result.reduced.attack.tints.length);
  expect(result.reduced.attack.overlays[0].size).toBe(result.reduced.attack.size);
  // Buffed green.
  expect(result.buffed.attack.tints.length).toBeGreaterThan(0);
  expect(result.buffed.attack.overlays.every((overlay: any) => overlay.tone === 'buff' && overlay.color === '#86f7a8')).toBe(true);
  expect(result.buffed.cover.overlays.some((overlay: any) => overlay.tone === 'buff')).toBe(true);
  expect(result.cleared.attack.overlays).toEqual([]);
  expect(result.cleared.cover.overlays).toEqual([]);
  // Preened gilt: at least one number, and only numbers that differ from the base card.
  expect(result.preened.tints.length).toBeGreaterThan(0);
  expect(result.preened.tints.every((tint: any) => tint.tone === 'preen')).toBe(true);
  expect(result.preened.overlays.every((overlay: any) => overlay.color === '#ffd76a' && overlay.inside)).toBe(true);
  expect(result.preened.text).not.toBe(result.baseText);
  await page.screenshot({ path: info.outputPath('number-tints.png') });
  expect(errors).toEqual([]);
});

test('the card inspector shows the card large with rules, glosses, rarity and flavor, and zooms from and back to its slot', async ({ page }, info) => {
  const errors = await openBattle(page);
  const opened = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const card = b.hand[0];
    card.runtime = { ...card.runtime, rarity: 'rare' };
    b.handRenderKey = ''; b.renderAll(); w.advanceTime(400);
    const rect = b.handCardRects.get(card.instanceId), slot = { x: rect.x, y: rect.y };
    b.tweens.pauseAll();
    b.openCombatCardDetail(card);
    const layer = b.combatCardDetail, face = layer.getByName('combat-card-detail-face');
    const start = { x: face.x, y: face.y, scale: face.scaleX };
    b.tweens.resumeAll(); w.advanceTime(120);
    const mid = { x: face.x, y: face.y, scale: face.scaleX };
    w.advanceTime(400);
    const panel = layer.getByName('combat-card-detail-panel').getBounds(), bounds = face.getBounds();
    const body = layer.getByName('combat-card-detail-body').getBounds(), caption = layer.getByName('combat-card-detail-rarity');
    const names = face.list.map((o: any) => o.name);
    return { slot, start, mid, end: { x: face.x, y: face.y, scale: face.scaleX }, home: layer.getData('faceHome'),
      panel: [panel.left, panel.right, panel.top, panel.bottom], face: [bounds.left, bounds.right, bounds.top, bounds.bottom], bodyLeft: body.left,
      card: (() => { const r = face.list.find((o: any) => o.name === 'inspect-combat-card-rarity-frame').getBounds(); return [r.left, r.right, r.top, r.bottom]; })(),
      caption: caption.text, captionBottom: caption.getBounds().bottom, rarity: layer.getData('rarity'), names,
      faceTitle: face.list.find((o: any) => o.name === 'inspect-combat-card-title')?.text, faceRules: face.list.find((o: any) => o.name === 'inspect-combat-card-readable-summary')?.text,
      interactive: face.list.filter((o: any) => o.input?.enabled).length,
      pages: layer.getData('pages').map((entry: any) => entry.heading), title: layer.getByName('combat-card-detail-title').text, name: card.name,
      handTitles: b.handLayer.list.filter((o: any) => o.name === 'combat-card-title').length, selected: b.selectedInstanceId, handSize: b.hand.length };
  });
  // It grows out of the card's place in the hand ...
  expect(Math.hypot(opened.start.x - opened.slot.x, opened.start.y - opened.slot.y)).toBeLessThan(24);
  expect(opened.start.scale).toBeCloseTo(1, 1);
  expect(opened.mid.scale).toBeGreaterThan(opened.start.scale);
  expect(opened.mid.y).toBeLessThan(opened.start.y);
  // ... to one and a half times hand size, inside the reader and clear of the rules column.
  expect(opened.end.scale).toBeCloseTo(1.5, 2);
  // (`face` includes the card's soft halo; `card` is the card itself.)
  expect(opened.face[0]).toBeGreaterThanOrEqual(opened.panel[0]);
  expect(opened.face[2]).toBeGreaterThanOrEqual(opened.panel[2]);
  expect(opened.face[1]).toBeLessThan(opened.bodyLeft);
  expect(opened.card[1]).toBeLessThan(opened.bodyLeft - 24);
  expect(opened.captionBottom).toBeLessThan(opened.panel[3]);
  expect(opened.card[1] - opened.card[0]).toBeCloseTo(270, 0);
  expect(opened.card[3] - opened.card[2]).toBeCloseTo(405, 0);
  // The same face as the hand card, read-only.
  expect(opened.faceTitle).toBeTruthy();
  expect(opened.faceRules.length).toBeGreaterThan(8);
  expect(opened.names).toContain('inspect-combat-card-rarity-frame');
  expect(opened.interactive).toBe(0);
  expect(opened.handTitles).toBe(opened.handSize); // hand names are not duplicated in the hand layer
  // Rules, glosses, rarity.
  expect(opened.rarity).toBe('rare');
  expect(opened.caption).toMatch(/^Rare · /);
  expect(opened.pages[0]).toMatch(/^ACTIVE/);
  expect(opened.pages.some((heading: string) => /PASSIVE FLOCK CONTRIBUTION/.test(heading))).toBe(true);
  expect(opened.pages.length).toBeGreaterThan(3); // keyword glosses follow the rules
  expect(opened.selected).toBeUndefined();
  // Flavor arrives with the lore chunk.
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.getData('flavor'));
  const flavor = await page.evaluate(() => {
    const layer = (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail, text = layer.getByName('combat-card-detail-flavor');
    const panel = layer.getByName('combat-card-detail-panel').getBounds(), bounds = text.getBounds();
    return { text: text.text, inside: bounds.bottom < panel.bottom && bounds.left > panel.left, lines: text.getWrappedText().length };
  });
  expect(flavor.text.length).toBeGreaterThan(10);
  expect(flavor.inside).toBe(true);
  expect(flavor.lines).toBeLessThanOrEqual(3);
  await page.screenshot({ path: info.outputPath('inspect-open.png') });
  // Closing is immediate for the game; the card flies home and is gone.
  const closed = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    b.closeCombatCardDetail();
    const back = b.cardObjects.layer.getByName('combat-card-detail-return');
    const start = back && { x: back.x, y: back.y, scale: back.scaleX };
    w.advanceTime(90);
    const mid = back && { x: back.x, y: back.y, scale: back.scaleX };
    w.advanceTime(300);
    return { open: Boolean(b.combatCardDetail), start, mid, gone: !back?.active, left: Boolean(b.cardObjects.layer.getByName('combat-card-detail-return')), locked: b.combatInteractionLocked() };
  });
  expect(closed.open).toBe(false);
  expect(closed.start.scale).toBeCloseTo(1.5, 1);
  expect(closed.mid.scale).toBeLessThan(closed.start.scale);
  expect(closed.mid.y).toBeGreaterThan(closed.start.y);
  expect(closed).toMatchObject({ gone: true, left: false, locked: false });
  expect(errors).toEqual([]);
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('a touch drag plays a card the same way and a tap only selects', async ({ page }) => {
    const errors = await openBattle(page);
    const points = await handPoints(page);
    const attack = points.cards.find((card: any) => card.target === 'enemy')!;
    const from = await canvasPoint(page, attack.x, attack.y), enemy = await canvasPoint(page, points.enemy.x, points.enemy.y);
    const before = await battleState(page);
    const client = await page.context().newCDPSession(page);
    const touch = (type: string, point?: { x: number; y: number }) => client.send('Input.dispatchTouchEvent', {
      type: type as any, touchPoints: point ? [{ x: Math.round(point.x), y: Math.round(point.y), id: 1 }] : [],
    });
    // Tap: select only.
    await touch('touchStart', from); await touch('touchEnd');
    let state = await battleState(page);
    expect(state).toMatchObject({ hand: before.hand, selected: attack.id, pending: false });
    await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.selectedInstanceId = undefined; b.renderAll(); });
    // Drag onto the enemy.
    await touch('touchStart', from);
    for (let i = 1; i <= 8; i += 1) await touch('touchMove', { x: from.x + (enemy.x - from.x) * i / 8, y: from.y + (enemy.y - from.y) * i / 8 });
    state = await battleState(page);
    expect(state.dragging).toBe(attack.id);
    expect(state.lit).toBe(points.enemyId);
    await touch('touchEnd');
    await settled(page);
    state = await battleState(page);
    expect(state.hand).toBe(before.hand - 1);
    expect(state.hp).toBeLessThan(before.hp);
    expect(state.counts).toMatchObject({ drags: 1, drops: 1, returns: 0 });
    expect(errors).toEqual([]);
  });
});
