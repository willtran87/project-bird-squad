import { test, expect, type Page } from '@playwright/test';

// Retained battle actors: enemy bodies, the flock body and hand cards outlive
// the immediate-mode redraw. Each has a LOGICAL slot (layout, bounds, hit area)
// and a VISUAL pose the actor stage layers on top. These checks pin both halves:
// animation may move what is drawn, never what layout, input or tests read.

test.afterEach(async ({ page }) => {
  // Release the live WebGL scene before the Windows WebKit context closes.
  await page.goto('about:blank');
});

async function openBattle(page: Page, storage: Record<string, string> = {}) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(values => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value as string);
  }, storage);
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const s = JSON.parse((window as any).render_game_to_text?.() ?? '{}');
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return s.scene === 'BattleScene' && s.assetReadiness?.fullArt && !s.combatIntro?.active && !s.combatAnimationPending
      && b.battleActors && b.battleHandRendererModule && b.handCardRects.size === b.hand.length && !b.battleRenderQueued;
  });
  // The opening hand is now dealt in from the draw pile once the intro clears
  // (card-objects.spec.ts); let it land so every check here starts from rest.
  await page.evaluate(() => (window as any).advanceTime(900));
  return errors;
}

test('combatant bodies and hand cards are created once and survive redraws', async ({ page }) => {
  const errors = await openBattle(page);
  const result = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.energy = 9; b.renderAll();
    const named = (name: string) => b.root.list.filter((o: any) => o.name === name);
    const bodies = () => [...named('combat-enemy-art'), ...named('combat-leader-art')];
    const portraits = () => bodies().map((body: any) => body.list[0].list[0]);
    const cards = () => b.hand.flatMap((card: any) => b.handCardRects.get(card.instanceId).getData('presentation'));
    const before = { bodies: bodies(), portraits: portraits(), cards: cards(), vitals: named('combat-enemy-vitals') };
    // Full redraws, a forced hand pass and a state change that leaves every face as it was.
    b.renderAll(); b.handRenderKey = ''; b.renderHand(); b.energy = 8; b.renderAll();
    const after = { bodies: bodies(), portraits: portraits(), cards: cards(), vitals: named('combat-enemy-vitals') };
    const same = (a: any[], z: any[]) => a.length > 0 && a.length === z.length && a.every((o, i) => o === z[i] && o.active);
    const kept = { bodies: same(before.bodies, after.bodies), portraits: same(before.portraits, after.portraits),
      cards: same(before.cards, after.cards),
      // HUD panels stay immediate-mode: every pass rebuilds them.
      vitalsRebuilt: before.vitals.every((o: any) => !o.active) && after.vitals.every((o: any) => o.active) };
    const enemy = b.enemies.find((e: any) => e.hp > 0);
    // A combatant that leaves play takes its body with it.
    const doomed = named('combat-enemy-art').find((o: any) => o.getData('enemyId') === enemy.id);
    const hp = enemy.hp; enemy.hp = 0; b.renderAll();
    const retired = !doomed.active && !b.battleActors.actors.has(`enemy:${enemy.id}`);
    enemy.hp = hp; b.renderAll();
    return {
      ...kept,
      order: b.hand.map((card: any) => b.handLayer.list.indexOf(b.handCardRects.get(card.instanceId)))
        .every((index: number, i: number, all: number[]) => index >= 0 && (i === 0 || index > all[i - 1])),
      actors: b.battleActors.debugState().actors.map((actor: any) => actor.kind).sort().join(','),
      retired,
    };
  });
  expect(result).toMatchObject({ bodies: true, portraits: true, cards: true, vitalsRebuilt: true, order: true, retired: true });
  expect(result.actors).toBe('card,card,card,card,card,enemy,flock');
  expect(errors).toEqual([]);
});

test('hover lifts the drawn card and parts its neighbours without moving bounds or hit areas', async ({ page }) => {
  const errors = await openBattle(page);
  const read = () => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const box = b.game.canvas.getBoundingClientRect(), scale = box.width / 1280;
    const stage = b.battleActors.debugState();
    return b.hand.map((card: any) => {
      const rect = b.handCardRects.get(card.instanceId), r = rect.getBounds();
      const actor = stage.actors.find((entry: any) => entry.id === `card:${card.instanceId}`);
      return { id: card.instanceId, pose: actor.pose, slot: actor.slot,
        bounds: [r.x, r.y, r.width, r.height],
        parts: rect.getData('presentation').map((o: any) => { const p = o.getBounds(); return [p.x, p.y, p.width, p.height]; }),
        x: box.left + rect.x * scale, y: box.top + rect.y * scale };
    });
  });
  await page.mouse.move(4, 4);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').battleActors.debugState()
    .actors.filter((a: any) => a.kind === 'card').every((a: any) => Math.abs(a.pose.scaleX - 1) < 0.001 && a.pose.y >= 0));
  const rest = await read();
  // At rest the hand fans: outer cards tilt away from the centre and sit lower.
  expect(rest[0].pose.angle).toBeLessThan(0);
  expect(rest[4].pose.angle).toBeGreaterThan(0);
  expect(rest[0].pose.y).toBeGreaterThan(rest[2].pose.y);
  await page.mouse.move(rest[2].x, rest[2].y);
  await page.waitForFunction(id => {
    const actor = (window as any).__birdSquadGame.scene.getScene('BattleScene').battleActors.debugState()
      .actors.find((a: any) => a.id === `card:${id}`);
    return actor.pose.y < -12 && actor.pose.scaleX > 1.03;
  }, rest[2].id);
  const hovered = await read();
  expect(Math.abs(hovered[2].pose.angle)).toBeLessThan(0.1);
  expect(hovered[1].pose.x).toBeLessThan(-4);
  expect(hovered[3].pose.x).toBeGreaterThan(4);
  // Logical geometry is untouched: the card's bounds, every part of its face and its slot.
  for (let i = 0; i < rest.length; i++) {
    expect(hovered[i].bounds).toEqual(rest[i].bounds);
    expect(hovered[i].parts).toEqual(rest[i].parts);
    expect(hovered[i].slot).toEqual(rest[i].slot);
  }
  // The hit area is the slot: the bottom edge still belongs to the lifted card.
  const hit = await page.evaluate(id => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const rect = b.handCardRects.get(id), bounds = rect.getBounds();
    return [bounds.top + 2, bounds.bottom - 2].map(y => b.input.manager.hitTest({ x: bounds.centerX, y }, [rect], b.cameras.main).includes(rect));
  }, rest[2].id);
  expect(hit).toEqual([true, true]);
  await page.mouse.move(4, 4);
  await page.waitForFunction(id => (window as any).__birdSquadGame.scene.getScene('BattleScene').battleActors.debugState()
    .actors.find((a: any) => a.id === `card:${id}`).pose.scaleX < 1.001, rest[2].id);
  expect(errors).toEqual([]);
});

test('cards slide to their new slots when the hand changes', async ({ page }) => {
  const errors = await openBattle(page);
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const pose = (id: string) => b.battleActors.debugState().actors.find((a: any) => a.id === `card:${id}`).pose;
    const kept = b.hand[1], rect = b.handCardRects.get(kept.instanceId), parts = rect.getData('presentation');
    const from = rect.x;
    b.discardPile.push(b.hand.shift()); b.renderAll();
    const to = b.handCardRects.get(kept.instanceId).x, start = pose(kept.instanceId).x;
    w.advanceTime(60);
    const midway = pose(kept.instanceId).x;
    w.advanceTime(900);
    return { from, to, start, midway, settled: pose(kept.instanceId).x,
      retained: b.handCardRects.get(kept.instanceId) === rect && parts.every((o: any) => o.active),
      cards: b.battleActors.debugState().actors.filter((a: any) => a.kind === 'card').length };
  });
  // The logical slot moves at once; the drawn card starts where it was and eases over.
  expect(result.to).not.toBe(result.from);
  expect(result.start).toBeCloseTo(result.from - result.to, 0);
  expect(Math.abs(result.midway)).toBeLessThan(Math.abs(result.start));
  expect(Math.abs(result.midway)).toBeGreaterThan(1);
  expect(Math.abs(result.settled)).toBeLessThan(0.5);
  expect(result.retained).toBe(true);
  expect(result.cards).toBe(4);
  expect(errors).toEqual([]);
});

test('enemies lunge, recoil and stagger by share of maximum Cohesion', async ({ page }) => {
  const errors = await openBattle(page);
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const enemy = b.enemies.find((e: any) => e.hp > 0), key = `enemy:${enemy.id}`;
    const actor = () => b.battleActors.debugState().actors.find((a: any) => a.id === key);
    const body = b.root.list.find((o: any) => o.name === 'combat-enemy-art' && o.getData('enemyId') === enemy.id);
    const hit = b.root.list.find((o: any) => o.name === 'combat-enemy-hit' && o.getData('enemyId') === enemy.id);
    const hitBounds = JSON.stringify(hit.getBounds());
    const settle = () => w.advanceTime(1500);
    const maxHp = enemy.maxHp;
    // The same 8 damage is heavy for a small enemy and ordinary for a large one.
    enemy.maxHp = 100; b.events.emit('living-enemy-cue', enemy.id, 'hit', 8);
    const light = actor().motions; w.advanceTime(90); const lightX = actor().pose.x; settle();
    enemy.maxHp = 30; b.events.emit('living-enemy-cue', enemy.id, 'hit', 8);
    const heavy = actor().motions; w.advanceTime(160); const heavyPose = actor().pose; settle();
    enemy.maxHp = maxHp;
    b.combatEnemyTurnBeatDurationMs = 200;
    b.events.emit('living-enemy-cue', enemy.id, 'attack', 80);
    w.advanceTime(230);
    const lunge = actor(), drawnX = body.x;
    settle();
    return { light, lightX, heavy, heavyPose, lunge: lunge.pose, lungeMotion: lunge.motions, drawnX, slotX: lunge.slot.x,
      flockX: b.battleActors.actors.get('flock').slot.x, rest: actor().motions,
      hitStill: JSON.stringify(hit.getBounds()) === hitBounds && hit.input.enabled, portraitInput: Boolean(body.list[0].list[0].input) };
  });
  expect(result.light).toEqual(['recoil']);
  expect(result.heavy).toEqual(['stagger']);
  // Both are knocked away from the flock; the stagger goes further and tips over.
  expect(result.lightX).toBeGreaterThan(0);
  expect(result.heavyPose.x).toBeGreaterThan(result.lightX + 10);
  expect(Math.abs(result.heavyPose.angle)).toBeGreaterThan(5);
  // The lunge travels toward the flock, and the drawn body follows the pose.
  expect(result.flockX).toBeLessThan(result.slotX);
  expect(result.lungeMotion).toEqual(['lunge']);
  expect(result.lunge.x).toBeLessThan(-40);
  expect(result.drawnX).toBeCloseTo(result.slotX + result.lunge.x, 3);
  expect(result.rest).toEqual([]);
  // Input belongs to the slot: it never moved, and the animated portrait takes no input.
  expect(result.hitStill).toBe(true);
  expect(result.portraitInput).toBe(false);
  expect(errors).toEqual([]);
});

test('contact freezes the actor clock for two to four frames while game time runs on', async ({ page }) => {
  const errors = await openBattle(page);
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const enemy = b.enemies.find((e: any) => e.hp > 0), stage = b.battleActors, frame = 1000 / 60;
    const frames: number[] = [];
    for (const share of [0.02, 0.1, 0.5]) {
      w.advanceTime(1200);
      b.events.emit('living-enemy-cue', enemy.id, 'hit', Math.max(1, Math.round(enemy.maxHp * share)));
      frames.push(stage.debugState().lastHitStopFrames);
    }
    w.advanceTime(1200);
    let fired = 0;
    b.time.delayedCall(20, () => { fired += 1; });
    const before = stage.debugState(), now = b.time.now;
    b.events.emit('living-enemy-cue', enemy.id, 'hit', Math.round(enemy.maxHp * 0.5));
    const struck = stage.debugState();
    w.advanceTime(frame * 3);
    const held = stage.debugState();
    w.advanceTime(frame * 7);
    const released = stage.debugState();
    return { frames, stops: struck.hitStops - before.hitStops, frozen: [before.frozen, struck.frozen, held.frozen, released.frozen],
      heldFor: held.time - struck.time, gameAdvanced: b.time.now - now, fired,
      resumed: released.time - struck.time, expected: frame * 6 };
  });
  expect(result.frames).toEqual([2, 3, 4]);
  expect(result.stops).toBe(1);
  expect(result.frozen).toEqual([false, true, true, false]);
  expect(result.heldFor).toBe(0);
  // Game logic is not part of the freeze: scene time and its timers kept running.
  expect(result.gameAdvanced).toBeCloseTo(1000 / 60 * 10, 0);
  expect(result.fired).toBe(1);
  expect(result.resumed).toBeCloseTo(result.expected, 0);
  expect(errors).toEqual([]);
});

test('the flock dives toward its target on an attack card and braces on Cover', async ({ page }) => {
  const errors = await openBattle(page);
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const enemy = b.enemies.find((e: any) => e.hp > 0);
    const flock = () => b.battleActors.debugState().actors.find((a: any) => a.id === 'flock');
    const body = b.root.getByName('combat-leader-art'), hit = b.root.getByName('combat-leader-hit');
    const hitBounds = JSON.stringify(hit.getBounds());
    b.events.emit('living-cast', 400, 'swoop', enemy.id);
    w.advanceTime(300);
    const dive = flock(), drawn = { x: body.x, y: body.y };
    w.advanceTime(1500);
    b.events.emit('living-cast', 400, 'shelter', enemy.id);
    b.events.emit('living-flock-cue', 'brace');
    w.advanceTime(120);
    const brace = flock();
    w.advanceTime(1500);
    return { dive: dive.pose, diveMotion: dive.motions, drawn, slot: dive.slot, target: b.enemyView(enemy),
      brace: brace.pose, braceMotion: brace.motions, rest: flock().motions,
      hitStill: JSON.stringify(hit.getBounds()) === hitBounds && hit.parentContainer === b.root };
  });
  expect(result.diveMotion).toEqual(['dive']);
  expect(result.target.x).toBeGreaterThan(result.slot.x);
  expect(result.dive.x).toBeGreaterThan(20);
  expect(result.dive.y).toBeGreaterThanOrEqual(-5);
  expect(result.drawn.x).toBeCloseTo(result.slot.x + result.dive.x, 3);
  // Bracing is a crouch: lower, wider, leaning back.
  expect(result.braceMotion).toEqual(['brace']);
  expect(result.brace.y).toBeGreaterThan(3);
  expect(result.brace.scaleY).toBeLessThan(1);
  expect(result.brace.x).toBeLessThan(0);
  expect(result.rest).toEqual([]);
  expect(result.hitStill).toBe(true);
  expect(errors).toEqual([]);
});

test('Reduced Motion keeps every actor on its slot', async ({ page }) => {
  const errors = await openBattle(page, { 'birdsquad.motionPreference': 'reduced' });
  const first = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const rect = b.handCardRects.get(b.hand[2].instanceId), box = b.game.canvas.getBoundingClientRect(), scale = box.width / 1280;
    return { x: box.left + rect.x * scale, y: box.top + rect.y * scale };
  });
  await page.mouse.move(first.x, first.y);
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const enemy = b.enemies.find((e: any) => e.hp > 0);
    const moved = () => b.battleActors.debugState().actors
      .some((a: any) => a.pose.x || a.pose.y || a.pose.angle || a.pose.scaleX !== 1 || a.pose.scaleY !== 1 || a.pose.flash || a.motions.length);
    const samples: boolean[] = [];
    b.events.emit('living-enemy-cue', enemy.id, 'hit', enemy.maxHp);
    b.events.emit('living-enemy-cue', enemy.id, 'attack', 80);
    b.events.emit('living-cast', 400, 'swoop', enemy.id);
    b.events.emit('living-flock-cue', 'brace');
    b.discardPile.push(b.hand.shift()); b.renderAll();
    for (let i = 0; i < 12; i++) { w.advanceTime(50); samples.push(moved()); }
    const stage = b.battleActors.debugState();
    return { samples, reduced: stage.reducedMotion, hitStops: stage.hitStops, frozen: stage.frozen };
  });
  expect(result.samples.every(sample => sample === false)).toBe(true);
  expect(result).toMatchObject({ reduced: true, hitStops: 0, frozen: false });
  expect(errors).toEqual([]);
});

for (const [pace, scale] of [['relaxed', 0.8], ['fast', 1.3]] as const) {
  test(`Animation Pace ${pace} scales the actor clock`, async ({ page }) => {
    const errors = await openBattle(page, { 'birdsquad.animationPace': pace });
    const elapsed = await page.evaluate(() => {
      const w = window as any, stage = w.__birdSquadGame.scene.getScene('BattleScene').battleActors;
      const start = stage.debugState().time;
      w.advanceTime(1000);
      return stage.debugState().time - start;
    });
    expect(elapsed).toBeCloseTo(1000 * scale, 0);
    expect(errors).toEqual([]);
  });
}

test('Screen Shake and Flash Effects gate the stagger judder and hit flash', async ({ page }) => {
  const errors = await openBattle(page, { 'birdsquad.screenShake': 'off', 'birdsquad.flashEffects': 'reduced' });
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const enemy = b.enemies.find((e: any) => e.hp > 0), key = `enemy:${enemy.id}`;
    b.events.emit('living-enemy-cue', enemy.id, 'hit', enemy.maxHp);
    const running = b.battleActors.actors.get(key).motions[0].motion;
    const flash = b.battleActors.debugState().actors.find((a: any) => a.id === key).pose.flash;
    return { name: running.name, shake: running.shake, flash,
      preferences: [JSON.parse(w.render_game_to_text()).screenShake?.enabled, JSON.parse(w.render_game_to_text()).flashEffects?.reduced] };
  });
  expect(result).toMatchObject({ name: 'stagger', shake: 0, flash: 0 });
  expect(errors).toEqual([]);
});
