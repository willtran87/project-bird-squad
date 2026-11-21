import { test, expect, type Page } from '@playwright/test';
import { overlapping, sceneTexts } from './helpers/engagement';

// Combat life: status and intent badges, body status effects, ghost health,
// counter rolls, the combo chain, Leader flourishes, Waymark lines and set
// pieces. All of it is presentation layered over immediate game state.

test.afterEach(async ({ page }) => {
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
      && b.battleActors && b.combatLife && b.handCardRects.size === b.hand.length && !b.battleRenderQueued;
  });
  await page.evaluate(() => (window as any).advanceTime(900));
  return errors;
}

const shot = (page: Page, name: string, info: { outputPath: (name: string) => string }) =>
  page.screenshot({ path: info.outputPath(`${name}.png`) });

test('status and intent badges are retained, sit beside the text they repeat and leave that text intact', async ({ page }, info) => {
  const errors = await openBattle(page);
  for (const size of [{ width: 1280, height: 720 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size);
    const result = await page.evaluate(() => {
      const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
      const enemy = b.enemies.find((e: any) => e.hp > 0);
      b.flock.block = 6; b.flock.weak = 2; b.flock.frail = 1; b.spark = 2; enemy.block = 5; enemy.weak = 2;
      b.renderAll(); w.advanceTime(600);
      const textBefore = JSON.parse(w.render_game_to_text());
      const node = () => b.root.list.find((o: any) => o.name === 'combat-life-enemy' && o.getData('enemyId') === enemy.id);
      const first = node(), firstFlock = b.root.getByName('combat-life-flock');
      b.renderAll(); b.renderAll();
      const named = (name: string) => b.root.list.find((o: any) => o.name === name && o.getData('enemyId') === enemy.id);
      const icon = node().getByName('combat-life-intent-icon'), label = named('combat-enemy-intent-value').getBounds();
      const badge = named('combat-enemy-intent-badge').getBounds(), status = named('combat-enemy-status');
      const statusIcons = node().list.filter((o: any) => o.name === 'combat-life-status-icon');
      const panel = named('combat-enemy-status-panel').getBounds();
      const flockIcons = b.root.getByName('combat-life-flock').list.filter((o: any) => o.name === 'combat-flock-status-badge');
      const iconBox = (g: any) => ({ left: g.x - 12, right: g.x + 12, top: g.y - 12, bottom: g.y + 12 });
      const life = b.combatLife.debugState();
      return {
        retained: first === node() && firstFlock === b.root.getByName('combat-life-flock') && first.active,
        aboveLabels: b.root.list.indexOf(node()) > b.root.list.indexOf(named('combat-enemy-intent-value')),
        intent: icon.getData('icon'), intentVisible: icon.visible,
        intentClear: iconBox(icon).right <= label.left + 1 && iconBox(icon).left >= badge.left,
        statusIcons: statusIcons.map((g: any) => [g.getData('icon'), g.visible]),
        statusClear: statusIcons.every((g: any) => !g.visible || (g.x + 9 <= status.getBounds().left + 1 && g.x - 9 >= panel.left)),
        statusText: status.getData('fullText') ?? status.text,
        flockIcons: flockIcons.map((g: any) => g.getData('icon')),
        flockLabels: life.flockBadges,
        textStatuses: textBefore.flock?.statuses ?? textBefore.flockStatuses,
        textAfter: JSON.parse(w.render_game_to_text()).flock?.statuses ?? JSON.parse(w.render_game_to_text()).flockStatuses,
        noInput: [node(), b.root.getByName('combat-life-flock')].every((n: any) => n.list.every((o: any) => !o.input)),
      };
    });
    expect(result).toMatchObject({ retained: true, aboveLabels: true, intent: 'attack', intentVisible: true, intentClear: true,
      statusClear: true, noInput: true });
    expect(result.statusIcons.map(([icon]: [string]) => icon)).toEqual(['cover', 'winded']);
    expect(result.statusText).toBe('5 Cover / 2 Winded');
    expect(result.flockIcons.slice(0, 3)).toEqual(['cover', 'winded', 'ruffled']);
    expect(result.flockLabels).toContain('Resonance 2');
    expect(result.textAfter).toEqual(result.textStatuses);
    await page.evaluate(() => (window as any).advanceTime(800));
    // Card number highlights sit on their own rules text by design (card-objects.spec.ts).
    expect(overlapping((await sceneTexts(page, 'BattleScene')).filter(t => t.name !== 'combat-card-number-tint'))).toEqual([]);
    await shot(page, `badges-${size.width}`, info);
  }
  expect(errors).toEqual([]);
});

test('Cohesion and enemy bars drain with a ghost that catches up while the real meter stays exact', async ({ page }, info) => {
  const errors = await openBattle(page);
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const enemy = b.enemies.find((e: any) => e.hp > 0);
    enemy.hp = Math.round(enemy.maxHp * 0.5); b.flock.hp = Math.round(b.flock.maxHp * 0.6);
    b.renderAll(); w.advanceTime(60);
    const fill = b.root.list.find((o: any) => o.name === 'combat-enemy-health-fill' && o.getData('enemyId') === enemy.id).getBounds();
    const track = b.root.list.find((o: any) => o.name === 'combat-enemy-health-track' && o.getData('enemyId') === enemy.id).getBounds();
    const early = b.combatLife.debugState();
    const ghostRect = b.root.list.find((o: any) => o.name === 'combat-life-enemy' && o.getData('enemyId') === enemy.id).getByName('combat-life-health-ghost');
    const cohesionGhost = b.root.getByName('combat-life-cohesion-ghost');
    const drawn = { ghost: ghostRect.visible && ghostRect.width > 4, cohesion: Boolean(cohesionGhost?.visible) };
    w.advanceTime(320);
    const held = b.combatLife.debugState();
    w.advanceTime(1600);
    const settled = b.combatLife.debugState();
    return { exact: Math.abs(fill.width - Math.max(2, track.width * enemy.hp / enemy.maxHp)) < 0.1, drawn,
      early: early.enemies[0].bar, held: held.enemies[0].bar, settled: settled.enemies[0].bar,
      cohesionEarly: early.cohesion, cohesionSettled: settled.cohesion, share: enemy.hp / enemy.maxHp };
  });
  expect(result.exact).toBe(true);
  expect(result.drawn).toEqual({ ghost: true, cohesion: true });
  expect(result.early.ghost).toBe(1);
  expect(result.held.shown).toBeCloseTo(result.share, 2);
  expect(result.held.ghost).toBe(1);
  expect(result.settled.ghost).toBeCloseTo(result.share, 2);
  expect(result.cohesionEarly.ghost).toBe(1);
  expect(result.cohesionSettled.ghost).toBeCloseTo(0.6, 1);
  await shot(page, 'ghost-trail', info);
  expect(errors).toEqual([]);
});

test('counters roll to their new value with count.tick while their real text stays exact', async ({ page }, info) => {
  const errors = await openBattle(page);
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const requests = () => w.__birdSquadAudio?.().events.requests['count.tick'] ?? 0;
    const before = requests();
    b.flock.block += 4; b.scrap += 3; b.renderAll(); w.advanceTime(90);
    const label = b.root.getByName('hud-value-Cover');
    const overlay = b.combatLife.top.list.find((o: any) => o.name === 'combat-count-roll' && o.getData('for') === 'hud-value-Cover');
    const mid = { real: label.text, hidden: label.alpha === 0, shown: overlay?.text, rolls: b.combatLife.debugState().rolls };
    w.advanceTime(600);
    return { mid, end: { real: b.root.getByName('hud-value-Cover').text, alpha: b.root.getByName('hud-value-Cover').alpha,
      overlays: b.combatLife.top.list.filter((o: any) => o.name === 'combat-count-roll').length, rolls: b.combatLife.debugState().rolls },
      cover: b.flock.block, ticks: requests() - before };
  });
  expect(result.mid.real).toBe(`${result.cover}`);
  expect(result.mid.hidden).toBe(true);
  expect(Number(result.mid.shown)).toBeLessThan(result.cover);
  expect(result.mid.rolls).toEqual(expect.arrayContaining(['hud-value-Cover', 'hud-value-Scrap']));
  expect(result.end).toEqual({ real: `${result.cover}`, alpha: 1, overlays: 0, rolls: [] });
  expect(result.ticks).toBeGreaterThanOrEqual(4);
  await shot(page, 'counter-roll', info);
  expect(errors).toEqual([]);
});

test('the combo chain grows with cards played and resets on Roost; turn.start is heard', async ({ page }, info) => {
  const errors = await openBattle(page);
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const chip = () => b.combatLife.top.getByName('combat-combo-counter');
    const samples: any[] = [];
    for (const count of [1, 2, 4]) {
      b.cardsPlayedThisTurn = count; w.advanceTime(400);
      samples.push(chip() ? { count: chip().getData('count'), scale: chip().scaleX, text: chip().getByName('combat-combo-value').text } : null);
    }
    const bounds = chip().getBounds();
    const clear = [...b.handCardRects.values()].every((r: any) => { const c = r.getBounds(); return bounds.right <= c.left || bounds.bottom <= c.top; });
    const turnBefore = w.__birdSquadAudio?.().events.requests['turn.start'] ?? 0;
    b.cardsPlayedThisTurn = 0; b.turn += 1; w.advanceTime(100);
    return { samples, clear, reset: !chip(), turnStart: (w.__birdSquadAudio?.().events.requests['turn.start'] ?? 0) - turnBefore };
  });
  expect(result.samples[0]).toBeNull();
  expect(result.samples[1]).toMatchObject({ count: 2, text: '×2' });
  expect(result.samples[2]).toMatchObject({ count: 4, text: '×4' });
  expect(result.samples[2].scale).toBeGreaterThan(result.samples[1].scale);
  expect(result.clear).toBe(true);
  expect(result.reset).toBe(true);
  expect(result.turnStart).toBe(1);
  await shot(page, 'combo', info);
  expect(errors).toEqual([]);
});

test('Surge, Molt and Cover play layered set pieces and Leader flourishes without changing game state', async ({ page }, info) => {
  const errors = await openBattle(page);
  for (const size of [{ width: 1280, height: 720 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size);
    const result = await page.evaluate(() => {
      const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
      b.flock.flow = 0; b.flock.molt = false; b.renderAll(); w.advanceTime(2000);
      const seen0 = { ...b.combatLife.debugState().seen };
      const state = () => JSON.stringify([b.energy, b.hand.map((c: any) => c.instanceId), b.flock.hp, b.mode, b.turn, b.enemies.map((e: any) => e.hp)]);
      const before = state();
      b.flock.flow = b.flock.flowMax; b.flock.block += 3; b.renderAll(); w.advanceTime(250);
      const surge = { pieces: b.combatLife.debugState().pieces, title: b.combatLife.top.getByName('combat-life-title-surge')?.text,
        flock: b.battleActors.debugState().actors.find((a: any) => a.id === 'flock').motions };
      w.advanceTime(1400);
      const done = b.combatLife.debugState().pieces.filter((p: string) => !p.endsWith('-feather'));
      b.enterMolt('Test'); b.renderAll(); w.advanceTime(200);
      const molt = b.combatLife.debugState().pieces;
      w.advanceTime(1400);
      const seen = b.combatLife.debugState().seen;
      const delta = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, (v as number) - (seen0[k] ?? 0)]));
      return { surge, done, molt, delta, sameState: state() === before,
        leader: b.runLeaderId, shield: b.root.getByName('combat-life-flock')?.getByName('combat-life-cover-shield')?.visible };
    });
    expect(result.surge.title).toBe('SURGE');
    expect(result.surge.pieces).toEqual(expect.arrayContaining(['surge', 'surge-title', 'cover-form']));
    expect(result.surge.pieces.some((p: string) => p.startsWith('flourish-'))).toBe(true);
    expect(result.surge.flock).toContain('surge-rise');
    // Every set piece is over within 1.5 s.
    expect(result.done).toEqual([]);
    expect(result.molt).toContain('molt-burst');
    expect(result.delta).toMatchObject({ surge: 1, 'cover-form': 1, 'molt-burst': 1 });
    expect(result.sameState).toBe(true);
    expect(result.shield).toBe(true);
    await shot(page, `set-pieces-${size.width}`, info);
  }
  expect(errors).toEqual([]);
});

test('a boss is introduced once with a name card and camera push that any input skips; phase change and finishing blow land', async ({ page }, info) => {
  const errors = await openBattle(page);
  const entrance = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const enemy = b.enemies.find((e: any) => e.hp > 0);
    enemy.runtime = { ...enemy.runtime, type: 'boss', phaseTwoName: 'Final pattern' };
    b.renderAll(); w.advanceTime(500);
    const s = b.combatLife.debugState();
    return { pieces: s.pieces, zoom: s.zoom, card: b.combatLife.top.getByName('combat-boss-name-card-title')?.text, name: enemy.name };
  });
  expect(entrance.pieces).toContain('boss-entrance');
  expect(entrance.zoom).toBeGreaterThan(1);
  expect(entrance.card).toBe(entrance.name.toUpperCase());
  await shot(page, 'boss-entrance', info);
  await page.keyboard.press('Shift');
  const skipped = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    w.advanceTime(20);
    const s = b.combatLife.debugState();
    b.renderAll(); w.advanceTime(2000);
    return { pieces: s.pieces, zoom: s.zoom, again: b.combatLife.debugState().seen['boss-entrance'] };
  });
  expect(skipped).toEqual({ pieces: [], zoom: 1, again: 1 });
  const later = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const enemy = b.enemies.find((e: any) => e.hp > 0);
    enemy.phase = 2; enemy.hp = Math.ceil(enemy.maxHp * 0.4); b.renderAll(); w.advanceTime(100);
    const phase = b.combatLife.debugState().pieces;
    w.advanceTime(1500);
    b.damageEnemy(enemy.id, 999, 'Test');
    const pieces = b.combatLife.debugState().pieces;
    const killed = { pieces, slowed: b.battleActors.debugState().slowed, mode: b.mode, hp: enemy.hp };
    w.advanceTime(1500);
    b.checkOutcome(); b.renderAll(); w.advanceTime(200);
    return { phase, killed, victory: { mode: b.mode, pieces: b.combatLife.debugState().pieces } };
  });
  expect(later.phase).toEqual(expect.arrayContaining(['boss-phase', 'boss-phase-ring']));
  expect(later.killed).toMatchObject({ slowed: true, hp: 0, mode: 'battle' });
  expect(later.killed.pieces).toEqual(expect.arrayContaining(['finishing-blow', 'finishing-ring']));
  // The reward state is immediate; the victory beat is layered over it.
  expect(['waymarkReward', 'cardReward', 'upgradeReward']).toContain(later.victory.mode);
  expect(later.victory.pieces).toContain('victory');
  await shot(page, 'victory-beat', info);
  expect(errors).toEqual([]);
});

test('defeat beat is layered over the immediate defeat state; Waymark lines point at what they changed', async ({ page }, info) => {
  const errors = await openBattle(page);
  const line = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    b.events.emit('waymark-fired', { effect: 'damageAll(2)' }); w.advanceTime(150);
    const g = b.combatLife.top.getByName('combat-waymark-line');
    return { target: g?.getData('target'), pieces: b.combatLife.debugState().pieces };
  });
  expect(line).toMatchObject({ target: 'enemies', pieces: ['waymark-line'] });
  await shot(page, 'waymark-line', info);
  const defeat = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    w.advanceTime(800);
    b.flock.hp = 0; b.checkOutcome(); const mode = b.mode; b.renderAll(); w.advanceTime(200);
    const pieces = b.combatLife.debugState().pieces;
    w.advanceTime(1500);
    return { mode, pieces, after: b.combatLife.debugState().pieces.filter((p: string) => !p.endsWith('-feather')) };
  });
  expect(defeat.mode).toBe('defeat');
  expect(defeat.pieces).toContain('defeat');
  expect(defeat.after).toEqual([]);
  expect(errors).toEqual([]);
});

test('Reduced Motion and Lean graphics keep badges but drop motion, particles, rolls and the camera push', async ({ page }) => {
  const errors = await openBattle(page, { 'birdsquad.motionPreference': 'reduced', 'birdsquad.graphicsQuality': 'lean' });
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const enemy = b.enemies.find((e: any) => e.hp > 0);
    b.flock.block = 4; b.flock.weak = 1; enemy.runtime = { ...enemy.runtime, type: 'boss' };
    b.renderAll(); w.advanceTime(80);
    const rolls = b.combatLife.debugState().rolls;
    b.enterMolt('Test'); b.renderAll(); w.advanceTime(300);
    const s = b.combatLife.debugState();
    return { rolls, zoom: s.zoom, feathers: b.combatLife.top.list.filter((o: any) => o.name === 'combat-life-feather').length,
      badges: s.flockBadges, life: b.battleActors.debugState().actors.find((a: any) => a.id === 'flock').life,
      cardVisible: Boolean(b.combatLife.top.getByName('combat-boss-name-card-title')) };
  });
  expect(result.rolls).toEqual([]);
  expect(result.zoom).toBe(1);
  expect(result.feathers).toBe(0);
  expect(result.badges).toEqual(expect.arrayContaining(['4 Cover', 'Winded 1', 'Molt']));
  expect(result.life).toBeFalsy();
  // The name card still reads; it simply does not move.
  expect(result.cardVisible).toBe(true);
  expect(errors).toEqual([]);
});
